#!/usr/bin/env bash
# Gera site/assets/og-image.png (1200x630) a partir de scripts/og/og.html com o Chrome headless.
# Rode quando mudar o título do hero ou a identidade: `npm run og`.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[[ -x "$CHROME" ]] || { echo "Chrome não encontrado em $CHROME (defina CHROME=...)" >&2; exit 1; }
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --virtual-time-budget=3000 \
  --screenshot="$ROOT/site/assets/og-image.png" "file://$ROOT/scripts/og/og.html" >/dev/null 2>&1
echo "ok: site/assets/og-image.png"
