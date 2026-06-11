// Polymarket LP validation v2.
// - Scans the reward universe and prints the reward-tier distribution.
// - Fixes the meta join: fetch gamma BY condition_id (batched) for the markets
//   we actually care about, instead of volume-scanning the top 1000.

const SAMP  = 'https://clob.polymarket.com/sampling-simplified-markets'
const GAMMA = 'https://gamma-api.polymarket.com/markets'
const RATE_FLOOR = 1     // collect everything >= 1, then tier
const SCAN_PAGES = 20    // pages of 1000 to scan for the universe
const JOIN_RATE  = 25    // build the leaderboard on pools >= $25/day
const BATCH      = 20    // condition_ids per gamma request

async function getJSON(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } })
  if (!r.ok) throw new Error(url.slice(0, 70) + ' -> ' + r.status)
  return r.json()
}

async function loadUniverse() {
  const out = new Map(); let cursor = ''
  for (let i = 0; i < SCAN_PAGES; i++) {
    const url = cursor ? `${SAMP}?next_cursor=${encodeURIComponent(cursor)}` : SAMP
    const d = await getJSON(url); const data = d.data || []
    for (const m of data) {
      const rate = Math.max(0, ...((m.rewards?.rates) || []).map(r => Number(r.rewards_daily_rate) || 0))
      if (rate < RATE_FLOOR) continue
      const yes = (m.tokens || []).find(t => (t.outcome || '').toLowerCase() === 'yes')
      out.set((m.condition_id || '').toLowerCase(), {
        rate, minSize: m.rewards?.min_size ?? null, maxSpread: m.rewards?.max_spread ?? null,
        yesPrice: yes ? Number(yes.price) : null,
      })
    }
    cursor = d.next_cursor || ''
    if (!cursor || cursor === 'LTE=' || data.length === 0) break
  }
  return out
}

async function gammaByConditionIds(ids) {
  const idx = new Map(); let firstBatchCount = null
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const qs = batch.map(c => `condition_ids=${c}`).join('&')
    let d; try { d = await getJSON(`${GAMMA}?limit=${BATCH}&${qs}`) } catch { continue }
    const list = Array.isArray(d) ? d : (d.data || [])
    if (firstBatchCount === null) firstBatchCount = list.length
    for (const m of list) {
      const cid = (m.conditionId || '').toLowerCase(); if (!cid) continue
      idx.set(cid, {
        question: m.question || '', bid: m.bestBid != null ? Number(m.bestBid) : null,
        ask: m.bestAsk != null ? Number(m.bestAsk) : null,
        endDate: m.endDate || m.endDateIso || null, vol: Number(m.volume24hr || 0),
      })
    }
  }
  console.log(`(diagnostic: first gamma batch of ${BATCH} ids returned ${firstBatchCount} markets)`)
  return idx
}

function daysUntil(iso) { if (!iso) return null; const t = Date.parse(iso); return Number.isNaN(t) ? null : Math.round((t - Date.now()) / 86400000) }

async function main() {
  console.log('Scanning reward universe...')
  const uni = await loadUniverse()
  const rates = [...uni.values()].map(v => v.rate)
  const tier = min => rates.filter(r => r >= min).length
  console.log(`\nREWARD-TIER DISTRIBUTION (daily pool $):`)
  console.log(`  >=1: ${tier(1)}   >=10: ${tier(10)}   >=25: ${tier(25)}   >=50: ${tier(50)}   >=100: ${tier(100)}   >=250: ${tier(250)}   >=500: ${tier(500)}`)

  const target = [...uni.entries()].filter(([, v]) => v.rate >= JOIN_RATE).map(([cid]) => cid)
  console.log(`\nBuilding meta join for ${target.length} markets with pool >= $${JOIN_RATE}/day...`)
  const gamma = await gammaByConditionIds(target)
  const joined = target.filter(c => gamma.has(c)).length
  console.log(`gamma-by-condition_id matched: ${joined}/${target.length} (${target.length ? Math.round(joined / target.length * 100) : 0}%)\n`)

  const rows = target.map(cid => {
    const rw = uni.get(cid), g = gamma.get(cid)
    const haveBook = g && g.bid != null && g.ask != null
    const price = haveBook ? (g.bid + g.ask) / 2 : rw.yesPrice
    const spread = haveBook ? +(g.ask - g.bid).toFixed(4) : null
    return { rate: rw.rate, price: price != null ? +Number(price).toFixed(3) : null, spread,
      maxSpread: rw.maxSpread, minSize: rw.minSize, days: daysUntil(g?.endDate), vol: g?.vol ?? null,
      q: g?.question || '(no meta)' }
  }).sort((a, b) => b.rate - a.rate)

  const pad = (v, n) => String(v ?? '-').padStart(n), padr = (v, n) => String(v ?? '-').padEnd(n)
  console.log('TOP 25 (pool >= $' + JOIN_RATE + '/day), by daily reward')
  console.log('rate/d  price  spread  band  minSz  days     vol  question')
  console.log('------  -----  ------  ----  -----  ----  ------  ----------------------------------------------')
  for (const r of rows.slice(0, 25)) {
    console.log(pad('$' + r.rate, 6) + '  ' + pad(r.price, 5) + '  ' + pad(r.spread, 6) + '  ' +
      pad(r.maxSpread, 4) + '  ' + pad(r.minSize, 5) + '  ' + pad(r.days, 4) + '  ' +
      pad(r.vol != null ? Math.round(r.vol) : '-', 6) + '  ' + padr(r.q.slice(0, 46), 46))
  }
}
main().catch(e => console.error('error:', e.message))
