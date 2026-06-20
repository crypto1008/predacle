#!/usr/bin/env bash
# ============================================================
#  Predacle — clean up remaining off-palette colors  (macOS + Linux)
#  Sweeps stray purples/indigos/grays on the tool pages, market
#  detail page, divergence page, charts, and OG image to the
#  Coinbase palette. Leaderboard chart series colors left intact.
#  Run from repo root:  bash cleanup-theme-leftovers.sh
# ============================================================
set -e
if [ ! -d app ] || [ ! -f package.json ]; then
  echo "✗ Run this from the Predacle repo root."; exit 1
fi
touch .gitignore
grep -q 'app-backup-\*.tgz' .gitignore || echo 'app-backup-*.tgz' >> .gitignore

STAMP=$(date +%Y%m%d-%H%M%S)
tar czf "app-backup-$STAMP.tgz" app
echo "✓ Backup saved: app-backup-$STAMP.tgz"

PL=$(mktemp /tmp/predacle-cleanup.XXXXXX.pl)
cat > "$PL" << 'PLEOF'
s/#6366f1/#0052ff/g;
s/#eef2ff/#eaf0ff/g;
s/#e9e7fb/#dbe7ff/g;
s/#e0e7ff/#dbe7ff/g;
s/#15131f/#0f1d3d/g;
s/#2d1b69/#1d3563/g;
s/#1a0f4a/#0f1d3d/g;
s/#3730a3/#1d3563/g;
s/#9ca3af/#8a919e/g;
s/#6b7280/#5b616e/g;
s/#2a2a37/#26282d/g;
s/#eef0f4/#eaecef/g;
s/#262633/#26282d/g;
s/#ececf1/#eaecef/g;
s/#15151d/#16171a/g;
s/#e5e7eb/#f5f6f8/g;
s/#1f2937/#0a0b0d/g;
s/#1a1f2e/#141518/g;
s/#f0fdf4/#e7f8f0/g;
s/#bbf7d0/#bfeed8/g;
s/#15803d/#04794e/g;
s/#16a34a/#05a66b/g;
s/#eef1f5/#f5f6f8/g;
s/#eef0f2/#eaecef/g;
s/#f6f7f8/#f5f6f8/g;
PLEOF
find app -type f \( -name '*.tsx' -o -name '*.ts' \) -print0 | xargs -0 perl -i -p "$PL"
rm -f "$PL"
echo "✓ Stray colors swept to Coinbase palette"

# Targeted (keep leaderboard chart series colors distinct)
perl -i -pe 's/#7c3aed/#0052ff/g; s/#a78bfa/#6b9bff/g;' 'app/markets/[id]/MarketDetailClient.tsx'
perl -i -pe 's/#a78bfa/#0052ff/g'                         'app/markets/[id]/opengraph-image.tsx'
echo "✓ Market detail + OG image brand color fixed to blue"

echo ""
echo "▶ Running build to verify…"
npm run build
echo ""
echo "✅ Done. Then:"
echo "   git add -A && git commit -m 'Clean up off-palette colors across all pages' && git push"
