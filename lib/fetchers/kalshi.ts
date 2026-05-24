import { inferCategory } from '../utils/category'
import { Market } from '../types'
import { createSign } from 'crypto'

function getKalshiHeaders(method: string, path: string): HeadersInit {
  const keyId         = process.env.KALSHI_API_KEY_ID
  const privateKeyRaw = process.env.KALSHI_PRIVATE_KEY

  if (!keyId || !privateKeyRaw || keyId === 'placeholder') return {}

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n').replace(/\\r/g, '').trim()
  const timestamp  = Date.now().toString()
  const sigPath    = path.split('?')[0]
  const message    = `${timestamp}${method}${sigPath}`

  try {
    const sign = createSign('RSA-SHA256')
    sign.update(message)
    sign.end()
    const signature = sign.sign(privateKey, 'base64')
    return {
      'KALSHI-ACCESS-KEY':       keyId,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
      'KALSHI-ACCESS-SIGNATURE': signature,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    }
  } catch (e: any) {
    console.error('Kalshi signing error:', e.message)
    return {}
  }
}

function hasRealData(m: any): boolean {
  return (
    (m.yes_ask    > 0) ||
    (m.yes_bid    > 0) ||
    (m.last_price > 0) ||
    (m.volume     > 0) ||
    (m.dollar_volume > 0) ||
    (m.open_interest > 0)
  )
}

function mapMarket(m: any): Market {
  const ticker = m.ticker || ''

  const priceCents =
    m.yes_ask    ?? m.yes_bid    ??
    m.last_price ?? m.close_price ?? null
  const probability =
    priceCents !== null && priceCents > 0 && priceCents < 100
      ? priceCents / 100
      : null

  const volRaw = m.dollar_volume ?? m.volume_24h ?? m.volume ?? null
  const vol    = volRaw && volRaw > 0 ? volRaw * 0.01 : null

  const series = (m.series_ticker || ticker.split('-')[0] || '').toLowerCase()
  const url    = series ? `https://kalshi.com/markets/${series}` : 'https://kalshi.com'

  const t = ticker.toUpperCase()
  const category = (() => {
    if (t.includes('SPORT') || t.includes('NBA') || t.includes('NFL') ||
        t.includes('MLB') || t.includes('NHL') || t.includes('SOCCER') ||
        t.includes('TENNIS') || t.includes('GOLF') || t.includes('PGAT') ||
        t.includes('KXMVE') || t.includes('MULTIGA'))
      return 'sports'
    if (t.includes('BTC') || t.includes('ETH') || t.includes('CRYPTO') ||
        t.includes('SOL') || t.includes('DOGE') || t.includes('XRP'))
      return 'crypto'
    if (t.includes('ELECT') || t.includes('PRES') || t.includes('VOTE') ||
        t.includes('SENATE') || t.includes('HOUSE') || t.includes('GOV') ||
        t.includes('PARTY'))
      return 'politics'
    if (t.includes('CPI') || t.includes('INFL') || t.includes('FED') ||
        t.includes('GDP') || t.includes('UNEMP') || t.includes('FOMC') ||
        t.includes('RATE') || t.includes('OIL') || t.includes('GOLD'))
      return 'economics'
    if (t.includes('TECH') || t.includes('AI') || t.includes('SCIENCE'))
      return 'tech'
    return inferCategory(m.title || '')
  })()

  return {
    id:       `kalshi-${ticker}`,
    platform: 'kalshi' as const,
    question: m.title || ticker,
    probability,
    volume: vol,
    volume_label: vol && vol > 0
      ? vol >= 1_000_000
        ? `$${(vol / 1_000_000).toFixed(1)}M`
        : `$${Math.round(vol).toLocaleString()}`
      : null,
    end_date: m.close_time
      ? new Date(m.close_time).toISOString().split('T')[0]
      : null,
    end_date_label: m.close_time
      ? new Date(m.close_time).toLocaleDateString('en-US', {
          month: 'short', year: 'numeric',
        })
      : null,
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
    console.log('Kalshi: no API key — skipping')
    return []
  }

  const BASE = 'https://api.elections.kalshi.com'
  const results: Market[] = []

  // ── Strategy 1: Events endpoint (diverse categories) ──────────────────
  try {
    const path    = '/trade-api/v2/events?limit=200&status=open&with_nested_markets=true'
    const headers = getKalshiHeaders('GET', path)

    if (Object.keys(headers).length > 0) {
      const res  = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })
      if (res.ok) {
        const data   = await res.json()
        const events = data.events || []
        console.log(`Kalshi events: got ${events.length} events`)

        for (const event of events) {
          const markets: any[] = event.markets || []
          for (const m of markets) {
            if (m.ticker && m.title && hasRealData(m)) {
              results.push(mapMarket({
                ...m,
                series_ticker: m.series_ticker || event.series_ticker,
              }))
            }
          }
        }
        console.log(`Kalshi events: ${results.length} markets with real data`)
      }
    }
  } catch (e: any) {
    console.error('Kalshi events error:', e.message)
  }

  // ── Strategy 2: Markets endpoint as fallback ───────────────────────────
  if (results.length < 20) {
    try {
      const path    = '/trade-api/v2/markets?limit=200&status=open'
      const headers = getKalshiHeaders('GET', path)

      if (Object.keys(headers).length > 0) {
        const res  = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })
        if (res.ok) {
          const data    = await res.json()
          const markets = data.markets || []
          console.log(`Kalshi markets fallback: got ${markets.length}`)

          const withData = markets.filter((m: any) =>
            m.ticker && m.title && hasRealData(m)
          )
          console.log(`Kalshi markets fallback: ${withData.length} with real data`)

          const existingIds = new Set(results.map(r => r.id))
          for (const m of withData) {
            const id = `kalshi-${m.ticker}`
            if (!existingIds.has(id)) results.push(mapMarket(m))
          }
        }
      }
    } catch (e: any) {
      console.error('Kalshi markets fallback error:', e.message)
    }
  }

  console.log(`Kalshi total: ${results.length} quality markets`)
  return results
}