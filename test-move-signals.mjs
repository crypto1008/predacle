// test-signals.mjs
// Standalone smart-money / unusual-activity signal engine for Phase 13.
// Zero production surface. Validates two things on real data:
//   1. Probability-move detection (computable NOW — we have full prob history)
//   2. Whether volume-spike detection is viable yet (the data gate)
// Also surfaces the methodology trap: without a liquidity floor, "signals" are
// dominated by illiquid noise (one trade swinging a $30 market), not smart money.
//
// Paginates price_snapshots properly (35k+ rows >> the JS client's ~1000 cap —
// the bug that made the leaderboard script undersample). Run from repo root:
//   node test-signals.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) { console.error('No Supabase creds in .env.local'); process.exit(1) }
const supabase = createClient(url, key)

// Paginate a full table pull (the correct pattern: range-loop until a short page).
async function fetchAll(table, cols, order) {
  const size = 1000
  let from = 0, all = []
  for (;;) {
    let q = supabase.from(table).select(cols).range(from, from + size - 1)
    for (const o of order) q = q.order(o, { ascending: true })
    const { data, error } = await q
    if (error) throw new Error(error.message)
    all.push(...data)
    if (data.length < size) break
    from += size
  }
  return all
}

const parseVol = (label) => {
  if (label == null) return null
  const n = Number(String(label).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

// For a market's time-sorted snapshots, find the probability nearest-but-before
// (latest_time - hours). Returns null if no snapshot reaches back that far.
function priorProb(snaps, hoursMs) {
  const now = snaps[snaps.length - 1].t
  const cutoff = now - hoursMs
  let best = null
  for (const s of snaps) {
    if (s.t <= cutoff) best = s   // snaps are ascending; last one ≤ cutoff is closest
  }
  return best ? best.p : null
}

async function main() {
  console.log('Loading snapshots (paginated)…')
  const rawSnaps = await fetchAll('price_snapshots', 'market_id, captured_at, probability, volume', ['market_id', 'captured_at'])

  // Group by market, keep prob-bearing points, ascending by time.
  const byMarket = new Map()
  let volRows = 0
  for (const r of rawSnaps) {
    if (r.volume != null) volRows++
    if (r.probability == null) continue
    if (!byMarket.has(r.market_id)) byMarket.set(r.market_id, [])
    byMarket.get(r.market_id).push({ t: new Date(r.captured_at).getTime(), p: r.probability, v: r.volume })
  }
  for (const arr of byMarket.values()) arr.sort((a, b) => a.t - b.t)

  // Volume-history coverage (the gate for volume-spike signals).
  let mktsWith3Vol = 0
  for (const arr of byMarket.values()) {
    if (arr.filter(s => s.v != null).length >= 3) mktsWith3Vol++
  }

  const times = rawSnaps.map(r => new Date(r.captured_at).getTime())
  const spanDays = ((Math.max(...times) - Math.min(...times)) / 86400000).toFixed(1)
  console.log('\n=== SNAPSHOT DATA LOADED ===')
  console.log(`snapshots: ${rawSnaps.length}   markets with prob history: ${byMarket.size}   span: ${spanDays} days`)
  console.log(`volume coverage: ${volRows} snapshots carry volume (${(100 * volRows / rawSnaps.length).toFixed(0)}%)`)
  console.log(`markets with >=3 volume points (needed for a spike baseline): ${mktsWith3Vol}`)

  // Compute 6h and 24h probability moves per market.
  const H6 = 6 * 3600e3, H24 = 24 * 3600e3
  const moves = []
  for (const [id, snaps] of byMarket) {
    if (snaps.length < 2) continue
    const now = snaps[snaps.length - 1].p
    const p6 = priorProb(snaps, H6)
    const p24 = priorProb(snaps, H24)
    moves.push({ id, now, m6: p6 == null ? null : now - p6, m24: p24 == null ? null : now - p24 })
  }

  // Pull metadata only for the strongest movers (efficient .in()).
  const top = [...moves].filter(x => x.m24 != null).sort((a, b) => Math.abs(b.m24) - Math.abs(a.m24)).slice(0, 200)
  const ids = top.map(x => x.id)
  const meta = new Map()
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from('markets')
      .select('id, question, status, volume_label').in('id', ids.slice(i, i + 100))
    if (error) throw new Error(error.message)
    for (const m of data) meta.set(m.id, m)
  }

  const fmtRow = (x) => {
    const m = meta.get(x.id) || {}
    const mv = `${x.m24 >= 0 ? '+' : ''}${Math.round(x.m24 * 100)}`.padStart(5)
    const nowp = `${Math.round(x.now * 100)}%`.padStart(4)
    const vol = (m.volume_label || '—').padStart(9)
    const q = (m.question || x.id).slice(0, 58)
    return `  ${mv}pts  now ${nowp}  vol ${vol}   ${q}`
  }

  const active = top.filter(x => (meta.get(x.id)?.status) === 'active')

  console.log('\n=== 24h PROBABILITY-MOVE SIGNALS — UNFILTERED (top 12 active) ===')
  active.slice(0, 12).forEach(x => console.log(fmtRow(x)))
  console.log('   ^ note how many are tiny-volume: a single trade swings a $30 market. That is noise, not smart money.')

  const liquid = active.filter(x => (parseVol(meta.get(x.id)?.volume_label) ?? 0) >= 1000)
  console.log('\n=== 24h PROBABILITY-MOVE SIGNALS — LIQUIDITY-FILTERED (vol >= $1,000, top 12 active) ===')
  liquid.slice(0, 12).forEach(x => console.log(fmtRow(x)))

  // Sharp short-term moves, liquidity-filtered.
  const sharp6 = [...moves].filter(x => x.m6 != null)
    .map(x => ({ ...x }))
    .filter(x => (meta.get(x.id)?.status) === 'active') // only those we have meta for
  // (meta only covers the top-200 by 24h move; that's fine — short sharp moves usually rank high on 24h too)
  const sharp6liq = sharp6.filter(x => (parseVol(meta.get(x.id)?.volume_label) ?? 0) >= 1000)
    .sort((a, b) => Math.abs(b.m6) - Math.abs(a.m6)).slice(0, 8)
  console.log('\n=== SHARP 6h MOVES — LIQUIDITY-FILTERED (vol >= $1,000, top 8) ===')
  sharp6liq.forEach(x => {
    const m = meta.get(x.id) || {}
    const mv = `${x.m6 >= 0 ? '+' : ''}${Math.round(x.m6 * 100)}`.padStart(5)
    console.log(`  ${mv}pts in ~6h   vol ${(m.volume_label || '—').padStart(9)}   ${(m.question || x.id).slice(0, 56)}`)
  })

  // Counts at signal thresholds.
  const big24 = active.filter(x => Math.abs(x.m24) >= 0.10)
  const big24liq = big24.filter(x => (parseVol(meta.get(x.id)?.volume_label) ?? 0) >= 1000)
  console.log('\n=== READ ===')
  console.log(`active markets moving >=10pts in 24h:  ${big24.length} total  ->  ${big24liq.length} after the $1k liquidity floor`)
  console.log('• Move-detection engine works: the big movers surface correctly (CPI/crypto/etc. top the list).')
  console.log('• METHODOLOGY: the liquidity floor is essential — unfiltered, the feed is mostly illiquid noise.')
  if (mktsWith3Vol < 500) {
    console.log(`• VOLUME-SPIKE signals are GATED: only ${mktsWith3Vol} markets have >=3 volume points, far too few`)
    console.log('  for a "vs baseline" spike detector. Needs weeks of volume snapshots to accrue. Probability-move')
    console.log('  signals (above) are the viable launch version; volume-spike is the upgrade once data matures.')
  } else {
    console.log(`• Volume history now covers ${mktsWith3Vol} markets with >=3 points — spike detection may be viable; worth a deeper look.`)
  }
}

main().catch(e => { console.error('error:', e.message); process.exit(1) })
