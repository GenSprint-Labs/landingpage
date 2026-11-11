#!/usr/bin/env bash
# =============================================================================
# GenSprint Labs — deploy da landing page (S3 + CloudFront)
# =============================================================================
# Um único caminho de deploy, igual no GitHub Actions (.github/workflows/deploy.yml,
# OIDC) e no terminal (perfil AWS do dono).
#
#   1. checks     npm test (estrutura, links, CSP, contraste)
#   2. publish    site/ -> S3 por whitelist de extensão (nunca o diretório inteiro)
#   3. invalidate cache do CloudFront, espera propagar
#   4. smoke      página, CSS, JS, fonte e imagem em produção; falha derruba o script
#
# Uso:
#   bash infra/scripts/deploy.sh              deploy completo
#   bash infra/scripts/deploy.sh --plan-only  mostra o que subiria (dry run), sem publicar
#   bash infra/scripts/deploy.sh --smoke-only só o smoke test
#
# Ambiente (todos com default):
#   S3_BUCKET            bucket de origem
#   CF_DISTRIBUTION_ID   distribuição CloudFront
#   SITE_URL             URL pública para o smoke
# =============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="$PROJECT_ROOT/site"

S3_BUCKET="${S3_BUCKET:-gensprintlabs-frontend-production}"
CF_DISTRIBUTION_ID="${CF_DISTRIBUTION_ID:-E1KARJMUSXKRWK}"
SITE_URL="${SITE_URL:-https://gensprint.com.br}"
EXPECTED_ACCOUNT="${EXPECTED_ACCOUNT:-220395825071}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()     { echo -e "${BLUE}[GENSPRINT]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[x]${NC} $1" >&2; exit 1; }
section() { echo; echo -e "${BLUE}== $1 ==${NC}"; }

PLAN_ONLY=false
SMOKE_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --plan-only)  PLAN_ONLY=true ;;
    --smoke-only) SMOKE_ONLY=true ;;
    *) error "Flag desconhecida: $arg" ;;
  esac
done

# -----------------------------------------------------------------------------
# Smoke test: toca cada tipo de arquivo publicado e confere o conteúdo.
# -----------------------------------------------------------------------------
smoke_status() { # caminho content-type-esperado
  local url="${SITE_URL%/}$1" want_type="$2" out code ctype
  out="$(curl -sS -o /dev/null -m 20 -w '%{http_code} %{content_type}' "$url")" || error "SMOKE FALHOU: $url não respondeu"
  code="${out%% *}"; ctype="${out#* }"
  [[ "$code" == "200" ]] || error "SMOKE FALHOU: $url respondeu HTTP $code (esperado 200)"
  [[ "$ctype" == "$want_type"* ]] || error "SMOKE FALHOU: $url veio como '$ctype' (esperado $want_type)"
  success "Smoke $1 (HTTP 200, $ctype)"
}

smoke() {
  section "Smoke test em $SITE_URL"
  local body
  body="$(curl -sS -m 20 "${SITE_URL%/}/?smoke=$(date +%s)")" || error "SMOKE FALHOU: página inicial não respondeu"
  grep -q 'id="compare-range"' <<<"$body" || error "SMOKE FALHOU: a página no ar não é a versão deste repositório (falta o comparador)"
  grep -q 'refactorai.gensprint.com.br' <<<"$body" || error "SMOKE FALHOU: a página no ar não tem o link do RefactorAI"
  success "Smoke página inicial (conteúdo da versão nova)"
  smoke_status /css/site.css text/css
  smoke_status /js/site.js text/javascript
  smoke_status /fonts/bricolage-grotesque-latin-wght-normal.woff2 font/woff2
  smoke_status /assets/og-image.png image/png
  smoke_status /robots.txt text/plain
  smoke_status /sitemap.xml application/xml
  smoke_status /llms.txt text/plain
  smoke_status /404.html text/html

  # Caminho inexistente tem de voltar 404 de verdade (e não a página inicial com 200).
  local missing code
  missing="${SITE_URL%/}/smoke-nao-existe-$(date +%s)"
  code="$(curl -sS -o /dev/null -m 20 -w '%{http_code}' "$missing")" || error "SMOKE FALHOU: $missing não respondeu"
  [[ "$code" == "404" ]] || error "SMOKE FALHOU: caminho inexistente respondeu HTTP $code (esperado 404)"
  success "Smoke caminho inexistente (HTTP 404)"

  # Cabeçalhos de segurança da response headers policy (infra/bootstrap/cloudfront.tf).
  local headers h
  headers="$(curl -sS -I -m 20 "${SITE_URL%/}/" | tr -d '\r' | tr '[:upper:]' '[:lower:]')" || error "SMOKE FALHOU: cabeçalhos não responderam"
  for h in "strict-transport-security: max-age=" "x-content-type-options: nosniff" "x-frame-options: deny" \
    "referrer-policy: strict-origin-when-cross-origin" "content-security-policy: default-src 'self'" "permissions-policy: "; do
    grep -qF "$h" <<<"$headers" || error "SMOKE FALHOU: cabeçalho de segurança ausente ou diferente: $h"
  done
  grep -q "frame-ancestors 'none'" <<<"$headers" || error "SMOKE FALHOU: CSP sem frame-ancestors 'none'"
  success "Smoke cabeçalhos de segurança (HSTS, nosniff, frame, referrer, CSP, permissions)"
}

