// Resolution-outcome validation probe. Pulls recently-closed Polymarket +
// Kalshi markets from Supabase, fetches each platform's TRUE resolved outcome,
// and prints it next to our last-known probability so we can sanity-check
// before building resolution capture into the cron.

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
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY
if (!SUPA_URL || !SUPA_KEY) { console.error('Missing Supabase env (looked for NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'); process.exit(1) }

const KALSHI_BASE = 'https://api.elections.kalshi.com'
const keyId = env.KALSHI_API_KEY_ID
const pkRaw = env.KALSHI_PRIVATE_KEY
const privateKey = pkRaw ? pkRaw.replace(/\\n/g, '\n').replace(/\\r/g, '').trim() : null

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function supa(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } })
  const t = await r.text()
  try { return JSON.parse(t) } catch { return { _error: t.slice(0, 200), _status: r.status } }
}

function kalshiHeaders(method, path) {
  if (!keyId || !privateKey) return null
  const ts = Date.now().toString()
  const s = createSign('RSA-SHA256'); s.update(`${ts}${method}${path.split('?')[0]}`); s.end()
  return { 'KALSHI-ACCESS-KEY': keyId, 'KALSHI-ACCESS-TIMESTAMP': ts, 'KALSHI-ACCESS-SIGNATURE': s.sign(privateKey, 'base64'), 'Accept': 'application/json' }
}

async function polymarketOutcome(cid) {
  try {
    const r = await fetch(`https://gamma-api.polymarket.com/markets?condition_ids=${cid}`)
    const arr = await r.json()
    const m = Array.isArray(arr) ? arr[0] : null
    if (!m) return { outcome: 'NOT FOUND' }
    let prices = m.outcomePrices
    if (typeof prices === 'string') { try { prices = JSON.parse(prices) } catch {} }
    let outcome = 'unknown'
    if (Array.isArray(prices) && prices.length >= 2) {
      if (String(prices[0]) === '1') outcome = 'yes'
      else if (String(prices[1]) === '1') outcome = 'no'
    }
    return { outcome, closed: m.closed, prices }
  } catch (e) { return { outcome: 'ERROR', err: e.message } }
}

async function kalshiOutcome(ticker) {
  const path = `/trade-api/v2/markets/${ticker}`
  const headers = kalshiHeaders('GET', path)
  if (!headers) return { outcome: 'NO CREDS' }
  try {
    const r = await fetch(`${KALSHI_BASE}${path}`, { headers })
    const j = await r.json()
    const m = j?.market
    if (!m) return { outcome: 'NOT FOUND', status: r.status }
    return { outcome: m.result || 'unknown', status: m.status }
  } catch (e) { return { outcome: 'ERROR', err: e.message } }
}

async function main() {
  const rows = await supa('markets?status=eq.closed&platform=in.(polymarket,kalshi)&select=id,platform,question,probability,url&order=fetched_at.desc&limit=14')
  if (!Array.isArray(rows)) { console.log('Supabase query failed:', rows); return }
  console.log(`Found ${rows.length} recently-closed Polymarket/Kalshi markets\n`)

  for (const m of rows) {
    let res
    if (m.platform === 'polymarket') {
      const cid = m.id.startsWith('polymarket-') ? m.id.slice('polymarket-'.length) : m.id
      res = await polymarketOutcome(cid)
    } else {
      const ticker = m.id.startsWith('kalshi-') ? m.id.slice('kalshi-'.length) : m.id
      res = await kalshiOutcome(ticker)
      await sleep(200)
    }
    const prob = m.probability != null ? `${(m.probability * 100).toFixed(0)}%` : '—'
    console.log(`[${m.platform}] id=${m.id}`)
    console.log(`   last prob ${prob}  ->  TRUE OUTCOME: ${res.outcome}   ${JSON.stringify(res).slice(0, 150)}`)
    console.log(`   Q: ${(m.question || '').slice(0, 72)}\n`)
  }
}
main().catch(e => console.error('error:', e.message))
