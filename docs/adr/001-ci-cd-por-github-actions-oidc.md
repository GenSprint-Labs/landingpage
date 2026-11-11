# ADR 001: CI/CD por GitHub Actions com OIDC, igual ao RefactorAI

- Status: aceito
- Data: 2026-11-10

## Contexto

Até aqui o site era um `index.html` único publicado à mão por `deploy.sh`, com o perfil AWS do dono, sem teste, sem CI e sem smoke test. O repositório é público. O RefactorAI já tem uma esteira (ADR 002 de lá): testes, gitleaks, lint de workflow, Terraform, deploy por OIDC e issue automática em falha. A landing vende o RefactorAI e precisa do mesmo rigor.

## Decisão

1. **Mesma esteira, reduzida ao que um site estático precisa.** `test.yml` roda checagens do site, gitleaks, actionlint/zizmor/shellcheck e `terraform fmt/validate`. `deploy.yml` roda em push na `main` e por dispatch, e abre issue quando falha. Actions fixadas por SHA; Dependabot semanal sem auto-merge.
2. **Um caminho de deploy**: `infra/scripts/deploy.sh`, idêntico no Actions e no terminal. Publica `site/` por whitelist de extensão, invalida o CloudFront e termina com smoke test que confere conteúdo e `content-type`.
3. **Credencial de curta duração**: role `GenSprintLandingGitHubDeployRole`, assumível só pelo environment `production` do repo (restrito à `main`). Como o repo é público, nenhum job de PR assume role. Permissão mínima: objetos do bucket do site e invalidação da distribuição.
4. **A role vive em `infra/bootstrap`**, com state em `gensprint-terraform-state` (chave `landingpage/bootstrap/terraform.tfstate`), aplicada à mão pelo dono. O CI não edita a própria permissão.
5. **Sem dependência npm**: os testes usam `node --test`. Não há `npm ci`, lockfile nem cache para envenenar.

## Consequências

- Merge em `main` é deploy em produção. PR é o lugar de revisar.
- **Atualização de 2026-11-11:** a distribuição CloudFront foi importada para `infra/bootstrap/cloudfront.tf` (import sem destruir nem recriar). Com isso saíram as duas pendências:
  - cabeçalhos de segurança por response headers policy (HSTS de 1 ano sem `includeSubDomains`, porque `gensprint.com.br` tem subdomínios de outros projetos; `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e a mesma CSP da meta tag mais `frame-ancestors 'none'`);
  - o erro 403 (objeto ausente em bucket privado) e o 404 respondem HTTP 404 com `site/404.html`, no lugar de `/index.html` com HTTP 200.
- A stack continua aplicada à mão pelo dono, com `-target`; a role do CI só publica arquivos e invalida o cache. O smoke do deploy confere os cabeçalhos e o 404.
- Seguem fora do Terraform: bucket, OAC, certificado ACM e a function de redirect (entram por identificador).
- O state do bootstrap divide bucket com o GenSprint Core; a chave é própria e o bucket é versionado.
