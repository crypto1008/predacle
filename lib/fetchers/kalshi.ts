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

// Most reliable Kalshi series — confirmed or very high confidence
// Category mapped to our platform categories
const SERIES: { ticker: string; category: string }[] = [
  // ── Soccer ──────────────────────────────────────
  { ticker: 'KXEPLGOAL',    category: 'sports' },  // EPL Goals ✅ confirmed
  { ticker: 'KXEPL',        category: 'sports' },  // EPL match winner
  { ticker: 'KXCHAMPIONS',  category: 'sports' },  // Champions League
  { ticker: 'KXLALIGA',     category: 'sports' },  // La Liga
  // ── US Sports ───────────────────────────────────
  { ticker: 'KXNBA',        category: 'sports' },  // NBA
  { ticker: 'KXNFL',        category: 'sports' },  // NFL
  { ticker: 'KXMLB',        category: 'sports' },  // MLB
  { ticker: 'KXNHL',        category: 'sports' },  // NHL
  // ── Golf / Tennis ───────────────────────────────
  { ticker: 'KXPGATOUR',    category: 'sports' },  // PGA Tour ✅ confirmed
  { ticker: 'KXTENNIS',     category: 'sports' },  // Tennis
  // ── Crypto ──────────────────────────────────────
  { ticker: 'KXBTCFRIDAY',  category: 'crypto' },  // Bitcoin weekly
  { ticker: 'KXBTCMONDAY',  category: 'crypto' },  // Bitcoin weekly
  { ticker: 'KXBTCW',       category: 'crypto' },  // Bitcoin
  { ticker: 'KXETHFRIDAY',  category: 'crypto' },  // Ethereum weekly
  // ── Economics ───────────────────────────────────
  { ticker: 'KXCPI',        category: 'economics' },
  { ticker: 'KXFED',        category: 'economics' },
  { ticker: 'KXFOMC',       category: 'economics' },
  { ticker: 'KXGDP',        category: 'economics' },
  { ticker: 'KXUNEMP',      category: 'economics' },
  { ticker: 'KXOIL',        category: 'economics' },
  // ── Politics ────────────────────────────────────
  { ticker: 'KXSENATE',     category: 'politics'  },
  { ticker: 'KXHOUSE',      category: 'politics'  },
  { ticker: 'KXPRES',       category: 'politics'  },
  { ticker: 'KXELECT',      category: 'politics'  },
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

  const seen       = new Set<string>()
  const allMarkets: Market[] = []
  let   totalHits  = 0

  for (const { ticker, category } of SERIES) {
    try {
      // Fresh headers per request (timestamp must be current)
      const path    = `/trade-api/v2/markets?limit=10&status=open&series_ticker=${ticker}`
      const headers = getKalshiHeaders('GET', path)
      if (Object.keys(headers).length === 0) continue

      const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })

      if (res.status === 429) {
        console.log(`Kalshi: rate limited on ${ticker} — stopping early`)
        break
      }
      if (!res.ok) continue

      const data    = await res.json()
      const markets = data.markets || []

      if (markets.length > 0) {
        console.log(`Kalshi ${ticker}: ${markets.length} markets`)
        totalHits++
      }

      for (const m of markets) {
        if (!m.ticker || seen.has(m.ticker)) continue
        seen.add(m.ticker)
        allMarkets.push(mapMarket(m, category))
      }

      // Small delay between calls to avoid rate limiting
      await sleep(150)

    } catch (e: any) {
      console.error(`Kalshi ${ticker} error:`, e.message)
    }
  }

  const withProb = allMarkets.filter(m => m.probability !== null).length
  console.log(`Kalshi: ${allMarkets.length} markets from ${totalHits} series, ${withProb} with probability`)

  return allMarkets
}