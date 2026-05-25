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

function cleanTitle(title: string): string {
  if (!title) return title
  if (!/^(yes|no) /i.test(title)) return title
  const parts   = title.split(',').map(s => s.trim()).filter(Boolean)
  const preview = parts.slice(0, 2)
    .map(p => p.replace(/^(yes|no) /i, '').trim())
    .join(' & ')
  return parts.length > 2
    ? `Multi-bet: ${preview} (+${parts.length - 2} more)`
    : `Multi-bet: ${preview}`
}

export async function fetchKalshi(): Promise<Market[]> {
  const keyId = process.env.KALSHI_API_KEY_ID
  if (!keyId || keyId === 'placeholder') {
    console.log('Kalshi: no API key — skipping')
    return []
  }

  try {
    const path    = '/trade-api/v2/markets?limit=200&status=open'
    const headers = getKalshiHeaders('GET', path)

    if (Object.keys(headers).length === 0) {
      console.log('Kalshi: could not generate auth headers')
      return []
    }

    const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })

    if (!res.ok) {
      console.error(`Kalshi: HTTP ${res.status}`)
      return []
    }

    const data    = await res.json()
    const markets = data.markets || []
    console.log(`Kalshi: received ${markets.length} markets`)

    // Log first market to see available fields
    if (markets.length > 0) {
      const s = markets[0]
      console.log('Kalshi fields:', Object.keys(s).join(', '))
      console.log('Kalshi sample:', JSON.stringify({
        ticker: s.ticker, title: s.title,
        yes_ask: s.yes_ask, yes_bid: s.yes_bid,
        last_price: s.last_price, volume: s.volume,
        dollar_volume: s.dollar_volume, open_interest: s.open_interest,
        close_time: s.close_time,
      }))
    }

    // Only skip markets with no title or closing beyond 18 months
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() + 18)

    const filtered = markets.filter((m: any) => {
      if (!m.ticker || !m.title) return false
      if (m.close_time && new Date(m.close_time) > cutoff) return false
      return true
    })

    console.log(`Kalshi: ${filtered.length} markets after date filter`)

    return filtered.map((m: any) => {
      const ticker = m.ticker || ''

      // Try all price fields
      let priceCents: number | null = null
      for (const f of ['yes_ask','yes_bid','last_price','previous_yes_ask','previous_price']) {
        const v = Number(m[f])
        if (v > 0 && v < 100) { priceCents = v; break }
      }
      const probability = priceCents !== null ? priceCents / 100 : null

      const volRaw = m.dollar_volume ?? m.volume_24h ?? m.volume ?? null
      const vol    = Number(volRaw) > 0 ? Number(volRaw) * 0.01 : null

      const series = (m.series_ticker || ticker.split('-')[0] || '').toLowerCase()
      const url    = series ? `https://kalshi.com/markets/${series}` : 'https://kalshi.com'

      const t = ticker.toUpperCase()
      const category = (() => {
        if (t.includes('BTC') || t.includes('ETH') || t.includes('CRYPTO')) return 'crypto'
        if (t.includes('ELECT') || t.includes('PRES') || t.includes('SENATE')) return 'politics'
        if (t.includes('CPI') || t.includes('FED') || t.includes('GDP') || t.includes('INFL')) return 'economics'
        return 'sports'
      })()

      return {
        id:       `kalshi-${ticker}`,
        platform: 'kalshi' as const,
        question: cleanTitle(m.title),
        probability,
        volume: vol,
        volume_label: vol && vol > 0
          ? vol >= 1_000_000 ? `$${(vol/1_000_000).toFixed(1)}M`
          : `$${Math.round(vol).toLocaleString()}` : null,
        end_date: m.close_time
          ? new Date(m.close_time).toISOString().split('T')[0] : null,
        end_date_label: m.close_time
          ? new Date(m.close_time).toLocaleDateString('en-US',
              { month:'short', year:'numeric' }) : null,
        traders:    null,
        category,
        url,
        status:     'active' as const,
        fetched_at: new Date().toISOString(),
      }
    })
  } catch (e: any) {
    console.error('Kalshi fetch error:', e.message)
    return []
  }
}