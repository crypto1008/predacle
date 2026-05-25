import { Market } from '../types'
import { createSign } from 'crypto'

const BASE = 'https://api.elections.kalshi.com'

function getKalshiHeaders(method: string, path: string): HeadersInit {
  const keyId         = process.env.KALSHI_API_KEY_ID
  const privateKeyRaw = process.env.KALSHI_PRIVATE_KEY
  if (!keyId || !privateKeyRaw || keyId === 'placeholder') return {}

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n').replace(/\\r/g, '').trim()
  const timestamp  = Date.now().toString()
  const message    = `${timestamp}${method}${path.split('?')[0]}`

  try {
    const sign = createSign('RSA-SHA256')
    sign.update(message)
    sign.end()
    const sig = sign.sign(privateKey, 'base64')
    return {
      'KALSHI-ACCESS-KEY':       keyId,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
      'KALSHI-ACCESS-SIGNATURE': sig,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    }
  } catch (e: any) {
    console.error('Kalshi signing error:', e.message)
    return {}
  }
}

const SERIES: { ticker: string; category: string }[] = [
  { ticker: 'KXNBAGAME',      category: 'sports'    },
  { ticker: 'KXMLBGAME',      category: 'sports'    },
  { ticker: 'KXNHLGAME',      category: 'sports'    },
  { ticker: 'KXWNBAGAME',     category: 'sports'    },
  { ticker: 'KXMLSGAME',      category: 'sports'    },
  { ticker: 'KXUCLGAME',      category: 'sports'    },
  { ticker: 'KXATPMATCH',     category: 'sports'    },
  { ticker: 'KXWTAMATCH',     category: 'sports'    },
  { ticker: 'KXUFCFIGHT',     category: 'sports'    },
  { ticker: 'KXEPLGOAL',      category: 'sports'    },
  { ticker: 'KXNBASERIES',    category: 'sports'    },
  { ticker: 'KXNHLSERIES',    category: 'sports'    },
  { ticker: 'KXNBAEAST',      category: 'sports'    },
  { ticker: 'KXNBAWEST',      category: 'sports'    },
  { ticker: 'KXPGATOUR',      category: 'sports'    },
  { ticker: 'KXBTCD',         category: 'crypto'    },
  { ticker: 'KXBTC',          category: 'crypto'    },
  { ticker: 'KXETHD',         category: 'crypto'    },
  { ticker: 'KXETH',          category: 'crypto'    },
  { ticker: 'KXFEDDECISION',  category: 'economics' },
  { ticker: 'KXCPIYOY',       category: 'economics' },
  { ticker: 'KXINXU',         category: 'economics' },
  { ticker: 'KXNASDAQ100U',   category: 'economics' },
  { ticker: 'KXAAAGASM',      category: 'economics' },
  { ticker: 'KXNEXTPOPE',     category: 'politics'  },
  { ticker: 'KXCANADAPM',     category: 'politics'  },
]

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractPrice(m: any): number | null {
  const fields = [
    'yes_ask', 'yes_bid', 'last_price', 'previous_yes_ask',
    'previous_price', 'close_price', 'no_bid',
  ]
  for (const f of fields) {
    const v = Number(m[f])
    if (v > 0 && v < 100) return v
  }
  // no_bid = 100 - yes_ask for Kalshi
  if (m.no_bid !== null && m.no_bid !== undefined) {
    const noBid = Number(m.no_bid)
    if (noBid > 0 && noBid < 100) return 100 - noBid
  }
  return null
}

function mapMarket(m: any, category: string): Market {
  const ticker = m.ticker || ''
  const priceCents = extractPrice(m)
  const probability = priceCents !== null ? priceCents / 100 : null

  const volRaw = m.dollar_volume ?? m.volume_24h ?? m.volume ?? null
  const vol    = Number(volRaw) > 0 ? Number(volRaw) * 0.01 : null

  const series = (m.series_ticker || ticker.split('-')[0] || '').toLowerCase()
  const url    = series ? `https://kalshi.com/markets/${series}` : 'https://kalshi.com'

  return {
    id:       `kalshi-${ticker}`,
    platform: 'kalshi' as const,
    question: m.title || ticker,
    probability,
    volume: vol,
    volume_label: vol && vol > 0
      ? vol >= 1_000_000 ? `$${(vol / 1_000_000).toFixed(1)}M`
      : `$${Math.round(vol).toLocaleString()}` : null,
    end_date: m.close_time
      ? new Date(m.close_time).toISOString().split('T')[0] : null,
    end_date_label: m.close_time
      ? new Date(m.close_time).toLocaleDateString('en-US',
          { month: 'short', year: 'numeric' }) : null,
    traders:    null,
    category,
    url,
    status:     'active' as const,
    fetched_at: new Date().toISOString(),
  }
}

