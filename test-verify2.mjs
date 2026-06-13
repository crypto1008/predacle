// Disambiguates the v1 result: (a) does Gamma cap/filter the condition_ids batch?
// (b) are the "not found" markets actually RESOLVED (reachable via closed=true)
// or genuinely delisted? This decides whether the verify pass needs a closed=true
// fallback to capture resolution outcomes.
import fs from 'fs'

const env = {}
for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!r.ok) throw new Error(`supabase ${r.status}: ${await r.text()}`)
  return r.json()
}
async function gamma(qs) {
  const r = await fetch(`https://gamma-api.polymarket.com/markets?${qs}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store',
  })
  if (!r.ok) return { status: r.status, arr: [] }
  const j = await r.json()
  return { status: r.status, arr: Array.isArray(j) ? j : j.data || [] }
}

async function main() {
  const now = new Date().toISOString()
  const rows = await sb(`markets?platform=eq.polymarket&status=eq.closed&end_date=gt.${encodeURIComponent(now)}&select=id,question&limit=30`)
  const items = rows.filter(r => r.id.startsWith('polymarket-0x')).map(r => ({ cid: r.id.replace('polymarket-', ''), q: r.question }))
  console.log(`Testing ${items.length} closed-but-future markets\n`)

  // (1) Batch cap test: ask for all of them in one call, with a high limit
  const cids = items.map(i => i.cid)
  const batchQS = cids.map(c => `condition_ids=${encodeURIComponent(c)}`).join('&') + '&limit=500'
  const b = await gamma(batchQS)
  console.log(`BATCH: asked ${cids.length} condition_ids in ONE call (limit=500) -> got ${b.arr.length} (http ${b.status})`)
  console.log(`  => ${b.arr.length < cids.length ? 'CAPPED or FILTERED' : 'no cap, returns all'}\n`)

  // (2) Per-market truth: default query, then closed=true fallback
  let active = 0, resolved = 0, gone = 0
  for (const it of items) {
    let res = await gamma(`condition_ids=${encodeURIComponent(it.cid)}&limit=10`)
    let m = res.arr[0], how = 'default'
    if (!m) { res = await gamma(`condition_ids=${encodeURIComponent(it.cid)}&closed=true&limit=10`); m = res.arr[0]; how = 'closed=true' }
    if (!m) { gone++; console.log(`  GONE                           ${it.q.slice(0, 46)}`); continue }
    let p = []; try { p = JSON.parse(m.outcomePrices || '[]').map(Number) } catch {}
    if (!m.closed && m.active) { active++; console.log(`  ACTIVE   via ${how.padEnd(11)}      ${it.q.slice(0, 46)}`) }
    else { resolved++; const o = p[0] === 1 ? 'YES' : p[0] === 0 ? 'NO' : `?[${p.join(',')}]`; console.log(`  RESOLVED ${o.padEnd(4)} via ${how.padEnd(11)} ${it.q.slice(0, 46)}`) }
  }
  console.log(`\n${active} active, ${resolved} resolved, ${gone} truly gone (of ${items.length})`)
}
main().catch(e => console.error('error:', e.message))
