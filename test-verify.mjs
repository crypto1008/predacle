// Validates the verify-before-close mechanism BEFORE building it into a cron.
// Pulls a sample of closed-but-future Polymarket markets from our DB, asks Gamma
// about them in batches (testing the condition_ids batch syntax), and reports
// the real breakdown: how many are actually still active (false-closed -> should
// reactivate) vs genuinely resolved (-> record outcome) vs delisted (-> leave closed).
import fs from 'fs'

const env = {}
try {
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
} catch (e) { console.error('could not read .env.local:', e.message); process.exit(1) }

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('missing supabase env. found keys:', Object.keys(env).join(', '))
  process.exit(1)
}

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!r.ok) throw new Error(`supabase ${r.status}: ${await r.text()}`)
  return r.json()
}

async function gammaByConditions(cids) {
  const params = cids.map(c => `condition_ids=${encodeURIComponent(c)}`).join('&')
  const url = `https://gamma-api.polymarket.com/markets?${params}&limit=100`
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' })
  if (!r.ok) { console.log(`  gamma batch status ${r.status}`); return [] }
  const j = await r.json()
  return Array.isArray(j) ? j : j.data || []
}

async function main() {
  const now = new Date().toISOString()
  const rows = await sb(`markets?platform=eq.polymarket&status=eq.closed&end_date=gt.${encodeURIComponent(now)}&select=id,question,end_date&limit=80`)
  console.log(`Sampled ${rows.length} closed-but-future Polymarket markets\n`)

  const withCid = rows.filter(r => r.id.startsWith('polymarket-0x'))
  console.log(`${withCid.length} have a condition_id (verifiable); ${rows.length - withCid.length} event-level (skip)\n`)

  const byCid = new Map(withCid.map(r => [r.id.replace('polymarket-', ''), r]))
  const cids = [...byCid.keys()]

  let active = 0, resolvedYes = 0, resolvedNo = 0, resolvedUnclear = 0
  const seen = new Set()
  let shown = 0

  for (let i = 0; i < cids.length; i += 20) {
    const batch = cids.slice(i, i + 20)
    const mkts = await gammaByConditions(batch)
    if (i === 0) console.log(`(batch syntax check: asked for 20, Gamma returned ${mkts.length})\n`)
    for (const m of mkts) {
      const cid = m.conditionId
      if (!cid || !byCid.has(cid) || seen.has(cid)) continue
      seen.add(cid)
      const closed = m.closed === true
      let prices = []
      try { prices = JSON.parse(m.outcomePrices || '[]').map(Number) } catch {}
      let cat
      if (!closed && m.active) { active++; cat = 'ACTIVE -> reactivate' }
      else if (closed && prices[0] === 1) { resolvedYes++; cat = 'RESOLVED YES -> record' }
      else if (closed && prices[0] === 0) { resolvedNo++; cat = 'RESOLVED NO  -> record' }
      else { resolvedUnclear++; cat = `closed/unclear [${prices.join(',')}] -> record` }
      if (shown++ < 25) console.log(`  ${cat.padEnd(34)} ${byCid.get(cid).question.slice(0,52)}`)
    }
  }
  const notfound = cids.length - seen.size
  console.log(`\n--- Breakdown of ${cids.length} verifiable closed-but-future Polymarket markets ---`)
  console.log(`  ACTIVE (false-closed, reactivate):     ${active}`)
  console.log(`  RESOLVED YES (record + keep closed):   ${resolvedYes}`)
  console.log(`  RESOLVED NO  (record + keep closed):   ${resolvedNo}`)
  console.log(`  closed/unclear (record + keep closed): ${resolvedUnclear}`)
  console.log(`  NOT FOUND on Gamma (delisted):         ${notfound}`)
}
main().catch(e => console.error('error:', e.message))
