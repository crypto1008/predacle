import { Market } from '../types'
import { createSign } from 'crypto'

const BASE = 'https://api.elections.kalshi.com'

function getKalshiHeaders(method: string, path: string): Record<string, string> {
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

// Confirmed Kalshi series tickers from public volume reports
const SERIES: { ticker: string; category: string }[] = [
  // Daily Sports
  { ticker: 'KXNBAGAME',    category: 'sports'    },
  { ticker: 'KXMLBGAME',    category: 'sports'    },
  { ticker: 'KXNHLGAME',    category: 'sports'    },
  { ticker: 'KXWNBAGAME',   category: 'sports'    },
  { ticker: 'KXMLSGAME',    category: 'sports'    },
  { ticker: 'KXUCLGAME',    category: 'sports'    },
  { ticker: 'KXATPMATCH',   category: 'sports'    },
  { ticker: 'KXWTAMATCH',   category: 'sports'    },
  { ticker: 'KXUFCFIGHT',   category: 'sports'    },
  { ticker: 'KXEPLGOAL',    category: 'sports'    },
  // Playoff Series
  { ticker: 'KXNBASERIES',  category: 'sports'    },
  { ticker: 'KXNHLSERIES',  category: 'sports'    },
  { ticker: 'KXNBAEAST',    category: 'sports'    },
  { ticker: 'KXNBAWEST',    category: 'sports'    },
  { ticker: 'KXPGATOUR',    category: 'sports'    },
  // Daily Crypto
  { ticker: 'KXBTCD',       category: 'crypto'    },
  { ticker: 'KXBTC',        category: 'crypto'    },
  { ticker: 'KXETHD',       category: 'crypto'    },
  { ticker: 'KXETH',        category: 'crypto'    },
  // Economics
  { ticker: 'KXFEDDECISION', category: 'economics' },
  { ticker: 'KXCPIYOY',     category: 'economics' },
  { ticker: 'KXINXU',       category: 'economics' },
  { ticker: 'KXNASDAQ100U', category: 'economics' },
  { ticker: 'KXAAAGASM',    category: 'economics' },
  // Politics
  { ticker: 'KXNEXTPOPE',   category: 'politics'  },
  { ticker: 'KXCANADAPM',   category: 'politics'  },
]

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function mapMarket(m: any, category: string): Market {
  const ticker = m.ticker || ''

  // KEY FIX: Kalshi uses _dollars suffix, values are 0.0000–1.0000 range
  let probability: number | null = null
  const priceFields = [
    'yes_ask_dollars',
    'yes_bid_dollars',
    'last_price_dollars',
    'previous_yes_ask_dollars',
    'previous_price_dollars',
  ]
  for (const f of priceFields) {
    const v = parseFloat(m[f] || '0')
    if (v > 0.005 && v < 0.995) { // between 0.5% and 99.5%
      probability = v
      break
    }
  }

  // Volume: _fp = fixed-point contracts, each contract = $1
  const volFp = parseFloat(m.volume_fp || '0')
  const vol24 = parseFloat(m.volume_24h_fp || '0')
  const vol   = volFp > 0 ? volFp : vol24 > 0 ? vol24 : null

  // Fix double-space in title by combining with subtitle
  const question = (m.title || '').replace(/\s+/g, ' ').trim()

  const series = (m.series_ticker || ticker.split('-')[0] || '').toLowerCase()
  const url    = series ? `https://kalshi.com/markets/${series}` : 'https://kalshi.com'

  return {
    id:       `kalshi-${ticker}`,
    platform: 'kalshi' as const,
    question,
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
    traders: m.open_interest
      ? Math.round(parseFloat(String(m.open_interest)))
      : null,
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

  const nowTs       = Math.floor(Date.now() / 1000)
  const seen        = new Set<string>()
  const allMarkets: Market[] = []
  const hitSeries:  string[] = []

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

      if (markets.length > 0) {
        hitSeries.push(`${series}(${markets.length})`)
        for (const m of markets) {
          if (!m.ticker || seen.has(m.ticker)) continue
          seen.add(m.ticker)
          allMarkets.push(mapMarket(m, category))
        }
      }

      await sleep(120)

    } catch (e: any) {
      console.error(`Kalshi ${series}:`, e.message)
    }
  }

  const withProb = allMarkets.filter(m => m.probability !== null).length
  console.log(`Kalshi: ${allMarkets.length} markets — [${hitSeries.join(', ')}]`)
  console.log(`Kalshi: ${withProb}/${allMarkets.length} with probability`)

  return allMarkets
}