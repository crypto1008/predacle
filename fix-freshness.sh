#!/usr/bin/env bash
set -e

FILE="app/api/cron/fetch-markets/route.ts"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found. Make sure you are in the predacle project folder."
  exit 1
fi

cp "$FILE" "$FILE.bak"
echo "Backup saved: $FILE.bak"

python3 << 'PYEOF'
import sys

FILE = "app/api/cron/fetch-markets/route.ts"
with open(FILE) as f:
    src = f.read()

ANCHOR = "  return NextResponse.json({\n    success: true,"

NEW = """  // Close any active market not refreshed in the last 12 hours. When a market
  // resolves or is delisted it drops out of the platform's active feed and
  // stops being re-fetched, so a stale fetched_at reliably means "no longer
  // live". Any market that reappears in a later fetch is set back to 'active'
  // by the upsert above, so this self-corrects.
  await supabaseAdmin
    .from('markets')
    .update({ status: 'closed' })
    .eq('status', 'active')
    .lt('fetched_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())

"""

if src.count(ANCHOR) != 1:
    print("ERROR: could not find a unique insertion point. File may have changed. Aborting (no edit made).")
    sys.exit(1)

src = src.replace(ANCHOR, NEW + ANCHOR)

with open(FILE, "w") as f:
    f.write(src)

print("Staleness sweep added successfully.")
PYEOF

echo ""
echo "Building to verify the code compiles (nothing deploys unless this passes)..."
npm run build

rm -f "$FILE.bak"
git add -A
git commit -m "Close stale markets: sweep markets not refreshed in 12h (resolved/delisted)"
git push

echo ""
echo "DONE. If you see a successful push above, the fix is deploying to Vercel."
