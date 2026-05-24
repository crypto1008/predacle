import { inferCategory } from '../utils/category'
import { Market } from '../types'
import { createSign } from 'crypto'

const BASE = 'https://api.elections.kalshi.com'

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

async function fetchCategory(category: string): Promise<any[]> {
  try {
    const path    = `/trade-api/v2/events?limit=20&status=open&category=${category}&with_nested_markets=true`
    const headers = getKalshiHeaders('GET', path)
    if (Object.keys(headers).length === 0) return []

    const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })
    if (!res.ok) {
      console.log(`Kalshi ${category}: status ${res.status}`)
      return []
    }
    const data = await res.json()
    const events = data.events || []
    console.log(`Kalshi ${category}: ${events.length} events`)

    // Extract all nested markets from events
    const markets: any[] = []
    for (const event of events) {
      for (const market of (event.markets || [])) {
        markets.push({
          ...market,
          series_ticker:    market.series_ticker || event.series_ticker,
          event_category:   category,
        })
      }
    }

    // If events had no nested markets, try direct markets endpoint for this category
    if (markets.length === 0) {
      const mPath    = `/trade-api/v2/markets?limit=20&status=open&category=${category}`
      const mHeaders = getKalshiHeaders('GET', mPath)
      if (Object.keys(mHeaders).length === 0) return []
      const mRes = await fetch(`${BASE}${mPath}`, { headers: mHeaders, cache: 'no-store' })
      if (!mRes.ok) return []
      const mData = await mRes.json()
      return (mData.markets || []).map((m: any) => ({ ...m, event_category: category }))
    }

    return markets
  } catch (e: any) {
    console.error(`Kalshi ${category} error:`, e.message)
    return []
  }
}

function mapToMarket(m: any): Market {
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

  const cat = m.event_category || ''
  const t   = ticker.toUpperCase()
  const category = (() => {
    if (cat === 'crypto'    || t.includes('BTC') || t.includes('ETH') || t.includes('CRYPTO')) return 'crypto'
    if (cat === 'elections' || cat === 'politics' || t.includes('ELECT') || t.includes('SENATE') || t.includes('PRES')) return 'politics'
    if (cat === 'economics' || cat === 'financials' || cat === 'commodities' ||
        t.includes('CPI') || t.includes('INFL') || t.includes('FED') || t.includes('GDP')) return 'economics'
    if (cat === 'science'   || t.includes('TECH') || t.includes('AI')) return 'tech'
    if (cat === 'sports'    || t.includes('NBA') || t.includes('NFL') || t.includes('MLB')) return 'sports'
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

  // Fetch from every Kalshi category in parallel
  const CATEGORIES = [
    'elections',
    'politics',
    'crypto',
    'economics',
    'financials',
    'commodities',
    'climate',
    'science',
    'culture',
    'mentions',
    'sports',
  ]

  const results = await Promise.allSettled(
    CATEGORIES.map(cat => fetchCategory(cat))
  )

  const allMarkets: any[] = []
  const seen = new Set<string>()

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const m of result.value) {
        if (!m.ticker || !m.title) continue
        if (seen.has(m.ticker)) continue
        seen.add(m.ticker)
        allMarkets.push(m)
      }
    }
  }

  console.log(`Kalshi: ${allMarkets.length} total markets across all categories`)

  // Filter to only markets with real data
  const withData = allMarkets.filter(m =>
    m.yes_ask > 0 || m.yes_bid > 0 ||
    m.last_price > 0 || m.volume > 0 ||
    m.dollar_volume > 0 || m.open_interest > 0
  )

  const withoutData = allMarkets.filter(m =>
    !(m.yes_ask > 0 || m.yes_bid > 0 ||
      m.last_price > 0 || m.volume > 0 ||
      m.dollar_volume > 0 || m.open_interest > 0)
  )

  console.log(`Kalshi: ${withData.length} with data, ${withoutData.length} without`)

  // Return quality markets first, then others if we have very few
  const toReturn = withData.length >= 10 ? withData : allMarkets
  return toReturn.map(mapToMarket)
}