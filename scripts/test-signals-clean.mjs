// test-signals-clean.mjs
// Clean real-money signal feed. Fixes two parsing bugs the first run exposed:
//   1. "M$8,545" (Manifold Mana = play money) was read as $8,545 — junk let IN.
//   2. "$1.6M" (millions) was read as $1.6 — real whales filtered OUT.
// Now: exclude Manifold entirely (real money only), parse K/M/B suffixes
// correctly, and separate "live repricing" from "settling toward resolution".
//   node test-signals-clean.mjs

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

async function fetchAll(table, cols, order) {
  const size = 1000; let from = 0, all = []
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

// Robust volume parse. Mana ("M$…") -> null (play money, never real liquidity).
// Handles "$1.6M" / "$420K" / "$3,689" correctly.
const parseVol = (label) => {
  if (label == null) return null
  const s = String(label).trim()
  if (/^M\$/i.test(s)) return null                     // Manifold Mana
  const m = s.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*([KMB])?/i)
  if (!m) return null
  let n = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  const suf = (m[2] || '').toUpperCase()
  if (suf === 'K') n *= 1e3; else if (suf === 'M') n *= 1e6; else if (suf === 'B') n *= 1e9
  return n
}

function priorProb(snaps, hoursMs) {
  const now = snaps[snaps.length - 1].t, cutoff = now - hoursMs
  let best = null
  for (const s of snaps) if (s.t <= cutoff) best = s
  return best ? best.p : null
}

async function main() {
  console.log('Loading snapshots (paginated)…')
  const rawSnaps = await fetchAll('price_snapshots', 'market_id, captured_at, probability, volume', ['market_id', 'captured_at'])

  const byMarket = new Map()
  for (const r of rawSnaps) {
    if (r.probability == null) continue
    if (!byMarket.has(r.market_id)) byMarket.set(r.market_id, [])
    byMarket.get(r.market_id).push({ t: new Date(r.captured_at).getTime(), p: r.probability })
  }
  for (const arr of byMarket.values()) arr.sort((a, b) => a.t - b.t)

  const H6 = 6 * 3600e3, H24 = 24 * 3600e3
  const moves = []
  for (const [id, snaps] of byMarket) {
    if (snaps.length < 2) continue
    const now = snaps[snaps.length - 1].p
    const p6 = priorProb(snaps, H6), p24 = priorProb(snaps, H24)
    moves.push({ id, now, m6: p6 == null ? null : now - p6, m24: p24 == null ? null : now - p24 })
  }

  const top = [...moves].filter(x => x.m24 != null).sort((a, b) => Math.abs(b.m24) - Math.abs(a.m24)).slice(0, 250)
  const ids = top.map(x => x.id)
  const meta = new Map()
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from('markets')
      .select('id, question, status, volume_label, platform').in('id', ids.slice(i, i + 100))
    if (error) throw new Error(error.message)
    for (const m of data) meta.set(m.id, m)
  }

  const isReal = (id) => { const m = meta.get(id); return m && m.platform !== 'manifold' && m.status === 'active' }
  const volOf = (id) => parseVol(meta.get(id)?.volume_label) ?? 0
  const tagOf = (now) => (now <= 0.08 || now >= 0.92) ? 'settling' : 'LIVE'

  const row = (x, mv) => {
    const m = meta.get(x.id) || {}
    const tag = tagOf(x.now).padEnd(8)
    const plat = (m.platform || '?').slice(0, 4).padEnd(4)
    const vol = (m.volume_label || '—').padStart(9)
    return `  ${mv}  ${tag} ${plat} vol ${vol}   ${(m.question || x.id).slice(0, 50)}`
  }

  // Real-money, liquidity-passing 24h movers.
  const liquid = top.filter(x => isReal(x.id) && volOf(x.id) >= 1000)
  console.log('\n=== REAL-MONEY 24h MOVERS  (Manifold excluded, vol >= $1,000) — top 15 ===')
  console.log('   move   tag      plat vol           question')
  liquid.slice(0, 15).forEach(x => console.log(row(x, `${x.m24 >= 0 ? '+' : ''}${Math.round(x.m24 * 100)}`.padStart(5) + 'pts')))

  // The cleanest signal: real money + still contested (not just settling to 0/1).
  const live = liquid.filter(x => tagOf(x.now) === 'LIVE')
  console.log('\n=== LIVE REPRICING ONLY  (real money, still contested 8–92%) — top 10 ===')
  live.slice(0, 10).forEach(x => console.log(row(x, `${x.m24 >= 0 ? '+' : ''}${Math.round(x.m24 * 100)}`.padStart(5) + 'pts')))

  // Sharp 6h, same cleanliness.
  const sharp = liquid.filter(x => x.m6 != null).sort((a, b) => Math.abs(b.m6) - Math.abs(a.m6)).slice(0, 8)
  console.log('\n=== SHARP 6h MOVES  (real money, vol >= $1,000) — top 8 ===')
  sharp.forEach(x => console.log(row(x, `${x.m6 >= 0 ? '+' : ''}${Math.round(x.m6 * 100)}`.padStart(5) + 'pts')))

  // Impact of the fixes.
  const activeTop = top.filter(x => meta.get(x.id)?.status === 'active')
  const manifoldStripped = activeTop.filter(x => meta.get(x.id)?.platform === 'manifold').length
  const millionsRecovered = activeTop.filter(x => /\$[\d.]+\s*[MB]\b/i.test(meta.get(x.id)?.volume_label || '') && meta.get(x.id)?.platform !== 'manifold').length
  console.log('\n=== READ ===')
  console.log(`real-money liquid 24h movers: ${liquid.length}   of which LIVE (contested): ${live.length}   settling: ${liquid.length - live.length}`)
  console.log(`fix #1 — Manifold (play money) stripped from the top movers: ${manifoldStripped}`)
  console.log(`fix #2 — million-$ real markets the old parser wrongly excluded, now counted: ${millionsRecovered}`)
  console.log('• LIVE list = genuine smart-money repricing on real-money markets — the launch-grade signal feed.')
  console.log('• "settling" rows are mostly games/markets converging to their outcome — context, not signal.')
}

main().catch(e => { console.error('error:', e.message); process.exit(1) })
