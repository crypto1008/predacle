import { readFileSync } from 'node:fs'
import { createSign } from 'node:crypto'

// Robust .env reader: handles multi-line quoted values (e.g. a PEM private key
// stored across several lines in double or single quotes), as well as plain
// single-line values.
function loadEnv() {
  let txt = ''
  for (const f of ['.env.local', '.env']) { try { txt += readFileSync(f, 'utf8') + '\n' } catch {} }
  const env = {}
  const re = /^[ \t]*([A-Z0-9_]+)[ \t]*=[ \t]*(?:"([\s\S]*?)"|'([\s\S]*?)'|([^\n]*))/gm
  let m
  while ((m = re.exec(txt)) !== null) {
    const key = m[1]
    const val = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : (m[4] ?? '')
    if (env[key] === undefined) env[key] = val
  }
  return env
}

const env = loadEnv()
const BASE = 'https://api.elections.kalshi.com'
const keyId = env.KALSHI_API_KEY_ID
const pkRaw = env.KALSHI_PRIVATE_KEY
if (!keyId || !pkRaw || keyId === 'placeholder') {
  console.error('Missing KALSHI_API_KEY_ID / KALSHI_PRIVATE_KEY in .env.local')
  process.exit(1)
}
// Convert escaped "\n" to real newlines if present; leave real newlines as-is.
const privateKey = pkRaw.replace(/\\n/g, '\n').replace(/\\r/g, '').trim()

function headers(method, path) {
  const ts = Date.now().toString()
  const msg = `${ts}${method}${path.split('?')[0]}`
  const s = createSign('RSA-SHA256'); s.update(msg); s.end()
  const sig = s.sign(privateKey, 'base64')
  return { 'KALSHI-ACCESS-KEY': keyId, 'KALSHI-ACCESS-TIMESTAMP': ts, 'KALSHI-ACCESS-SIGNATURE': sig, 'Accept': 'application/json' }
}

async function get(path) {
  const r = await fetch(`${BASE}${path}`, { headers: headers('GET', path) })
  const t = await r.text()
  try { return { status: r.status, json: JSON.parse(t) } } catch { return { status: r.status, text: t.slice(0, 400) } }
}

async function main() {
  console.log('key parsed: starts', JSON.stringify(privateKey.slice(0, 28)), '| length', privateKey.length, '\n')

  const ml = await get('/trade-api/v2/markets?limit=1&status=open')
  console.log('=== /markets status', ml.status, '===')
  const mkt = ml.json?.markets?.[0]
  if (!mkt) { console.log(JSON.stringify(ml).slice(0, 500)); return }
  console.log('MARKET KEYS:', Object.keys(mkt).sort().join(', '))
  const cand = ['ticker','title','yes_bid','yes_ask','yes_bid_dollars','yes_ask_dollars',
    'liquidity','liquidity_dollars','open_interest','volume','volume_24h','tick_size','notional_value']
  console.log('\nCANDIDATE FIELDS:')
  console.log(JSON.stringify(Object.fromEntries(cand.map(k => [k, mkt[k]])), null, 2))

  const ob = await get(`/trade-api/v2/markets/${mkt.ticker}/orderbook?depth=5`)
  console.log('\n=== /orderbook status', ob.status, '===')
  console.log(JSON.stringify(ob.json ?? ob.text, null, 2).slice(0, 900))
}
main().catch(e => console.error('probe error:', e.message))
