// Kalshi LP harness v5 — macro/econ/crypto/politics only (sports excluded).
// Confirms the clean candidate set before building lib/lp/kalshi.ts.

import { readFileSync } from 'node:fs'
import { createSign } from 'node:crypto'

function loadEnv() {
  let txt = ''
  for (const f of ['.env.local', '.env']) { try { txt += readFileSync(f, 'utf8') + '\n' } catch {} }
  const env = {}
  const re = /^[ \t]*([A-Z0-9_]+)[ \t]*=[ \t]*(?:"([\s\S]*?)"|'([\s\S]*?)'|([^\n]*))/gm
  let m
  while ((m = re.exec(txt)) !== null) {
    const v = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : (m[4] ?? '')
    if (env[m[1]] === undefined) env[m[1]] = v
  }
  return env
}

const env = loadEnv()
const BASE = 'https://api.elections.kalshi.com'
const keyId = env.KALSHI_API_KEY_ID
const pkRaw = env.KALSHI_PRIVATE_KEY
if (!keyId || !pkRaw || keyId === 'placeholder') { console.error('Missing Kalshi creds in .env.local'); process.exit(1) }
const privateKey = pkRaw.replace(/\\n/g, '\n').replace(/\\r/g, '').trim()

// Macro / econ / crypto / politics — no single-event sports.
const SERIES = [
  'KXBTC','KXBTCD','KXETH','KXETHD',                                  // crypto price targets
  'KXFEDDECISION','KXCPIYOY','KXINXU','KXNASDAQ100U','KXAAAGASM',     // econ / macro
  'KXNEXTPOPE','KXCANADAPM',                                          // politics
]
const VOL_FLOOR = 1000

function headers(method, path) {
  const ts = Date.now().toString()
  const s = createSign('RSA-SHA256'); s.update(`${ts}${method}${path.split('?')[0]}`); s.end()
  return { 'KALSHI-ACCESS-KEY': keyId, 'KALSHI-ACCESS-TIMESTAMP': ts, 'KALSHI-ACCESS-SIGNATURE': s.sign(privateKey, 'base64'), 'Accept': 'application/json' }
}
async function get(path) {
  const r = await fetch(`${BASE}${path}`, { headers: headers('GET', path) })
  const t = await r.text()
  try { return { status: r.status, json: JSON.parse(t) } } catch { return { status: r.status, text: t.slice(0, 200) } }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null }
const daysUntil = iso => { if (!iso) return null; const t = Date.parse(iso); return Number.isNaN(t) ? null : Math.round((t - Date.now()) / 864e5) }
const clamp01 = x => Math.max(0, Math.min(1, x))

function evaluate(m, series) {
  const yb = num(m.yes_bid_dollars), ya = num(m.yes_ask_dollars)
  return {
    series, ticker: m.ticker || '', title: m.title || '',
    price: (yb != null && ya != null) ? (yb + ya) / 2 : null,
    spread: (yb != null && ya != null) ? +(ya - yb).toFixed(4) : null,
    days: daysUntil(m.close_time || m.expiration_time),
    vol: num(m.volume_fp) ?? num(m.volume_24h_fp),
    oi: num(m.open_interest_fp) ?? num(m.open_interest),
  }
}
function excludeReason(e) {
  if (e.price == null) return 'no book'
  if (e.price < 0.03 || e.price > 0.97) return 'extreme price'
  if (e.spread == null || e.spread > 0.10) return 'wide / dead book'
  if (e.days == null || e.days < 2) return 'resolved / too soon'
  if (e.vol == null || e.vol < VOL_FLOOR) return 'low volume'
  return null
}
const timeScore   = d => d < 3 ? 0.3 : d <= 45 ? 1 - Math.abs(d - 20) / 40 : clamp01(0.6 - (d - 45) / 600)
const priceScore  = p => (p >= 0.15 && p <= 0.40) ? 1 : p < 0.15 ? clamp01(p / 0.15) : clamp01(1 - (p - 0.40) / 0.55)
const spreadScore = s => clamp01(1 - s / 0.05)
const actScore    = v => clamp01((Math.log10(v) - 3) / (7 - 3))
const score = e => Math.round(100 * (timeScore(e.days) * 0.30 + priceScore(e.price) * 0.30 + spreadScore(e.spread) * 0.20 + actScore(e.vol) * 0.20))

async function main() {
  console.log('Loading Kalshi macro series...')
  const evals = []; const perSeries = {}
  for (const s of SERIES) {
    const r = await get(`/trade-api/v2/markets?limit=200&status=open&series_ticker=${s}`)
    if (r.status !== 200) { await sleep(150); continue }
    const ms = r.json?.markets || []
    for (const m of ms) evals.push(evaluate(m, s))
    await sleep(220)
  }
  console.log(`Total markets pulled: ${evals.length}\n`)

  const reasons = {}; const kept = []
  for (const e of evals) {
    const r = excludeReason(e)
    if (r) { reasons[r] = (reasons[r] || 0) + 1 }
    else { const k = { ...e, score: score(e) }; kept.push(k); perSeries[e.series] = (perSeries[e.series] || 0) + 1 }
  }
  console.log(`Excluded: ${evals.length - kept.length}`)
  for (const [r, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${r}`)
  console.log(`PASSED -> scored: ${kept.length}`)
  console.log('per-series kept:', JSON.stringify(perSeries), '\n')

  kept.sort((a, b) => b.score - a.score)
  const pad = (v, n) => String(v ?? '-').padStart(n), padr = (v, n) => String(v ?? '-').padEnd(n)
  console.log('ALL KALSHI LP CANDIDATES (no-reward score)')
  console.log('score  price  spread  days       vol  title')
  console.log('-----  -----  ------  ----  --------  --------------------------------------')
  for (const e of kept.slice(0, 40)) {
    console.log(pad(e.score, 5) + '  ' + pad(e.price != null ? +(e.price * 100).toFixed(1) + '¢' : '-', 5) + '  ' +
      pad(e.spread != null ? +(e.spread * 100).toFixed(1) + '¢' : '-', 6) + '  ' + pad(e.days, 4) + '  ' +
      pad(e.vol != null ? Math.round(e.vol) : '-', 8) + '  ' + padr((e.title || '').slice(0, 44), 44))
  }
}
main().catch(e => console.error('error:', e.message))
