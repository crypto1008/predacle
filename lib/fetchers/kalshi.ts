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

function kalshiCat(apiCat: string, ticker: string): string {
  const cat = apiCat?.toLowerCase() || ''
  const t   = ticker.toUpperCase()
  if (cat === 'crypto'    || t.includes('BTC') || t.includes('ETH')) return 'crypto'
  if (cat === 'elections' || cat === 'politics')                       return 'politics'
  if (cat === 'economics' || cat === 'financials' || cat === 'commodities'
      || t.includes('CPI') || t.includes('FED') || t.includes('GDP')) return 'economics'
  if (cat === 'science'   || cat === 'climate')                        return 'science'
  if (cat === 'sports'    || t.includes('NBA') || t.includes('NFL')
      || t.includes('MLB') || t.includes('NHL') || t.includes('PGAT')) return 'sports'
  return inferCategory(ticker)
}

function mapMarket(m: any, apiCat: string): Market {
  const ticker = m.ticker || ''

  // Try every possible price field name
  let priceCents: number | null = null
  const priceFields = ['yes_ask','yes_bid','last_price','previous_yes_ask',
                       'previous_yes_bid','previous_price','close_price']
  for (const f of priceFields) {
    const v = m[f]
    if (v !== null && v !== undefined && Number(v) > 0 && Number(v) < 100) {
      priceCents = Number(v)
      break
    }
  }
  const probability = priceCents !== null ? priceCents / 100 : null

  const volRaw = m.dollar_volume ?? m.volume_24h ?? m.volume ?? null
  const vol    = volRaw && Number(volRaw) > 0 ? Number(volRaw) * 0.01 : null

  const series = (m.series_ticker || ticker.split('-')[0] || '').toLowerCase()
  const url    = series ? `https://kalshi.com/markets/${series}` : 'https://kalshi.com'

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
    end_date: closeTime
      ? new Date(closeTime).toISOString().split('T')[0] : null,
    end_date_label: closeTime
      ? new Date(closeTime).toLocaleDateString('en-US',{ month:'short', year:'numeric' })
      : null,
    traders:    null,
    category:   kalshiCat(apiCat, ticker),
    url,
    status:     'active' as const,
    fetched_at: new Date().toISOString(),
  }
}

export async function fetchKalshi(): Promise<Market[]> {
  const keyId = process.env.KALSHI_API_KEY_ID
  if (!keyId || keyId === 'placeholder') return []

  const oneYearFromNow = new Date()
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)

  const CATS = ['elections','politics','crypto','economics',
                'financials','sports','commodities','climate','science']
  const seen       = new Set<string>()
  const allMarkets: { m: any; cat: string }[] = []
  let   debugDone  = false

  for (const cat of CATS) {
    try {
      const path = `/trade-api/v2/events?limit=25&status=open&category=${cat}&with_nested_markets=true`
      const headers = getKalshiHeaders('GET', path)
      if (Object.keys(headers).length === 0) continue

      const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })
      if (!res.ok) {
        console.log(`Kalshi ${cat}: HTTP ${res.status}`)
        continue
      }

      const data   = await res.json()
      const events = data.events || []
      console.log(`Kalshi ${cat}: ${events.length} events`)

      for (const event of events) {
        const markets: any[] = event.markets || []

        // DEBUG: log first market fields we receive
        if (!debugDone && markets.length > 0) {
          const s = markets[0]
          console.log('KALSHI_DEBUG_FIELDS:', Object.keys(s).join('|'))
          console.log('KALSHI_DEBUG_SAMPLE:', JSON.stringify({
            ticker:           s.ticker,
            title:            s.title,
            yes_ask:          s.yes_ask,
            yes_bid:          s.yes_bid,
            no_ask:           s.no_ask,
            no_bid:           s.no_bid,
            last_price:       s.last_price,
            previous_price:   s.previous_price,
            volume:           s.volume,
            dollar_volume:    s.dollar_volume,
            open_interest:    s.open_interest,
            liquidity:        s.liquidity,
            close_time:       s.close_time,
          }))
          debugDone = true
        }

        for (const m of markets) {
          if (!m.ticker || seen.has(m.ticker)) continue
          if (m.ticker.toUpperCase().includes('KXMVE')) continue
          if (m.close_time && new Date(m.close_time) > oneYearFromNow) continue
          seen.add(m.ticker)
          allMarkets.push({
            m: { ...m, series_ticker: m.series_ticker || event.series_ticker },
            cat,
          })
        }
      }
    } catch (e: any) {
      console.error(`Kalshi ${cat} error:`, e.message)
    }
  }

  // Fallback: basic markets endpoint if events gave nothing
  if (allMarkets.length === 0) {
    try {
      console.log('Kalshi: trying basic markets fallback')
      const path    = '/trade-api/v2/markets?limit=200&status=open'
      const headers = getKalshiHeaders('GET', path)
      if (Object.keys(headers).length > 0) {
        const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })
        if (res.ok) {
          const data    = await res.json()
          const markets = data.markets || []
          console.log(`Kalshi fallback: ${markets.length} markets`)

          if (markets.length > 0) {
            const s = markets[0]
            console.log('KALSHI_FALLBACK_FIELDS:', Object.keys(s).join('|'))
            console.log('KALSHI_FALLBACK_SAMPLE:', JSON.stringify({
              ticker: s.ticker, yes_ask: s.yes_ask, yes_bid: s.yes_bid,
              last_price: s.last_price, volume: s.volume,
              dollar_volume: s.dollar_volume, open_interest: s.open_interest,
            }))
          }

          for (const m of markets) {
            if (!m.ticker || seen.has(m.ticker)) continue
            if (m.ticker.toUpperCase().includes('KXMVE')) continue
            if (m.close_time && new Date(m.close_time) > oneYearFromNow) continue
            seen.add(m.ticker)
            allMarkets.push({ m, cat: 'other' })
          }
        }
      }
    } catch (e: any) {
      console.error('Kalshi fallback error:', e.message)
    }
  }

  const withPrice    = allMarkets.filter(({ m }) => {
    for (const f of ['yes_ask','yes_bid','last_price']) {
      if (m[f] > 0 && m[f] < 100) return true
    }
    return false
  })
  console.log(`Kalshi: ${allMarkets.length} total, ${withPrice.length} with price data`)

  return allMarkets.map(({ m, cat }) => mapMarket(m, cat))
}