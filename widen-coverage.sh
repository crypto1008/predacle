#!/usr/bin/env bash
set -e

K="lib/fetchers/kalshi.ts"
P="lib/fetchers/polymarket.ts"

for f in "$K" "$P"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: $f not found. Make sure you are in the predacle project folder."
    exit 1
  fi
done

cp "$K" "$K.bak"
cp "$P" "$P.bak"
echo "Backups saved: $K.bak, $P.bak"

python3 << 'PYEOF'
import sys

def edit(path, repls):
    with open(path) as f:
        src = f.read()
    for old, new in repls:
        n = src.count(old)
        if n != 1:
            print(f"ERROR: in {path}, expected exactly 1 occurrence of:\n    {old!r}\n  but found {n}. Aborting (no changes written).")
            sys.exit(1)
        src = src.replace(old, new)
    with open(path, "w") as f:
        f.write(src)
    print(f"Updated {path}")

edit("lib/fetchers/kalshi.ts", [
    ("markets?limit=10&status=open", "markets?limit=100&status=open"),
    ("if (res.status === 429) { console.log('Kalshi: rate limited'); break }",
     "if (res.status === 429) { console.log('Kalshi: rate limited, backing off'); await sleep(400); continue }"),
    ("await sleep(120)", "await sleep(250)"),
])

edit("lib/fetchers/polymarket.ts", [
    ("&limit=100&order=volume24hr", "&limit=200&order=volume24hr"),
    (".slice(0, 100)", ".slice(0, 500)"),
])
PYEOF

echo ""
echo "Building to verify the code compiles (nothing deploys unless this passes)..."
npm run build

rm -f "$K.bak" "$P.bak"
git add -A
git commit -m "Widen fetch coverage: Kalshi limit 10->100 + don't break loop on 429; Polymarket cap 100->500"
git push

echo ""
echo "DONE. If you see a successful push above, the wider coverage is deploying to Vercel."
