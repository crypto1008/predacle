// Polymarket LP scoring validation. Reuses the proven data layer
// (sampling + gamma-by-condition_id), then applies quality filters + LP Score
// and re-ranks, so we can see the scoring behave on real markets.

const SAMP  = 'https://clob.polymarket.com/sampling-simplified-markets'
const GAMMA = 'https://gamma-api.polymarket.com/markets'
const FLOOR = 25     // candidate universe: pools >= $25/day
const SCAN_PAGES = 20, BATCH = 20

async function getJSON(u) {
  const r = await fetch(u, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } })
  if (!r.ok) throw new Error(u.slice(0, 60) + ' -> ' + r.status); return r.json()
}
async function loadUniverse() {
  const out = new Map(); let cur = ''
  for (let i = 0; i < SCAN_PAGES; i++) {
    const d = await getJSON(cur ? `${SAMP}?next_cursor=${encodeURIComponent(cur)}` : SAMP)
    for (const m of (d.data || [])) {
      const rate = Math.max(0, ...((m.rewards?.rates) || []).map(r => Number(r.rewards_daily_rate) || 0))
      if (rate < FLOOR) continue
      const yes = (m.tokens || []).find(t => (t.outcome || '').toLowerCase() === 'yes')
      out.set((m.condition_id || '').toLowerCase(), { rate, minSize: m.rewards?.min_size ?? null, maxSpread: m.rewards?.max_spread ?? null, yesPrice: yes ? Number(yes.price) : null })
    }
    cur = d.next_cursor || ''; if (!cur || cur === 'LTE=' || !(d.data || []).length) break
  }
  return out
}
async function gammaMeta(ids) {
  const idx = new Map()
  for (let i = 0; i < ids.length; i += BATCH) {
    const qs = ids.slice(i, i + BATCH).map(c => `condition_ids=${c}`).join('&')
    let d; try { d = await getJSON(`${GAMMA}?limit=${BATCH}&${qs}`) } catch { continue }
    for (const m of (Array.isArray(d) ? d : d.data || [])) {
      const cid = (m.conditionId || '').toLowerCase(); if (!cid) continue
      idx.set(cid, { question: m.question || '', bid: m.bestBid != null ? Number(m.bestBid) : null, ask: m.bestAsk != null ? Number(m.bestAsk) : null, endDate: m.endDate || m.endDateIso || null, vol: Number(m.volume24hr || 0) })
    }
  }
  return idx
}
const daysUntil = iso => { if (!iso) return null; const t = Date.parse(iso); return Number.isNaN(t) ? null : Math.round((t - Date.now()) / 864e5) }
const clamp01 = x => Math.max(0, Math.min(1, x))

// ---- quality filters: returns an exclusion reason, or null if it passes ----
function excludeReason(o) {
  if (o.days == null || o.days <= 0)            return 'resolved / same-day'
  if (o.price == null)                          return 'no price'
  if (o.price < 0.05 || o.price > 0.95)         return 'extreme price'
  if (o.spread == null)                         return 'no live book'
  if (o.spread > 0.10)                          return 'dead / wide book'
  if (o.vol == null || o.vol < 10000)           return 'low volume'
  return null
}

// ---- sub-scores (0..1) ----
const rewardScore = r => clamp01((Math.log10(r) - 1) / (Math.log10(1000) - 1))        // $10->0, $1000->1
const timeScore   = d => d < 3 ? 0.25 : d <= 45 ? 1 - Math.abs(d - 20) / 40 : clamp01(0.6 - (d - 45) / 600)
const priceScore  = p => (p >= 0.15 && p <= 0.40) ? 1 : p < 0.15 ? clamp01(p / 0.15) : clamp01(1 - (p - 0.40) / 0.55)
const spreadScore = s => clamp01(1 - s / 0.05)
const volScore    = v => clamp01((Math.log10(v) - 4) / (Math.log10(3e6) - 4))

const W = { reward: 0.30, time: 0.20, price: 0.20, spread: 0.15, vol: 0.15 }
function lpScore(o) {
  const p = { reward: rewardScore(o.rate), time: timeScore(o.days), price: priceScore(o.price), spread: spreadScore(o.spread), vol: volScore(o.vol) }
  return Math.round(100 * (p.reward * W.reward + p.time * W.time + p.price * W.price + p.spread * W.spread + p.vol * W.vol))
}

async function main() {
  console.log('Loading + joining (this takes ~20s)...')
  const uni = await loadUniverse()
  const ids = [...uni.keys()]
  const meta = await gammaMeta(ids)
  const all = ids.map(cid => {
    const rw = uni.get(cid), g = meta.get(cid)
    const haveBook = g && g.bid != null && g.ask != null
    const price = haveBook ? (g.bid + g.ask) / 2 : rw.yesPrice
    const spread = haveBook ? +(g.ask - g.bid).toFixed(4) : null
    return { rate: rw.rate, price: price != null ? +Number(price).toFixed(3) : null, spread, maxSpread: rw.maxSpread, minSize: rw.minSize, days: daysUntil(g?.endDate), vol: g?.vol ?? null, q: g?.question || '(no meta)' }
  })

  const reasons = {}; const kept = []
  for (const o of all) { const r = excludeReason(o); if (r) reasons[r] = (reasons[r] || 0) + 1; else kept.push({ ...o, score: lpScore(o) }) }
  kept.sort((a, b) => b.score - a.score)

  console.log(`\nCandidate universe (pool >= $${FLOOR}/day): ${all.length}`)
  console.log(`Excluded by quality filters: ${all.length - kept.length}`)
  for (const [r, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${r}`)
  console.log(`PASSED -> scored opportunities: ${kept.length}\n`)

  const pad = (v, n) => String(v ?? '-').padStart(n), padr = (v, n) => String(v ?? '-').padEnd(n)
  console.log('TOP 25 BY LP SCORE')
  console.log('score  rate/d  price  spread  days  band  minSz     vol  question')
  console.log('-----  ------  -----  ------  ----  ----  -----  ------  ----------------------------------------------')
  for (const r of kept.slice(0, 25)) {
    console.log(pad(r.score, 5) + '  ' + pad('$' + r.rate, 6) + '  ' + pad(r.price, 5) + '  ' + pad(r.spread, 6) + '  ' + pad(r.days, 4) + '  ' + pad(r.maxSpread, 4) + '  ' + pad(r.minSize, 5) + '  ' + pad(r.vol != null ? Math.round(r.vol) : '-', 6) + '  ' + padr(r.q.slice(0, 46), 46))
  }
}
main().catch(e => console.error('error:', e.message))
