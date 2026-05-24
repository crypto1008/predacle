import { inferCategory } from '../utils/category'
import { Market } from '../types'
import { createSign } from 'crypto'

function getKalshiHeaders(method: string, endpointPath: string): HeadersInit {
  const keyId         = process.env.KALSHI_API_KEY_ID
  const privateKeyRaw = process.env.KALSHI_PRIVATE_KEY

  if (!keyId || !privateKeyRaw || keyId === 'placeholder') {
    console.log('Kalshi: missing API credentials')
    return {}
  }

  const privateKey = privateKeyRaw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .trim()

  const timestamp      = Date.now().toString()
  const pathForSigning = endpointPath.split('?')[0]
  const message        = `${timestamp}${method}${pathForSigning}`

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
  } catch (error: any) {
    console.error('Kalshi signing error:', error.message)
    return {}
  }
}

function cleanQuestion(title: string): string {
  if (!title) return title
  if (!/^(yes|no) /i.test(title)) return title
  const parts   = title.split(',').map(s => s.trim()).filter(Boolean)
  const preview = parts
    .slice(0, 2)
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
    const endpointPath = '/trade-api/v2/markets?limit=200&status=open'
    const headers      = getKalshiHeaders('GET', endpointPath)

    if (Object.keys(headers).length === 0) {
      console.log('Kalshi: could not generate headers')
      return []
    }

    const response = await fetch(
      `https://api.elections.kalshi.com${endpointPath}`,
      { headers, cache: 'no-store' }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error(`Kalshi HTTP error: ${response.status} — ${text.substring(0, 200)}`)
      return []
    }

    const data    = await response.json()
    const markets = data.markets || []
    console.log(`Kalshi: got ${markets.length} markets`)

    return markets
      .filter((m: any) => m.ticker && m.title)
      .map((m: any) => {
        const ticker = m.ticker || ''

        // Probability — try multiple price fields
        const priceCents =
          m.yes_ask     ?? m.yes_bid    ??
          m.last_price  ?? m.close_price ?? null
        const probability =
          priceCents !== null && priceCents > 0 && priceCents < 100
            ? priceCents / 100
            : null

        // Volume — Kalshi returns volume in cents
        const volCents = m.volume_24h ?? m.volume ?? null
        const vol      = volCents && volCents > 0 ? volCents * 0.01 : null

        // URL — use series ticker for cleaner link
        const series = m.series_ticker || ticker.split('-')[0] || ''
        const url    = series
          ? `https://kalshi.com/markets/${series}`
          : 'https://kalshi.com'

        // Clean question for combo markets
        const question = cleanQuestion(m.title || ticker)

        // Category
        const t = ticker.toUpperCase()
        const category = (() => {
          if (t.includes('SPORT') || t.includes('ESPORT') || t.includes('SOCCER') ||
              t.includes('TENNIS') || t.includes('BASKETBALL') || t.includes('FOOTBALL') ||
              t.includes('BASEBALL') || t.includes('HOCKEY') || t.includes('GOLF') ||
              t.includes('CROSS') || t.includes('MULTIE') || t.includes('MULTIGA'))
            return 'sports'
          if (t.includes('BTC') || t.includes('ETH') || t.includes('CRYPTO'))
            return 'crypto'
          if (t.includes('ELECT') || t.includes('PRES') || t.includes('VOTE') ||
              t.includes('SENATE') || t.includes('HOUSE'))
            return 'politics'
          if (t.includes('CPI') || t.includes('INFL') || t.includes('FED') ||
              t.includes('GDP') || t.includes('UNEMP') || t.includes('FOMC'))
            return 'economics'
          return inferCategory(m.title || '')
        })()

        return {
          id:       `kalshi-${ticker}`,
          platform: 'kalshi' as const,
          question,
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
      })
  } catch (error: any) {
    console.error('Kalshi fetch error:', error.message)
    return []
  }
}