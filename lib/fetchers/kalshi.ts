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

function kalshiCategoryToOurs(apiCategory: string): string {
  const map: Record<string, string> = {
    elections:   'politics',
    politics:    'politics',
    crypto:      'crypto',
    economics:   'economics',
    financials:  'economics',
    commodities: 'economics',
    climate:     'science',
    science:     'tech',
    culture:     'other',
    mentions:    'other',
    sports:      'sports',
  }
  return map[apiCategory?.toLowerCase()] || inferCategory(apiCategory || '')
}

function mapToMarket(m: any, apiCategory: string): Market {
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
    category:   kalshiCategoryToOurs(apiCategory),
    url,
    status:     'active' as const,
    fetched_at: new Date().toISOString(),
  }
}

async function fetchCategoryMarkets(
  category: string,
  maxCloseTs: number
): Promise<any[]> {
  try {
    // Try events endpoint first
    const ePath    = `/trade-api/v2/events?limit=25&status=open&category=${category}&with_nested_markets=true&max_close_ts=${maxCloseTs}`
    const eHeaders = getKalshiHeaders('GET', ePath)
    if (Object.keys(eHeaders).length === 0) return []

    const eRes = await fetch(`${BASE}${ePath}`, { headers: eHeaders, cache: 'no-store' })

    if (eRes.ok) {
      const eData  = await eRes.json()
      const events = eData.events || []

      const markets: any[] = []
      for (const event of events) {
        for (const mkt of (event.markets || [])) {
          markets.push({ ...mkt, series_ticker: mkt.series_ticker || event.series_ticker })
        }
      }

      if (markets.length > 0) {
        console.log(`Kalshi ${category}: ${markets.length} markets from events`)
        return markets
      }
    }

    // Fallback: direct markets endpoint with category filter
    const mPath    = `/trade-api/v2/markets?limit=25&status=open&category=${category}&max_close_ts=${maxCloseTs}`
    const mHeaders = getKalshiHeaders('GET', mPath)
    if (Object.keys(mHeaders).length === 0) return []

    const mRes = await fetch(`${BASE}${mPath}`, { headers: mHeaders, cache: 'no-store' })
    if (!mRes.ok) return []

    const mData = await mRes.json()
    const mkts  = mData.markets || []
    console.log(`Kalshi ${category} (fallback): ${mkts.length} markets`)
    return mkts

  } catch (e: any) {
    console.error(`Kalshi ${category} error:`, e.message)
    return []
  }
}

export async function fetchKalshi(): Promise<Market[]> {
  const keyId = process.env.KALSHI_API_KEY_ID
  if (!keyId || keyId === 'placeholder') {
    console.log('Kalshi: no API key — skipping')
    return []
  }

  // Only fetch markets closing within 12 months — actively traded
  const twelveMonths = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)

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
    'sports',
  ]

  const settled = await Promise.allSettled(
    CATEGORIES.map(cat => fetchCategoryMarkets(cat, twelveMonths))
  )

  const allMarkets: { market: any; category: string }[] = []
  const seen = new Set<string>()

  CATEGORIES.forEach((cat, i) => {
    const result = settled[i]
    if (result.status === 'fulfilled') {
      for (const m of result.value) {
        if (!m.ticker || !m.title || seen.has(m.ticker)) continue
        seen.add(m.ticker)
        allMarkets.push({ market: m, category: cat })
      }
    }
  })

  console.log(`Kalshi: ${allMarkets.length} total markets fetched`)

  // Prefer markets with actual data
  const withData    = allMarkets.filter(({ market: m }) =>
    (m.yes_ask > 0) || (m.yes_bid > 0) || (m.last_price > 0) ||
    (m.volume > 0)  || (m.dollar_volume > 0)
  )
  const withoutData = allMarkets.filter(({ market: m }) =>
    !((m.yes_ask > 0) || (m.yes_bid > 0) || (m.last_price > 0) ||
      (m.volume > 0)  || (m.dollar_volume > 0))
  )

  console.log(`Kalshi: ${withData.length} with data, ${withoutData.length} without`)

  // Use quality data if available, otherwise accept all
  const toProcess = withData.length >= 5 ? withData : allMarkets

  return toProcess.map(({ market, category }) => mapToMarket(market, category))
}