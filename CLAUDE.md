# GenSprint Labs — landing page: instruções

Site estático público em https://gensprint.com.br (S3 `gensprintlabs-frontend-production` + CloudFront `E1KARJMUSXKRWK`, conta `220395825071`). `gensprintlabs.com.br` redireciona para `gensprint.com.br`: o canônico é sempre `gensprint.com.br`.

O trabalho da página: fazer o dono de um site antigo mandar a URL para um diagnóstico. O produto vendido em primeiro lugar é o RefactorAI (repo `~/projetos/refactorai-platform`).

## Pronto = test + doc + commit + PR + deploy verificado

1. `npm test` verde (contraste + `tests/site.test.mjs`).
2. Conferir no navegador (`npm run dev`) em 375px e 1280px, tema claro e escuro.
3. Branch + PR. O CI (`.github/workflows/test.yml`) roda checagens, gitleaks, actionlint/zizmor/shellcheck e terraform fmt/validate.
4. Merge em `main` publica (`deploy.yml` → `infra/scripts/deploy.sh`) quando a variável `AWS_DEPLOY_ROLE_ARN` existe; acompanhar com `gh run watch <id> --exit-status`. Sem a variável o job é pulado: publicar pelo terminal com `bash infra/scripts/deploy.sh` (perfil `felipelageduarte`). Ativação no `README.md`.
5. O script termina com smoke test em produção; falha derruba o deploy e abre issue.

## Regras

- **Tudo que vai para o ar mora em `site/`**, e só extensões da whitelist (`html css js svg png txt xml woff2`). Extensão nova exige linha em `infra/scripts/deploy.sh` e em `tests/site.test.mjs`.
- **Sem dependência, sem build, sem CDN.** Fontes locais em `site/fonts/`. A CSP é `default-src 'self'`, em meta nos HTML e em cabeçalho no CloudFront (`infra/bootstrap/cloudfront.tf`; mudou uma, mude a outra, o teste compara): nada de `<style>`, atributo `style`, handler inline ou script inline. JS mexe em estilo só por `element.style.setProperty` e classes.
- **Cor só por token** (`--gs-*` em `css/base.css`, tokens locais no `:root` de `css/site.css`). Par novo de texto e fundo entra em `scripts/check-contrast.mjs`.
- **Tokens e fontes são espelho do RefactorAI** (`refactorai-platform/frontend/public/css/base.css`, prefixo `--ra-`). Mudou num, muda no outro. Detalhe em `docs/design.md`.
- **Marca-texto amarelo** (`--gs-marker`) é a assinatura das duas marcas: aparece em `<mark>` de título, na barra do comparador e no traço do "R". Nunca como fundo de botão.
- **Motion**: `transform` e `opacity` (e `clip-path` no comparador). Todo estado escondido exige `html.js`, para a página aparecer inteira sem JS. `prefers-reduced-motion` desliga loops e entradas.
- **Texto é verdade verificável.** Sem estatística sem fonte, sem cliente que não é nosso, sem projeto fora do ar. Os números do relatório de exemplo levam o rótulo "exemplo ilustrativo".
- **A landing não faz chamada de rede** e não guarda dado: os dois formulários só montam a mensagem e abrem o WhatsApp.
- FAQ visível e `FAQPage` do JSON-LD precisam ter as mesmas perguntas, na mesma ordem (o teste cobra).
- Mudou o título do hero ou a identidade: `npm run og` regenera `site/assets/og-image.png`.
- `infra/bootstrap` (role OIDC) é aplicado à mão pelo dono, nunca pelo CI, sempre com `-target`.

## Achados

- **2026-11-10, projeto fora do ar e link morto na vitrine.** Causa: o site listava a Ploxo como "no ar" (desligada desde 2026-08-14) e apontava para `github.com/gensprintlabs` (404); nada conferia os links externos. Regra: projeto só entra em "Projetos no ar" com a URL respondendo 200, e link externo novo é conferido com `curl` antes do commit.
- **2026-11-10, `og:image` apontava para arquivo que nunca existiu.** Causa: o CloudFront devolve `index.html` com HTTP 200 para qualquer caminho inexistente (erro 403 mapeado para `/index.html`), então o `curl` parecia saudável. Regra: smoke test confere o `content-type`, não só o status. Corrigido em 2026-11-11: caminho inexistente responde 404 com `site/404.html`, e o smoke confere.
- **2026-11-10, canônico no domínio que redireciona.** Causa: `canonical`, sitemap e JSON-LD usavam `gensprintlabs.com.br`, que responde 301 para `gensprint.com.br`. Regra: o domínio canônico é `gensprint.com.br`; o teste barra o outro.
- **2026-11-11, PR mergeado com check vermelho e deploy da `main` parado.** Causa: o gitleaks acusou o ID do OAC do CloudFront (`origin_access_control_id`) como `generic-api-key`, e o comando que esperava o CI terminava em `| tail`, que devolve 0 e deixou o merge seguir. Regra: esperar o CI com `gh pr checks <n> --watch --fail-fast` sem pipe antes do merge; identificador de recurso AWS em `.tf` leva `# gitleaks:allow` na linha, e achado já commitado entra em `.gitleaksignore` pelo fingerprint.