async function fetchIndividualMarket(ticker: string): Promise<any | null> {
  try {
    const path    = `/trade-api/v2/markets/${ticker}`
    const headers = getKalshiHeaders('GET', path)
    if (Object.keys(headers).length === 0) return null
    const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return data.market || data
  } catch { return null }
}

export async function fetchKalshi(): Promise<Market[]> {
  const keyId = process.env.KALSHI_API_KEY_ID
  if (!keyId || keyId === 'placeholder') return []

  const nowTs = Math.floor(Date.now() / 1000)
  const seen        = new Set<string>()
  const allMarkets: Market[] = []
  const hitSeries:  string[] = []
  let   debugDone   = false

  for (const { ticker: series, category } of SERIES) {
    try {
      const path    = `/trade-api/v2/markets?limit=10&status=open&series_ticker=${series}&min_close_ts=${nowTs}`
      const headers = getKalshiHeaders('GET', path)
      if (Object.keys(headers).length === 0) continue

      const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })
      if (res.status === 429) { console.log('Kalshi: rate limited'); break }
      if (!res.ok) { await sleep(100); continue }

      const data    = await res.json()
      const markets = data.markets || []
      if (markets.length === 0) { await sleep(120); continue }

      hitSeries.push(`${series}(${markets.length})`)

      // DEBUG ONCE: fetch individual market to check if it has prices
      if (!debugDone && markets.length > 0) {
        const firstTicker = markets[0].ticker
        console.log(`KALSHI_DEBUG: fetching individual market ${firstTicker}`)
        const detail = await fetchIndividualMarket(firstTicker)
        if (detail) {
          console.log('KALSHI_INDV_FIELDS:', Object.keys(detail).join('|'))
          console.log('KALSHI_INDV_PRICES:', JSON.stringify({
            ticker:        detail.ticker,
            yes_ask:       detail.yes_ask,
            yes_bid:       detail.yes_bid,
            no_ask:        detail.no_ask,
            no_bid:        detail.no_bid,
            last_price:    detail.last_price,
            volume:        detail.volume,
            dollar_volume: detail.dollar_volume,
            open_interest: detail.open_interest,
          }))

          // If individual market has price — use it for this market
          const priceFromDetail = extractPrice(detail)
          if (priceFromDetail !== null) {
            console.log(`KALSHI_INDV_PRICE_FOUND: ${priceFromDetail} cents = ${priceFromDetail}%`)
            // Use detail data for first market
            if (!seen.has(detail.ticker)) {
              seen.add(detail.ticker)
              allMarkets.push(mapMarket(detail, category))
            }
            debugDone = true
            // Process rest of list markets normally
            for (const m of markets.slice(1)) {
              if (!m.ticker || seen.has(m.ticker)) continue
              seen.add(m.ticker)
              allMarkets.push(mapMarket(m, category))
            }
            await sleep(120)
            continue
          }
        }
        debugDone = true
      }

      for (const m of markets) {
        if (!m.ticker || seen.has(m.ticker)) continue
        seen.add(m.ticker)
        allMarkets.push(mapMarket(m, category))
      }

      await sleep(120)

    } catch (e: any) {
      console.error(`Kalshi ${series}:`, e.message)
    }
  }

  const withProb = allMarkets.filter(m => m.probability !== null).length
  console.log(`Kalshi: ${allMarkets.length} total — [${hitSeries.join(', ')}]`)
  console.log(`Kalshi: ${withProb}/${allMarkets.length} with probability`)

  return allMarkets
}