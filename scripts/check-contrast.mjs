// Verifica contraste WCAG AA dos pares de token de site/css/base.css e site/css/site.css nos dois temas.
// Mesma lógica do script homônimo do RefactorAI (os tokens são espelhados, prefixo --gs-).
// Uso: node scripts/check-contrast.mjs   (sai com código 1 se algum par reprovar)
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const css = read('../site/css/base.css') + read('../site/css/site.css');
const tokens = { light: {}, dark: {} };
for (const m of css.matchAll(/--(?:gs|demo)-([a-z0-9-]+):\s*light-dark\(\s*(#[0-9a-f]{6}|rgba?\([^)]*\))\s*,\s*(#[0-9a-f]{6}|rgba?\([^)]*\))\s*\)/gi)) {
  tokens.light[m[1]] = m[2];
  tokens.dark[m[1]] = m[3];
}
for (const m of css.matchAll(/--(?:gs|demo)-([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
  tokens.light[m[1]] ??= m[2];
  tokens.dark[m[1]] ??= m[2];
}

const rgb = (c) => {
  if (c.startsWith('#')) return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  return c.match(/[\d.]+/g).slice(0, 3).map(Number);
};
const lum = (c) => {
  const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [primeiro plano, fundo, mínimo, onde aparece]
const T = 4.5; const C = 3;
const pairs = [];
for (const s of ['bg', 'surface', 'surface-2']) {
  for (const fg of ['text', 'text-secondary', 'text-muted', 'accent']) pairs.push([fg, s, T, 'texto']);
}
pairs.push(['on-accent', 'accent', T, 'botão primário']);
pairs.push(['on-accent', 'accent-hover', T, 'botão primário (hover)']);
pairs.push(['text', 'accent-bg', T, 'cartão do produto próprio']);
pairs.push(['text-secondary', 'accent-bg', T, 'cartão do produto próprio']);
pairs.push(['accent', 'accent-bg', T, 'link no cartão do produto próprio']);
pairs.push(['text-muted', 'accent-bg', T, 'rótulo no cartão do produto próprio']);
pairs.push(['marker-ink', 'marker', T, 'texto sobre marca-texto']);
pairs.push(['on-destructive', 'destructive', T, 'nota do "antes"']);
pairs.push(['on-success', 'success', T, 'nota do "depois"']);
pairs.push(['destructive', 'surface', T, 'nota antiga no relatório']);
pairs.push(['success', 'surface', T, 'nota nova no relatório']);
for (const k of ['destructive', 'warning', 'info']) pairs.push([`${k}-text`, `${k}-bg`, T, `gravidade ${k}`]);
for (const s of ['bg', 'surface']) {
  pairs.push(['border-strong', s, C, 'borda de campo']);
  pairs.push(['accent', s, C, 'foco']);
}
// Bloco RefactorAI (sempre escuro)
pairs.push(['p-text', 'p-bg', T, 'bloco RefactorAI']);
pairs.push(['p-muted', 'p-bg', T, 'bloco RefactorAI']);
pairs.push(['p-muted', 'p-surface', T, 'log do RefactorAI']);
pairs.push(['p-accent', 'p-surface', T, 'log do RefactorAI']);
pairs.push(['p-bad', 'p-surface', T, 'log do RefactorAI']);
pairs.push(['p-warn', 'p-surface', T, 'log do RefactorAI']);
pairs.push(['p-on-accent', 'p-accent', T, 'botão do bloco RefactorAI']);
pairs.push(['p-on-accent', 'p-text', T, 'botão do bloco RefactorAI (hover)']);
pairs.push(['p-bg', 'p-text', T, 'marca R']);

let fail = 0; let total = 0;
const lines = [];
for (const theme of ['light', 'dark']) {
  for (const [fg, bg, min, what] of pairs) {
    const a = tokens[theme][fg]; const b = tokens[theme][bg];
    if (!a || !b) { fail++; lines.push(`FALTA  ${theme}  --${fg} / --${bg}`); continue; }
    total++;
    const r = ratio(a, b);
    const ok = r >= min;
    if (!ok) fail++;
    if (!ok || process.argv.includes('--all')) {
      lines.push(`${ok ? 'ok   ' : 'FALHA'}  ${theme.padEnd(5)}  ${r.toFixed(2)}:1 (mín ${min})  --${fg} sobre --${bg}  [${what}]`);
    }
  }
}
if (lines.length) console.log(lines.join('\n'));
console.log(`${total} pares verificados, ${fail} falhas`);
process.exit(fail ? 1 : 0);
