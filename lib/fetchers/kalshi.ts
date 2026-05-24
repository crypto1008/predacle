import { inferCategory } from '../utils/category'
import { Market } from '../types'
import { createSign } from 'crypto'

function getKalshiHeaders(method: string, endpointPath: string): HeadersInit {
  const keyId = process.env.KALSHI_API_KEY_ID
  const privateKeyRaw = process.env.KALSHI_PRIVATE_KEY

  if (!keyId || !privateKeyRaw || keyId === 'placeholder') {
    console.log('Kalshi: missing API credentials')
    return {}
  }

  const privateKey = privateKeyRaw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .trim()

  const timestamp    = Date.now().toString()
  const pathForSigning = endpointPath.split('?')[0]
  const message      = `${timestamp}${method}${pathForSigning}`

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

function cleanKalshiQuestion(title: string): string {
  if (!title) return title
  // Detect auto-generated combo questions like "yes X, yes Y, no Z..."
  if (!/^(yes|no) /i.test(title)) return title
  const conditions = title.split(',').map(s => s.trim()).filter(Boolean)
  const count      = conditions.length
  const preview    = conditions
    .slice(0, 2)
    .map(c => c.replace(/^(yes|no) /i, '').trim())
    .join(', ')
  return count > 2
    ? `Multi-bet: ${preview} +${count - 2} more`
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
    const headers = getKalshiHeaders('GET', endpointPath)

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

    return markets.map((m: any) => {
      const yesCents    = m.yes_ask ?? m.last_price ?? null
      const probability = yesCents !== null ? yesCents / 100 : null
      const vol         = m.volume ? m.volume * 0.01 : null

      // Build best available URL
      const eventTicker  = m.event_ticker  || ''
      const seriesTicker = m.series_ticker || (m.ticker || '').split('-')[0] || ''
      const url = eventTicker
        ? `https://kalshi.com/markets/${eventTicker}`
        : seriesTicker
        ? `https://kalshi.com/markets/${seriesTicker}`
        : 'https://kalshi.com'

      // Clean combo question for display
      const question = cleanKalshiQuestion(m.title || '')

      return {
        id:         `kalshi-${m.ticker}`,
        platform:   'kalshi' as const,
        question,
        probability,
        volume: vol,
        volume_label: vol
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
        traders:  null,
        category: (() => {
          const t = (m.ticker || '').toUpperCase()
          if (
            t.includes('SPORT') || t.includes('ESPORT') ||
            t.includes('SOCCER') || t.includes('TENNIS') ||
            t.includes('BASKETBALL') || t.includes('FOOTBALL') ||
            t.includes('BASEBALL') || t.includes('HOCKEY') ||
            t.includes('GOLF') || t.includes('CROSS')
          ) return 'sports'
          return inferCategory(m.title || m.question || '')
        })(),
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