// Checagens da landing: tudo que o deploy publica precisa passar aqui.
// Sem dependências: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const read = (rel) => fs.readFileSync(path.join(SITE, rel), 'utf8');
const html = read('index.html');
const siteCss = read('css/site.css');
const baseCss = read('css/base.css');
const siteJs = read('js/site.js');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const files = walk(SITE).map((f) => path.relative(SITE, f));

// Extensões que o deploy publica (infra/scripts/deploy.sh). LICENSE-*.txt entra como .txt.
const PUBLISHED = new Set(['html', 'css', 'js', 'svg', 'png', 'txt', 'xml', 'woff2']);

const attrs = (name) => [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, 'g'))].map((m) => m[1]);
const body = html.slice(html.indexOf('<body'));
const ids = new Set(attrs('id'));

test('toda extensão em site/ está na whitelist do deploy', () => {
  const stray = files.filter((f) => !PUBLISHED.has(f.split('.').pop()));
  assert.deepEqual(stray, [], 'arquivo em site/ que o deploy não publicaria');
  const deploy = fs.readFileSync(path.join(ROOT, 'infra/scripts/deploy.sh'), 'utf8');
  for (const ext of PUBLISHED) {
    assert.match(deploy, new RegExp(`sync_type .*\\s${ext}\\b`), `deploy.sh não publica .${ext}`);
  }
});

test('arquivos obrigatórios existem', () => {
  for (const f of ['index.html', '404.html', 'robots.txt', 'sitemap.xml', 'llms.txt', 'assets/logo.svg',
    'assets/favicon.svg', 'assets/og-image.png', 'css/base.css', 'css/site.css', 'js/site.js', 'js/theme-init.js']) {
    assert.ok(files.includes(f), `falta site/${f}`);
  }
});

test('todo arquivo local referenciado existe', () => {
  const refs = [...attrs('href'), ...attrs('src')].filter((u) => u.startsWith('/') && u !== '/');
  assert.ok(refs.length > 5);
  for (const u of refs) assert.ok(fs.existsSync(path.join(SITE, u)), `referência quebrada: ${u}`);
  for (const m of baseCss.matchAll(/url\('([^']+)'\)/g)) {
    assert.ok(fs.existsSync(path.join(SITE, 'css', m[1])), `fonte não encontrada: ${m[1]}`);
  }
});

test('toda âncora interna aponta para um id existente', () => {
  for (const u of attrs('href').filter((h) => h.startsWith('#'))) {
    assert.ok(ids.has(u.slice(1)), `âncora sem alvo: ${u}`);
  }
  for (const name of ['aria-labelledby', 'aria-controls', 'aria-describedby', 'for']) {
    for (const v of attrs(name)) assert.ok(ids.has(v), `${name}="${v}" sem alvo`);
  }
});

test('ids são únicos', () => {
  const all = attrs('id');
  assert.equal(all.length, new Set(all).size, 'id repetido');
});

