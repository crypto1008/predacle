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

const SERIES: { ticker: string; category: string }[] = [
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
  { ticker: 'KXNBASERIES',  category: 'sports'    },
  { ticker: 'KXNHLSERIES',  category: 'sports'    },
  { ticker: 'KXNBAEAST',    category: 'sports'    },
  { ticker: 'KXNBAWEST',    category: 'sports'    },
  { ticker: 'KXPGATOUR',    category: 'sports'    },
  { ticker: 'KXBTCD',       category: 'crypto'    },
  { ticker: 'KXBTC',        category: 'crypto'    },
  { ticker: 'KXETHD',       category: 'crypto'    },
  { ticker: 'KXETH',        category: 'crypto'    },
  { ticker: 'KXFEDDECISION', category: 'economics' },
  { ticker: 'KXCPIYOY',     category: 'economics' },
  { ticker: 'KXINXU',       category: 'economics' },
  { ticker: 'KXNASDAQ100U', category: 'economics' },
  { ticker: 'KXAAAGASM',    category: 'economics' },
  { ticker: 'KXNEXTPOPE',   category: 'politics'  },
  { ticker: 'KXCANADAPM',   category: 'politics'  },
]

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function mapMarket(m: any, category: string): Market {
  const ticker = m.ticker || ''

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
    if (v > 0.005 && v < 0.995) {
      probability = v
      break
    }
  }

  // Probability trend: current vs previous
  const curr = parseFloat(m.yes_ask_dollars || m.yes_bid_dollars || '0')
  const prev = parseFloat(m.previous_yes_ask_dollars || m.previous_price_dollars || '0')
  const probability_change = curr > 0.005 && prev > 0.005
    ? Math.round((curr - prev) * 1000) / 1000
    : null

  const volFp = parseFloat(m.volume_fp || '0')
  const vol24 = parseFloat(m.volume_24h_fp || '0')
  const vol   = volFp > 0 ? volFp : vol24 > 0 ? vol24 : null

  let question = (m.title || '').replace(/\s+/g, ' ').trim()

  // Kalshi crypto price ladders share one event title across many strike rungs
  // (e.g. 50+ identical "Bitcoin price on Jun 12, 2026?" rows). The strike is in
  // the ticker (…-T49999.99). Append it so each rung reads distinctly — which also
  // lets the cross-platform matcher bucket rungs by strike instead of collapsing them.
  if (category === 'crypto') {
    const st = ticker.match(/-T(\d+(?:\.\d+)?)$/)
    if (st && !/\$\d/.test(question)) {
      const sub    = (m.yes_sub_title || '').toString().replace(/\s+/g, ' ').trim()
      const strike = Math.round(parseFloat(st[1]))
      const money  = `$${strike.toLocaleString()}`
      question = sub ? `${question} — ${sub}` : `${question} — ≥ ${money}`
    }
  }

  const series   = (m.series_ticker || ticker.split('-')[0] || '').toLowerCase()
  const url      = series ? `https://kalshi.com/markets/${series}` : 'https://kalshi.com'

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
    status:            'active' as const,
    fetched_at:        new Date().toISOString(),
    probability_change,
    image_url:         null,
  }
}

export async function fetchKalshi(): Promise<Market[]> {
  const keyId = process.env.KALSHI_API_KEY_ID
  if (!keyId || keyId === 'placeholder') {
    console.log('Kalshi: no API key')
    return []
  }

  const nowTs      = Math.floor(Date.now() / 1000)
  const seen       = new Set<string>()
  const allMarkets: Market[] = []
  const hitSeries: string[]  = []

  for (const { ticker: series, category } of SERIES) {
    try {
      const path    = `/trade-api/v2/markets?limit=100&status=open&series_ticker=${series}&min_close_ts=${nowTs}`
      const headers = getKalshiHeaders('GET', path)
      if (Object.keys(headers).length === 0) continue

      const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })
      if (res.status === 429) { console.log('Kalshi: rate limited, backing off'); await sleep(400); continue }
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

      await sleep(250)

    } catch (e: any) {
      console.error(`Kalshi ${series}:`, e.message)
    }
  }

  const withProb  = allMarkets.filter(m => m.probability !== null).length
  const withTrend = allMarkets.filter(m => m.probability_change !== null).length
  console.log(`Kalshi: ${allMarkets.length} markets — [${hitSeries.join(', ')}]`)
  console.log(`Kalshi: ${withProb} with prob, ${withTrend} with trend`)

  return allMarkets
}
