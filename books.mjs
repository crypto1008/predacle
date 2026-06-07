// books.mjs — fetch REAL best asks from Kalshi & Polymarket public order books.
// Resolves hostnames via 1.1.1.1, then connects directly to the IP with correct
// SNI + Host header — routes around ISP DNS tampering. No auth, no install.
//
//   Kalshi:     GET external-api.kalshi.com/trade-api/v2/markets/{ticker}/orderbook
//   Polymarket: GET clob.polymarket.com/markets/{conditionId}   -> tokens[{outcome,token_id,winner}]
//               GET clob.polymarket.com/book?token_id=..         -> { bids, asks }  (404 = no active book)
//
// Kalshi gotcha: orderbook is resting BIDS only -> askYes = 1 - bestNoBid.
// Polymarket /book gives asks directly; best ask to buy = lowest ask.

import https from 'node:https'
import dns from 'node:dns'

const KALSHI = 'https://external-api.kalshi.com/trade-api/v2'
const CLOB   = 'https://clob.polymarket.com'
const GAMMA  = 'https://gamma-api.polymarket.com'

const resolver = new dns.promises.Resolver()
resolver.setServers(['1.1.1.1', '1.0.0.1'])
const dnsCache = new Map()
async function resolveIP(host) {
  if (dnsCache.has(host)) return dnsCache.get(host)
  const ips = await resolver.resolve4(host)
  if (!ips.length) throw new Error(`no A record for ${host}`)
  dnsCache.set(host, ips[0]); return ips[0]
}

async function req(url) {
  const u = new URL(url)
  let ip
  try { ip = await resolveIP(u.hostname) } catch (e) { throw new Error(`dns fail (${e.code || e.message}) for ${u.hostname}`) }
  return new Promise((resolve, reject) => {
    const r = https.request(
      { host: ip, servername: u.hostname, path: u.pathname + u.search, method: 'GET',
        headers: { accept: 'application/json', host: u.hostname }, timeout: 15000 },
      (res) => {
        let body = ''
        res.on('data', d => (body += d))
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300)
            return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          try { resolve(JSON.parse(body)) } catch { reject(new Error(`bad JSON from ${url}`)) }
        })
      })
    r.on('timeout', () => r.destroy(new Error('timeout')))
    r.on('error', e => reject(new Error(`network fail (${e.code || e.message}) for ${url}`)))
    r.end()
  })
}
const getJSON = req
const toDollar = (p) => { const v = Number(p); return v > 1.5 ? v / 100 : v }

export async function kalshiAsks(ticker) {
  const t = String(ticker).replace(/^kalshi-/, '')
  const d = await getJSON(`${KALSHI}/markets/${encodeURIComponent(t)}/orderbook`)
  const ob = d.orderbook ?? d.orderbook_fp ?? d
  const yes = ob.yes_dollars ?? ob.yes ?? []
  const no  = ob.no_dollars  ?? ob.no  ?? []
  const bestBid = (lv) => lv.reduce((m, x) => Math.max(m, toDollar(x[0])), 0)
  const bestYesBid = bestBid(yes), bestNoBid = bestBid(no)
  return {
    venue: 'kalshi', ticker: t,
    askYes: bestNoBid ? +(1 - bestNoBid).toFixed(4) : null,   // cost to BUY Yes
    askNo:  bestYesBid ? +(1 - bestYesBid).toFixed(4) : null, // cost to BUY No
    bestYesBid, bestNoBid,
    note: (bestYesBid === 0 && bestNoBid === 0) ? 'empty book (settled/closed?)' : null,
  }
}

export async function polymarketAsks(conditionId) {
  const cid = String(conditionId).replace(/^polymarket-/, '')
  const m = await getJSON(`${CLOB}/markets/${cid}`)
  const tokens = m.tokens || []
  if (!tokens.length) throw new Error(`clob: no tokens for ${cid}`)
  const byOutcome = {}
  for (const tk of tokens) {
    let ask = null, note = null
    try {                                            // one token's 404 must not kill the rest
      const book = await getJSON(`${CLOB}/book?token_id=${tk.token_id}`)
      const asks = (book.asks || []).map(a => Number(a.price)).filter(Number.isFinite)
      ask = asks.length ? Math.min(...asks) : null
      if (ask == null) note = 'no resting asks'
    } catch (e) { note = /HTTP 404/.test(e.message) ? 'no active book' : e.message }
    byOutcome[tk.outcome ?? tk.token_id] = { tokenId: tk.token_id, ask, winner: tk.winner ?? null, note }
  }
  return {
    venue: 'polymarket', conditionId: cid, question: m.question,
    active: m.active ?? null, closed: m.closed ?? null, acceptingOrders: m.accepting_orders ?? null,
    outcomes: byOutcome,
  }
}

async function ping(url) {
  const t0 = Date.now(); const u = new URL(url)
  let ip
  try { ip = await resolveIP(u.hostname) } catch (e) { return `  DNSFAIL ${e.message}  ${url}` }
  return new Promise((resolve) => {
    const r = https.request(
      { host: ip, servername: u.hostname, path: u.pathname + u.search, method: 'GET',
        headers: { host: u.hostname }, timeout: 15000 },
      (res) => { res.resume(); resolve(`  ${res.statusCode}  ${url}  (${Date.now() - t0}ms)`) })
    r.on('timeout', () => { r.destroy(); resolve(`  TIMEOUT  ${url}`) })
    r.on('error', e => resolve(`  FAIL ${e.code || e.message}  ${url}`))
    r.end()
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , kind, arg] = process.argv
  try {
    if (kind === 'kalshi')      console.log(JSON.stringify(await kalshiAsks(arg), null, 2))
    else if (kind === 'poly')   console.log(JSON.stringify(await polymarketAsks(arg), null, 2))
    else if (kind === 'ping') {
      console.log('host reachability (resolve via 1.1.1.1, connect to IP):')
      console.log(await ping(`${KALSHI}/markets?limit=1`))
      console.log(await ping(`${CLOB}/ok`))
      console.log(await ping(`${GAMMA}/markets?limit=1`))
    } else {
      console.log('usage:\n  node books.mjs ping\n  node books.mjs kalshi <ticker>\n  node books.mjs poly <0x-condition-id>')
    }
  } catch (e) { console.error('ERR:', e.message) }
}