test('nada carregado de fora: sem CDN, sem fonte externa', () => {
  const external = [...html.matchAll(/<(?:script|link|img|iframe)\b[^>]*\s(?:src|href)="(https?:)?\/\/[^"]*"[^>]*>/g)]
    .map((m) => m[0])
    .filter((tag) => !/rel="(canonical|alternate)"/.test(tag));
  assert.deepEqual(external, []);
  assert.doesNotMatch(siteCss + baseCss, /@import|url\(\s*['"]?https?:/);
  assert.doesNotMatch(siteJs, /\bfetch\(|XMLHttpRequest|sendBeacon/, 'a landing não faz chamada de rede');
});

test('compatível com a CSP: sem estilo ou script inline', () => {
  assert.match(html, /Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'/);
  assert.doesNotMatch(html, /<style\b/, '<style> inline quebra style-src self');
  assert.doesNotMatch(html, /\sstyle="/, 'atributo style quebra style-src self');
  assert.doesNotMatch(html, /\son[a-z]+="/, 'handler inline quebra script-src self');
  const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\ssrc=/.test(m[1]) && !/application\/ld\+json/.test(m[1]));
  assert.equal(inline.length, 0, 'script inline executável');
});

test('JSON-LD é válido e coerente com a página', () => {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  const data = JSON.parse(m[1]);
  const graph = data['@graph'];
  const org = graph.find((n) => n['@type'] === 'ProfessionalService');
  assert.equal(org.url, 'https://gensprint.com.br/');
  const faq = graph.find((n) => n['@type'] === 'FAQPage');
  const summaries = [...html.matchAll(/<summary>([^<]+)<\/summary>/g)].map((s) => s[1]);
  assert.deepEqual(faq.mainEntity.map((q) => q.name), summaries, 'FAQ do JSON-LD difere do FAQ visível');
});

test('domínio canônico é gensprint.com.br em todo lugar', () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/gensprint\.com\.br\/"/);
  for (const f of ['index.html', 'sitemap.xml', 'robots.txt', 'llms.txt']) {
    assert.doesNotMatch(read(f), /https?:\/\/(www\.)?gensprintlabs\.com\.br/, `${f} usa o domínio que redireciona`);
  }
});

test('semântica: um h1, landmarks, idioma, skip link', () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<html lang="pt-BR">/);
  for (const tag of ['<header', '<main', '<footer', '<nav']) assert.ok(body.includes(tag), `falta ${tag}`);
  assert.match(body, /class="skip-link" href="#conteudo"/);
  const levels = [...body.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  levels.reduce((prev, cur) => { assert.ok(cur - prev <= 1, `título pula de h${prev} para h${cur}`); return cur; });
});

test('todo campo tem rótulo e todo botão de ícone tem nome', () => {
  const labelled = new Set(attrs('for'));
  for (const m of body.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const id = (m[2].match(/\sid="([^"]+)"/) || [])[1];
    assert.ok(id && labelled.has(id), `campo sem <label for>: ${m[0].slice(0, 80)}`);
  }
  for (const m of body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const text = m[2].replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim();
    assert.ok(text || /aria-label="/.test(m[1]), `botão sem nome: ${m[0].slice(0, 80)}`);
  }
  for (const m of body.matchAll(/<img\b([^>]*)>/g)) assert.match(m[1], /\salt="/, 'img sem alt');
});

test('link em nova aba tem rel=noopener', () => {
  for (const m of body.matchAll(/<a\b([^>]*target="_blank"[^>]*)>/g)) assert.match(m[1], /rel="[^"]*noopener/);
});

test('cor só por token: nenhum literal fora de :root', () => {
  const withoutRoot = siteCss.replace(/:root\s*\{[\s\S]*?\n\}/, '');
  const literals = [...withoutRoot.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)].map((m) => m[0])
    .filter((c) => c !== '#000'); // #000 só em máscaras (mask-image), onde é alfa e não cor
  assert.deepEqual(literals, []);
});

test('motion respeita prefers-reduced-motion e não esconde conteúdo sem JS', () => {
  assert.match(baseCss, /prefers-reduced-motion: reduce/);
  assert.match(siteCss, /prefers-reduced-motion: reduce/);
  assert.match(siteJs, /prefers-reduced-motion: reduce/);
  for (const m of siteCss.matchAll(/([^{}]*)\{[^{}]*opacity:\s*0;[^{}]*\}/g)) {
    const sel = m[1].trim();
    // Quadros de @keyframes e peças decorativas (aria-hidden) ou de interação não contam.
    const decorative = /^(from|to|\d+%)$/.test(sel) || /\.notes li|\.compare__range|\.nav__links/.test(sel);
    assert.ok(decorative || sel.includes('html.js'), `"${sel}" esconde conteúdo mesmo sem JS`);
  }
});

test('contatos e links da marca', () => {
  assert.match(html, /https:\/\/refactorai\.gensprint\.com\.br\//, 'falta o link para o RefactorAI');
  assert.match(html, /wa\.me\/5511965485574/);
  assert.match(siteJs, /wa\.me\/5511965485574/);
  assert.match(html, /mailto:contato@gensprintlabs\.com\.br/);
});

test('og-image é um PNG 1200x630', () => {
  const buf = fs.readFileSync(path.join(SITE, 'assets/og-image.png'));
  assert.equal(buf.subarray(1, 4).toString(), 'PNG');
  assert.equal(buf.readUInt32BE(16), 1200);
  assert.equal(buf.readUInt32BE(20), 630);
});

test('página 404: mesma CSP, fora do índice, sem inline e sem referência quebrada', () => {
  const nf = read('404.html');
  const csp = (doc) => doc.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  assert.equal(csp(nf), csp(html), 'CSP da 404 difere da página inicial');
  assert.match(nf, /<meta name="robots" content="noindex"/);
  assert.equal((nf.match(/<h1\b/g) || []).length, 1);
  assert.match(nf, /<html lang="pt-BR">/);
  assert.doesNotMatch(nf, /\sstyle="|<style\b|\son[a-z]+="/);
  for (const m of nf.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    assert.ok(/\ssrc="\//.test(m[1]) && !m[2].trim(), 'script inline na 404');
  }
  // Servida para qualquer caminho: toda referência local precisa ser absoluta.
  const refs = [...nf.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
  for (const u of refs) {
    if (/^https:\/\//.test(u)) continue;
    assert.ok(u.startsWith('/'), `referência relativa na 404: ${u}`);
    if (u !== '/') assert.ok(fs.existsSync(path.join(SITE, u)), `referência quebrada na 404: ${u}`);
  }
  for (const a of nf.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(a[0], /rel="noopener"/);
});
