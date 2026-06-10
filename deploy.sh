#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Deploy da GenSprintLabs Landing Page → AWS S3 + CloudFront
# =============================================================================
# Uso:
#   ./deploy.sh             — faz upload e invalida o cache
#   ./deploy.sh --skip-sync — invalida o cache sem fazer upload
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

S3_BUCKET="gensprintlabs-frontend-production"
CF_DISTRIBUTION_ID="E1KARJMUSXKRWK"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()     { echo -e "${BLUE}[GENSPRINT]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[x]${NC} $1"; exit 1; }

SKIP_SYNC=false
for arg in "$@"; do
  case $arg in
    --skip-sync) SKIP_SYNC=true ;;
    *) warn "Flag desconhecida: $arg" ;;
  esac
done

# --- Pré-requisitos ----------------------------------------------------------
log "Verificando pré-requisitos..."
command -v aws >/dev/null 2>&1 || error "AWS CLI não encontrado."
aws sts get-caller-identity >/dev/null 2>&1 || error "Credenciais AWS não configuradas."
CALLER=$(aws sts get-caller-identity --query 'Arn' --output text)
success "AWS autenticado: $CALLER"

# --- Upload para S3 ----------------------------------------------------------
if [[ "$SKIP_SYNC" == false ]]; then
  log "Fazendo upload dos arquivos para s3://$S3_BUCKET..."

  aws s3 cp "$SCRIPT_DIR/index.html" "s3://$S3_BUCKET/index.html" \
    --content-type "text/html; charset=utf-8" \
    --cache-control "public, max-age=300"

  aws s3 cp "$SCRIPT_DIR/robots.txt" "s3://$S3_BUCKET/robots.txt" \
    --content-type "text/plain" \
    --cache-control "public, max-age=86400"

  aws s3 cp "$SCRIPT_DIR/sitemap.xml" "s3://$S3_BUCKET/sitemap.xml" \
    --content-type "application/xml" \
    --cache-control "public, max-age=3600"

  aws s3 cp "$SCRIPT_DIR/llms.txt" "s3://$S3_BUCKET/llms.txt" \
    --content-type "text/plain" \
    --cache-control "public, max-age=3600"

  # Remove arquivos do S3 que não existem mais localmente
  aws s3 sync "$SCRIPT_DIR" "s3://$S3_BUCKET" \
    --exclude ".git/*" \
    --exclude "*.md" \
    --exclude "deploy.sh" \
    --delete

  success "Upload concluído"
else
  warn "Sync ignorado (--skip-sync)"
fi

# --- Invalidar cache do CloudFront -------------------------------------------
log "Invalidando cache do CloudFront ($CF_DISTRIBUTION_ID)..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)
success "Invalidação criada: $INVALIDATION_ID"

# --- Aguardar invalidação (opcional) -----------------------------------------
log "Aguardando propagação do CloudFront..."
aws cloudfront wait invalidation-completed \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --id "$INVALIDATION_ID"
success "Cache invalidado e propagado!"

echo ""
success "Deploy concluído!"
echo -e "  ${GREEN}https://gensprintlabs.com.br${NC}"
echo -e "  ${GREEN}https://gensprint.com.br${NC}"
