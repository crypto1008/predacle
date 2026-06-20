#!/usr/bin/env bash
# ============================================================
#  Predacle — apply Coinbase theme to ALL pages  (macOS + Linux)
#  Run from the repo root:  bash apply-coinbase-theme.sh
# ============================================================
set -e

if [ ! -d app ] || [ ! -f package.json ]; then
  echo "✗ Run this from the Predacle repo root (folder with package.json and app/)."
  exit 1
fi

# Keep backups out of git
touch .gitignore
grep -q 'app-backup-\*.tgz' .gitignore || echo 'app-backup-*.tgz' >> .gitignore

# 1) Backup ----------------------------------------------------------
STAMP=$(date +%Y%m%d-%H%M%S)
tar czf "app-backup-$STAMP.tgz" app
echo "✓ Backup saved: app-backup-$STAMP.tgz"

# 2) Color sweep (perl = same on macOS & Linux) ----------------------
PL=$(mktemp /tmp/predacle-colormap.XXXXXX.pl)
cat > "$PL" << 'PLEOF'
s/#5f5cf0/#0052ff/g;
s/#4f4cd4/#0043ce/g;
s/#ede9fe/#eaf0ff/g;
s/#1e1b4b/#0f1d3d/g;
s/#ddd6fe/#cdddff/g;
s/#312e81/#1d3563/g;
s/#c4b5fd/#99b9ff/g;
s/#a5b4fc/#6b9bff/g;
s/#4338ca/#0a3aaf/g;
s/#c7d2fe/#c9dcff/g;
s/#f5f3ff/#eef4ff/g;
s/#ece9fd/#d8e6ff/g;
s/#2a2550/#1d3563/g;
s/#15132e/#0f1d3d/g;
s/#faf9ff/#f5f8ff/g;
s/#f0f0ff/#f0f5ff/g;
s/#e0e0fe/#dbe7ff/g;
s/rgba\(95,92,240/rgba(0,82,255/g;
s/rgba\(95, 92, 240/rgba(0, 82, 255/g;
s/#0b0d12/#0a0b0d/g;
s/#111318/#16171a/g;
s/#0d1117/#0d0e10/g;
s/#15171d/#141518/g;
s/#1a1d24/#141518/g;
s/#1a1a2e/#0e1424/g;
s/#1e2330/#26282d/g;
s/#252a38/#2d2f35/g;
s/#2d3748/#303338/g;
s/#e8ecf0/#eaecef/g;
s/#e2e8f0/#eaecef/g;
s/#f5f7fa/#f5f6f8/g;
s/#f8fafc/#f5f6f8/g;
s/#f6f7fb/#f5f6f8/g;
s/#f1f5f9/#f5f6f8/g;
s/#0f172a/#0a0b0d/g;
s/#1e293b/#16181c/g;
s/#334155/#2d2f35/g;
s/#475569/#5b616e/g;
s/#64748b/#5b616e/g;
s/#94a3b8/#8a919e/g;
s/#cbd5e1/#dfe1e6/g;
s/#10b981/#05a66b/g;
s/#059669/#04794e/g;
s/#34d399/#2bd97c/g;
s/#ecfdf5/#e7f8f0/g;
s/#d1fae5/#cdeede/g;
s/#a7f3d0/#bfeed8/g;
s/#065f46/#0a5235/g;
s/#052e16/#04291b/g;
s/#ef4444/#e5484d/g;
s/#dc2626/#cf202f/g;
s/#f87171/#ff6b6b/g;
s/#fef2f2/#fdecec/g;
s/#fee2e2/#fde7e7/g;
s/#fecaca/#f6c9cb/g;
s/#991b1b/#b3262b/g;
s/#450a0a/#3a0d0d/g;
s/#6d28d9/#4f46e5/g;
PLEOF
find app -type f \( -name '*.tsx' -o -name '*.ts' \) -print0 | xargs -0 perl -i -p "$PL"
rm -f "$PL"
echo "✓ Palette swept across all pages & components"

# 3) Header wordmark -> Sora display font ---------------------------
HPL=$(mktemp /tmp/predacle-header.XXXXXX.pl)
cat > "$HPL" << 'HPLEOF'
local $/;
my $f = 'app/components/Header.tsx';
open my $in, '<', $f or die "open $f: $!";
my $s = <$in>; close $in;
my $old = q{<span style={{ fontWeight: 700, fontSize: 15, color: dark ? '#f5f6f8' : '#0a0b0d', letterSpacing: '-0.3px' }}>};
my $new = q{<span className="font-display" style={{ fontWeight: 800, fontSize: 19, color: dark ? '#f5f6f8' : '#0a0b0d', letterSpacing: '-0.03em' }}>};
if (index($s, 'className="font-display"') >= 0 && index($s, 'fontSize: 19') >= 0) {
  print "  header wordmark already on Sora (skipped)\n";
} elsif (index($s, $old) >= 0) {
  $s =~ s/\Q$old\E/$new/;
  open my $out, '>', $f or die; print $out $s; close $out;
  print "  header wordmark switched to Sora\n";
} else {
  print "  ! header wordmark span not found — header left as-is\n";
}
HPLEOF
perl "$HPL"
rm -f "$HPL"
echo "✓ Header updated"

# 4) Global heading font: every H1/H2 uses Sora ---------------------
if ! grep -q 'coinbase-headings' app/globals.css; then
cat >> app/globals.css << 'CSSEOF'

/* coinbase-headings — every page H1/H2 uses the Sora display font */
h1, h2 {
  font-family: var(--font-sora), var(--font-inter), system-ui, sans-serif;
  letter-spacing: -0.02em;
}
CSSEOF
echo "✓ All page headings set to Sora"
else
echo "• Heading rule already present (skipped)"
fi

# 5) Build gate ------------------------------------------------------
echo ""
echo "▶ Running build to verify…"
npm run build
echo ""
echo "✅ Done. Review with 'npm run dev', then:"
echo "   git add -A && git commit -m 'Apply Coinbase theme to all pages' && git push"
