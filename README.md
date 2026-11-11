# GenSprint Labs — landing page

Site público da GenSprint Labs (https://gensprint.com.br). Estático: HTML, CSS e JS vanilla, sem build, sem dependência, sem CDN. Vende o RefactorAI (modernização de sites com IA) e os demais serviços da casa.

## Rodar local

```bash
npm run dev
```

Abre em http://127.0.0.1:4173.

## Checar

```bash
npm test
```

Roda o contraste WCAG dos tokens (`scripts/check-contrast.mjs`) e as checagens do site (`tests/site.test.mjs`): links e âncoras, CSP, JSON-LD, semântica, rótulos, cor só por token, whitelist de publicação.

## Publicar

Merge em `main` publica (`.github/workflows/deploy.yml`, OIDC), depois de ativado (abaixo). No terminal, com o perfil AWS do dono:

```bash
bash infra/scripts/deploy.sh --plan-only
```

```bash
bash infra/scripts/deploy.sh
```

## Ativar o deploy pelo Actions

**Ativado em 2026-11-11**: role aplicada, variável `AWS_DEPLOY_ROLE_ARN` gravada e environment `production` restrito a `main`. Merge em `main` publica. O roteiro abaixo fica como referência para recriar do zero.

Uma vez só, com o perfil AWS do dono. Cria a role `GenSprintLandingGitHubDeployRole` (2 recursos: role e policy mínima) e aponta o repositório para ela. Enquanto a variável não existir, o job de deploy é pulado.

```bash
terraform -chdir=infra/bootstrap init
```

```bash
terraform -chdir=infra/bootstrap apply -target=aws_iam_role.deploy -target=aws_iam_role_policy.deploy
```

```bash
gh variable set AWS_DEPLOY_ROLE_ARN --repo GenSprint-Labs/landingpage --body "$(terraform -chdir=infra/bootstrap output -raw deploy_role_arn)"
```

```bash
gh workflow run deploy.yml --repo GenSprint-Labs/landingpage
```

## CloudFront: cabeçalhos de segurança e 404

A distribuição vive em `infra/bootstrap/cloudfront.tf`: cabeçalhos de segurança (HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP) e 404 de verdade com `site/404.html`. Mudou a CSP da meta tag, mude a do Terraform (o teste compara). Aplicar com o perfil do dono:

```bash
terraform -chdir=infra/bootstrap plan
```

```bash
terraform -chdir=infra/bootstrap apply -target=aws_cloudfront_response_headers_policy.site -target=aws_cloudfront_distribution.site
```

## Estrutura

```
site/                 tudo que vai para o ar (e só isso)
  index.html
  css/base.css        tokens, espelho do RefactorAI (--gs-*)
  css/site.css        layout, componentes, motion
  js/theme-init.js    tema antes da primeira pintura
  js/site.js          motion e formulários
  fonts/ assets/      fontes locais (OFL), logo, favicon, og-image
  robots.txt sitemap.xml llms.txt
scripts/              contraste, og-image
tests/                checagens (node --test)
infra/scripts/        deploy.sh
infra/bootstrap/      role OIDC do Actions, distribuição CloudFront e cabeçalhos de segurança (Terraform, aplicado à mão)
docs/                 design.md, adr/
```

Regras do projeto para agentes e pessoas: `CLAUDE.md`. Identidade visual: `docs/design.md`.
