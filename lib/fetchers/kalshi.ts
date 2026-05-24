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

function kalshiCat(apiCat: string): string {
  const map: Record<string, string> = {
    elections: 'politics', politics: 'politics',
    crypto: 'crypto', economics: 'economics',
    financials: 'economics', commodities: 'economics',
    climate: 'science', science: 'tech',
    culture: 'other', mentions: 'other', sports: 'sports',
  }
  return map[apiCat?.toLowerCase()] || 'other'
}

function extractPrice(m: any): number | null {
  // Try every possible price field Kalshi might use
  const candidates = [
    m.yes_ask, m.yes_bid, m.last_price, m.close_price,
    m.previous_yes_ask, m.previous_yes_bid, m.previous_price,
    m.floor_strike, m.settlement_price,
  ]
  for (const v of candidates) {
    if (v !== null && v !== undefined && v > 0 && v < 100) return v
  }
  return null
}

function mapMarket(m: any, apiCat: string): Market {
  const ticker = m.ticker || ''
  const priceCents = extractPrice(m)
  const probability = priceCents !== null ? priceCents / 100 : null

  const volRaw = m.dollar_volume ?? m.volume_24h ?? m.volume ?? null
  const vol    = volRaw && volRaw > 0 ? volRaw * 0.01 : null

  const series = (m.series_ticker || ticker.split('-')[0] || '').toLowerCase()
  const url    = series ? `https://kalshi.com/markets/${series}` : 'https://kalshi.com'

  // Filter close time within 1 year in code (don't rely on API param)
  const closeTime = m.close_time || m.expiration_time || null

  return {
    id:       `kalshi-${ticker}`,
    platform: 'kalshi' as const,
    question: m.title || m.subtitle || ticker,
    probability,
    volume: vol,
    volume_label: vol && vol > 0
      ? vol >= 1_000_000 ? `$${(vol/1_000_000).toFixed(1)}M`
      : `$${Math.round(vol).toLocaleString()}` : null,
    end_date: closeTime ? new Date(closeTime).toISOString().split('T')[0] : null,
    end_date_label: closeTime
      ? new Date(closeTime).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : null,
    traders:    null,
    category:   kalshiCat(apiCat),
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

  // Cutoff: only markets closing within 12 months
  const oneYear = new Date()
  oneYear.setFullYear(oneYear.getFullYear() + 1)

  const CATS = ['elections','politics','crypto','economics','financials','sports','commodities','climate','science']
  const allMarkets: { m: any; cat: string }[] = []
  const seen = new Set<string>()

  for (const cat of CATS) {
    try {
      const path = `/trade-api/v2/markets?limit=30&status=open&category=${cat}`
      const headers = getKalshiHeaders('GET', path)
      if (Object.keys(headers).length === 0) continue

      const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })
      if (!res.ok) {
        console.log(`Kalshi ${cat}: HTTP ${res.status}`)
        continue
      }

      const data    = await res.json()
      const markets = data.markets || []
      console.log(`Kalshi ${cat}: ${markets.length} markets`)

      // DEBUG: log first market fields to see what data is available
      if (markets.length > 0 && cat === 'crypto') {
        const sample = markets[0]
        console.log('KALSHI DEBUG fields:', Object.keys(sample).join(', '))
        console.log('KALSHI DEBUG crypto sample:', JSON.stringify({
          ticker:     sample.ticker,
          title:      sample.title,
          yes_ask:    sample.yes_ask,
          yes_bid:    sample.yes_bid,
          last_price: sample.last_price,
          volume:     sample.volume,
          dollar_volume: sample.dollar_volume,
          open_interest: sample.open_interest,
          close_time: sample.close_time,
        }))
      }

      for (const m of markets) {
        if (!m.ticker || seen.has(m.ticker)) continue
        // Skip KXMVE combo markets
        if (m.ticker.toUpperCase().includes('KXMVE')) continue
        // Skip markets closing beyond 1 year
        if (m.close_time && new Date(m.close_time) > oneYear) continue
        seen.add(m.ticker)
        allMarkets.push({ m, cat })
      }

    } catch (e: any) {
      console.error(`Kalshi ${cat} error:`, e.message)
    }
  }

  console.log(`Kalshi total unique markets: ${allMarkets.length}`)

  // Log how many have price data vs not
  const withPrice    = allMarkets.filter(({ m }) => extractPrice(m) !== null)
  const withoutPrice = allMarkets.filter(({ m }) => extractPrice(m) === null)
  console.log(`Kalshi with price: ${withPrice.length}, without: ${withoutPrice.length}`)

  return allMarkets.map(({ m, cat }) => mapMarket(m, cat))
}