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

// Confirmed real Kalshi series tickers from their public volume reports
const SERIES: { ticker: string; category: string }[] = [
  // ── Daily Sports (highest volume) ──────────────
  { ticker: 'KXNBAGAME',    category: 'sports'    }, // NBA game winners ✅
  { ticker: 'KXMLBGAME',    category: 'sports'    }, // MLB game winners ✅
  { ticker: 'KXNHLGAME',    category: 'sports'    }, // NHL game winners ✅
  { ticker: 'KXWNBAGAME',   category: 'sports'    }, // WNBA game winners ✅
  { ticker: 'KXMLSGAME',    category: 'sports'    }, // MLS match winners ✅
  { ticker: 'KXUCLGAME',    category: 'sports'    }, // Champions League games ✅
  { ticker: 'KXATPMATCH',   category: 'sports'    }, // ATP tennis matches ✅
  { ticker: 'KXWTAMATCH',   category: 'sports'    }, // WTA tennis matches ✅
  { ticker: 'KXUFCFIGHT',   category: 'sports'    }, // UFC fight winners ✅
  { ticker: 'KXEPLGOAL',    category: 'sports'    }, // EPL goals ✅ confirmed
  // ── Playoff Series ──────────────────────────────
  { ticker: 'KXNBASERIES',  category: 'sports'    }, // NBA playoff series ✅
  { ticker: 'KXNHLSERIES',  category: 'sports'    }, // NHL playoff series ✅
  // ── Season/Championship ─────────────────────────
  { ticker: 'KXNBAEAST',    category: 'sports'    }, // NBA Eastern conf ✅
  { ticker: 'KXNBAWEST',    category: 'sports'    }, // NBA Western conf ✅
  { ticker: 'KXPGATOUR',    category: 'sports'    }, // PGA Tour ✅ confirmed
  // ── Daily Crypto (real volume) ──────────────────
  { ticker: 'KXBTCD',       category: 'crypto'    }, // Bitcoin price today ✅
  { ticker: 'KXBTC',        category: 'crypto'    }, // Bitcoin price range ✅
  { ticker: 'KXETHD',       category: 'crypto'    }, // Ethereum price today ✅
  { ticker: 'KXETH',        category: 'crypto'    }, // Ethereum price range ✅
  // ── Economics (high volume) ─────────────────────
  { ticker: 'KXFEDDECISION',  category: 'economics' }, // Fed rate decision ✅
  { ticker: 'KXCPIYOY',       category: 'economics' }, // CPI/Inflation ✅
  { ticker: 'KXINXU',         category: 'economics' }, // S&P 500 today ✅
  { ticker: 'KXNASDAQ100U',   category: 'economics' }, // NASDAQ today ✅
  { ticker: 'KXAAAGASM',      category: 'economics' }, // Gas prices ✅
  // ── Politics ────────────────────────────────────
  { ticker: 'KXNEXTPOPE',     category: 'politics'  }, // Next Pope ✅
  { ticker: 'KXCANADAPM',     category: 'politics'  }, // Canada PM ✅
  { ticker: 'KXMAYORNYCPARTY',category: 'politics'  }, // NYC Mayor ✅
]

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function mapMarket(m: any, category: string): Market {
  const ticker = m.ticker || ''

  let priceCents: number | null = null
  for (const f of ['yes_ask', 'yes_bid', 'last_price', 'previous_yes_ask', 'previous_price']) {
    const v = Number(m[f])
    if (v > 0 && v < 100) { priceCents = v; break }
  }
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

export async function fetchKalshi(): Promise<Market[]> {
  const keyId = process.env.KALSHI_API_KEY_ID
  if (!keyId || keyId === 'placeholder') {
    console.log('Kalshi: no API key')
    return []
  }

  // Only get markets closing in the future
  const nowTs = Math.floor(Date.now() / 1000)

  const seen        = new Set<string>()
  const allMarkets: Market[] = []
  const hitSeries:  string[] = []

  for (const { ticker, category } of SERIES) {
    try {
      const path    = `/trade-api/v2/markets?limit=10&status=open&series_ticker=${ticker}&min_close_ts=${nowTs}`
      const headers = getKalshiHeaders('GET', path)
      if (Object.keys(headers).length === 0) continue

      const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })

      if (res.status === 429) {
        console.log('Kalshi: rate limited — stopping')
        break
      }
      if (!res.ok) {
        await sleep(100)
        continue
      }

      const data    = await res.json()
      const markets = data.markets || []

      if (markets.length > 0) {
        hitSeries.push(`${ticker}(${markets.length})`)
        for (const m of markets) {
          if (!m.ticker || seen.has(m.ticker)) continue
          seen.add(m.ticker)
          allMarkets.push(mapMarket(m, category))
        }
      }

      await sleep(120)

    } catch (e: any) {
      console.error(`Kalshi ${ticker}:`, e.message)
    }
  }

  const withProb = allMarkets.filter(m => m.probability !== null).length
  console.log(`Kalshi: ${allMarkets.length} markets — [${hitSeries.join(', ')}]`)
  console.log(`Kalshi: ${withProb}/${allMarkets.length} with probability`)

  return allMarkets
}