if [[ "$SMOKE_ONLY" == true ]]; then
  smoke
  exit 0
fi

# -----------------------------------------------------------------------------
# 1. Pré-requisitos e checagens
# -----------------------------------------------------------------------------
section "Pré-requisitos"
command -v aws >/dev/null 2>&1 || error "AWS CLI não encontrado."
command -v node >/dev/null 2>&1 || error "Node.js não encontrado."
[[ -f "$SITE_DIR/index.html" ]] || error "Site não encontrado: $SITE_DIR"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)" || error "Credenciais AWS não configuradas."
[[ "$ACCOUNT" == "$EXPECTED_ACCOUNT" ]] || error "Conta AWS errada: $ACCOUNT (esperado $EXPECTED_ACCOUNT)."
success "AWS autenticado na conta $ACCOUNT"

section "Checagens do site"
(cd "$PROJECT_ROOT" && npm test --silent) || error "Checagens falharam: nada foi publicado."
success "Checagens passaram"

# -----------------------------------------------------------------------------
# 2. Publicação por whitelist de extensão
# -----------------------------------------------------------------------------
# `aws s3 sync` com --exclude "*" + --include "*.<ext>" só envia E só apaga objetos dessas
# extensões: arquivo de ferramenta local nunca chega ao bucket, e --delete nunca toca em
# objeto de outro tipo.
DRYRUN=()
[[ "$PLAN_ONLY" == true ]] && DRYRUN=(--dryrun)

sync_type() { # cache-control content-type extensões...
  local cache="$1" ctype="$2"; shift 2
  local incl=() ext
  for ext in "$@"; do incl+=(--include "*.${ext}"); done
  aws s3 sync "$SITE_DIR" "s3://$S3_BUCKET" --exclude "*" "${incl[@]}" --delete \
    --cache-control "$cache" --content-type "$ctype" ${DRYRUN[@]+"${DRYRUN[@]}"}
}

section "Publicação em s3://$S3_BUCKET"
[[ "$PLAN_ONLY" == true ]] && warn "--plan-only: dry run, nada é enviado"
# Fontes têm nome fixo e conteúdo imutável; o resto é curto porque o nome não leva hash
# (a invalidação abaixo cobre o CloudFront; isto vale para o navegador).
sync_type "public, max-age=31536000, immutable" "font/woff2"                       woff2
sync_type "public, max-age=300"                 "text/css; charset=utf-8"          css
sync_type "public, max-age=300"                 "text/javascript; charset=utf-8"   js
sync_type "public, max-age=86400"               "image/svg+xml"                    svg
sync_type "public, max-age=86400"               "image/png"                        png
sync_type "public, max-age=3600"                "text/plain; charset=utf-8"        txt
sync_type "public, max-age=3600"                "application/xml"                  xml
# HTML por último: só passa a apontar para os arquivos novos depois que eles existem.
sync_type "public, max-age=300"                 "text/html; charset=utf-8"         html
success "Arquivos publicados"

if [[ "$PLAN_ONLY" == true ]]; then
  success "Plano concluído (nada publicado)"
  exit 0
fi

# -----------------------------------------------------------------------------
# 3. Invalidação do CloudFront
# -----------------------------------------------------------------------------
section "CloudFront $CF_DISTRIBUTION_ID"
INVALIDATION_ID="$(aws cloudfront create-invalidation --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/*" --query 'Invalidation.Id' --output text)" || error "Invalidação do CloudFront falhou"
log "Invalidação $INVALIDATION_ID criada, aguardando propagar..."
aws cloudfront wait invalidation-completed --distribution-id "$CF_DISTRIBUTION_ID" --id "$INVALIDATION_ID" \
  || error "Invalidação $INVALIDATION_ID não concluiu"
success "Cache invalidado"

# -----------------------------------------------------------------------------
# 4. Smoke test
# -----------------------------------------------------------------------------
smoke

echo
success "Deploy concluído: $SITE_URL"
