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
  // ── Soccer ──────────────────────────────
  { ticker: 'KXEPLGOAL',       category: 'sports' },
  { ticker: 'KXEPL',           category: 'sports' },
  { ticker: 'KXCHAMPIONS',     category: 'sports' },
  { ticker: 'KXUCL',           category: 'sports' },
  { ticker: 'KXLALIGA',        category: 'sports' },
  { ticker: 'KXMLS',           category: 'sports' },
  { ticker: 'KXWORLDCUP',      category: 'sports' },
  { ticker: 'KXFIFA',          category: 'sports' },
  // ── US Sports ────────────────────────────
  { ticker: 'KXNBA',           category: 'sports' },
  { ticker: 'KXNBAPLAYOFF',    category: 'sports' },
  { ticker: 'KXNFL',           category: 'sports' },
  { ticker: 'KXMLB',           category: 'sports' },
  { ticker: 'KXNHL',           category: 'sports' },
  { ticker: 'KXNHLPLAYOFF',    category: 'sports' },
  // ── Golf / Tennis ────────────────────────
  { ticker: 'KXPGATOUR',       category: 'sports' },
  { ticker: 'KXTENNIS',        category: 'sports' },
  { ticker: 'KXATP',           category: 'sports' },
  { ticker: 'KXWTA',           category: 'sports' },
  // ── Crypto (multiple variants) ───────────
  { ticker: 'KXBTCFRIDAY',     category: 'crypto' },
  { ticker: 'KXBTCMONDAY',     category: 'crypto' },
  { ticker: 'KXBTCW',          category: 'crypto' },
  { ticker: 'KXBTCD',          category: 'crypto' },
  { ticker: 'KXBTC',           category: 'crypto' },
  { ticker: 'KXBTCUSD',        category: 'crypto' },
  { ticker: 'KXETHFRIDAY',     category: 'crypto' },
  { ticker: 'KXETH',           category: 'crypto' },
  { ticker: 'KXETHUSD',        category: 'crypto' },
  { ticker: 'KXSOL',           category: 'crypto' },
  { ticker: 'KXDOGE',          category: 'crypto' },
  // ── Economics (multiple variants) ────────
  { ticker: 'KXCPI',           category: 'economics' },
  { ticker: 'KXCPIU',          category: 'economics' },
  { ticker: 'KXCPIM',          category: 'economics' },
  { ticker: 'KXFED',           category: 'economics' },
  { ticker: 'KXFEDRATE',       category: 'economics' },
  { ticker: 'KXFOMC',          category: 'economics' },
  { ticker: 'KXFOMCRATE',      category: 'economics' },
  { ticker: 'KXGDP',           category: 'economics' },
  { ticker: 'KXUNEMP',         category: 'economics' },
  { ticker: 'KXUNEMPLOYMENT',  category: 'economics' },
  { ticker: 'KXINFL',          category: 'economics' },
  { ticker: 'KXOIL',           category: 'economics' },
  { ticker: 'KXGOLD',          category: 'economics' },
  { ticker: 'KXSP500',         category: 'economics' },
  { ticker: 'KXSPX',           category: 'economics' },
  { ticker: 'KXNASDAQ',        category: 'economics' },
  { ticker: 'KXPCE',           category: 'economics' },
  // ── Politics ─────────────────────────────
  { ticker: 'KXSENATE',        category: 'politics' },
  { ticker: 'KXHOUSE',         category: 'politics' },
  { ticker: 'KXPRES',          category: 'politics' },
  { ticker: 'KXGOV',           category: 'politics' },
  { ticker: 'KXELECT',         category: 'politics' },
  { ticker: 'KXPOPVOTE',       category: 'politics' },
  { ticker: 'KXDEMS',          category: 'politics' },
  { ticker: 'KXREP',           category: 'politics' },
  // ── Tech / Science ───────────────────────
  { ticker: 'KXAI',            category: 'tech'     },
  { ticker: 'KXTECH',          category: 'tech'     },
  { ticker: 'KXSCIENCE',       category: 'science'  },
  { ticker: 'KXCLIMATE',       category: 'science'  },
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

  // Only get markets closing in the future (active/upcoming)
  const nowTs = Math.floor(Date.now() / 1000)

  const seen       = new Set<string>()
  const allMarkets: Market[] = []
  const hitSeries: string[]  = []

  for (const { ticker, category } of SERIES) {
    try {
      const path = `/trade-api/v2/markets?limit=10&status=open&series_ticker=${ticker}&min_close_ts=${nowTs}`
      const headers = getKalshiHeaders('GET', path)
      if (Object.keys(headers).length === 0) continue

      const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })

      if (res.status === 429) {
        console.log('Kalshi: rate limited — stopping')
        break
      }
      if (!res.ok) {
        await sleep(200)
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

      await sleep(150)

    } catch (e: any) {
      console.error(`Kalshi ${ticker}:`, e.message)
    }
  }

  const withProb = allMarkets.filter(m => m.probability !== null).length
  console.log(`Kalshi: ${allMarkets.length} markets from [${hitSeries.join(', ')}]`)
  console.log(`Kalshi: ${withProb} with probability, ${allMarkets.length - withProb} without`)

  return allMarkets
}