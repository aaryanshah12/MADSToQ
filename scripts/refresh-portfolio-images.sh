#!/usr/bin/env bash
# Re-download landing-page previews for the MADSToQ marketing site portfolio.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/website/portfolio"
mkdir -p "$OUT"

echo "→ Vidhi Hexachem (hero asset from live site)"
curl -fsSL -A "Mozilla/5.0" "https://vidhihexachem.in/chemical-intermediate.jpeg" \
  -o "$OUT/vidhihexachem-hero.jpeg"

echo "→ Vidhi Hexachem (full-page screenshot)"
curl -fsSL -A "Mozilla/5.0" \
  "https://image.thum.io/get/width/1200/crop/675/noanimate/https://vidhihexachem.in" \
  -o "$OUT/vidhihexachem-screenshot.png"

echo "→ Nexa Papers (full-page screenshot)"
curl -fsSL -A "Mozilla/5.0" \
  "https://image.thum.io/get/width/1200/crop/675/noanimate/https://www.nexapaper.com" \
  -o "$OUT/nexapapers.png"

echo "→ Zenith Dye Chem (full-page screenshot)"
curl -fsSL -A "Mozilla/5.0" \
  "https://image.thum.io/get/width/1200/crop/675/noanimate/https://www.zenithdyechem.com" \
  -o "$OUT/zenithdyechem-screenshot.png"

echo "Done. Files in $OUT"
