// test-signals.mjs
// Samples markets across the probability range, asks the live AI endpoint for a
// signal on each, and reports the distribution — so you can confirm the signal
// is now a varied value/edge read instead of reflexively BEARISH.
//
// Run:  node ~/Downloads/test-signals.mjs
// (Defaults to production. For local: BASE=http://localhost:3000 node test-signals.mjs)

const BASE = process.env.BASE || 'https://predacle.vercel.app'

const trunc = (s, n) => {
  s = (s || '').replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getMarkets() {
  const res = await fetch(`${BASE}/api/markets?limit=120`)
  const data = await res.json()
  const list = Array.isArray(data) ? data : data.markets || data.data || []
  return list.filter((m) => m && m.probability !== null && m.probability !== undefined)
}

function sample(markets) {
  const take = (arr, n) => arr.slice(0, n)
  const hi   = take(markets.filter((m) => m.probability >= 0.9), 5)
  const lo   = take(markets.filter((m) => m.probability <= 0.1), 5)
  const mid  = take(markets.filter((m) => m.probability > 0.4 && m.probability < 0.6), 4)
  const rest = take(markets.filter((m) => (m.probability > 0.1 && m.probability <= 0.4) || (m.probability >= 0.6 && m.probability < 0.9)), 4)
  // de-dup by id
  const seen = new Set()
  return [...hi, ...lo, ...mid, ...rest].filter((m) => !seen.has(m.id) && seen.add(m.id))
}

async function getSignal(m) {
  try {
    const res = await fetch(`${BASE}/api/ai/market-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m),
    })
    if (!res.ok) return { signal: `ERR(${res.status})` }
    return await res.json()
  } catch (e) {
    return { signal: 'ERR(fetch)' }
  }
}

const markets = await getMarkets()
if (markets.length === 0) {
  console.log('No markets with a probability returned from /api/markets — nothing to test.')
  process.exit(0)
}

const picked = sample(markets).sort((a, b) => b.probability - a.probability)
console.log(`\nTesting ${picked.length} markets via ${BASE}`)
console.log('(first run generates fresh summaries — give it ~30-60s)\n')
console.log('PROB  SIGNAL    QUESTION')
console.log('----  --------  --------------------------------------------------')

const counts = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0, OTHER: 0 }
const hiResults = []

for (const m of picked) {
  const r = await getSignal(m)
  const sig = (r.signal || '?').toString()
  if (counts[sig] !== undefined) counts[sig]++
  else counts.OTHER++
  const pct = Math.round(m.probability * 100)
  if (m.probability >= 0.9) hiResults.push({ pct, sig })
  console.log(`${String(pct).padStart(3)}%  ${sig.padEnd(8)}  ${trunc(m.question, 50)}`)
  if (r.signal_reason) console.log(`            ${trunc(r.signal_reason, 78)}`)
  await sleep(200)
}

console.log('\n----------------------------------------')
console.log('Distribution:', counts)

const total = counts.BULLISH + counts.BEARISH + counts.NEUTRAL
if (total === 0) {
  console.log('⚠  No valid signals came back — check that the endpoint and GEMINI_API_KEY are live.')
} else if (counts.BEARISH === total) {
  console.log('⚠  Every signal is still BEARISH — the cache may not be cleared, or the deploy/prompt did not take. Re-check.')
} else {
  console.log('✓  Signals vary across the range — the value/edge framing is working.')
}

if (hiResults.length) {
  const hiBearish = hiResults.filter((r) => r.sig === 'BEARISH').length
  console.log(`\nHigh-probability (>=90%) markets: ${hiResults.length} tested, ${hiBearish} flagged BEARISH.`)
  console.log(hiBearish === hiResults.length && hiResults.length > 1
    ? '   ⚠  All favorites still BEARISH — the old reflex may persist.'
    : '   ✓  Favorites are no longer reflexively BEARISH.')
}
