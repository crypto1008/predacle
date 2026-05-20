import { Market } from '../types'
import { createSign } from 'crypto'

function getKalshiHeaders(method: string, path: string): HeadersInit {
  const keyId = process.env.KALSHI_API_KEY_ID
  const privateKey = process.env.KALSHI_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!keyId || !privateKey || keyId === 'placeholder') {
    return {}
  }

  const timestamp = Date.now().toString()
  const message = `${timestamp}${method}/trade-api/v2${path}`

  try {
    const sign = createSign('SHA256')
    sign.update(message)
    sign.end()
    const signature = sign.sign(privateKey, 'base64')

    return {
      'KALSHI-ACCESS-KEY': keyId,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
      'KALSHI-ACCESS-SIGNATURE': signature,
      'Content-Type': 'application/json',
    }
  } catch (error) {
    console.error('Kalshi signature error:', error)
    return {}
  }
}

export async function fetchKalshi(): Promise<Market[]> {
  const keyId = process.env.KALSHI_API_KEY_ID
  if (!keyId || keyId === 'placeholder') {
    console.log('Kalshi API key not set — skipping')
    return []
  }

  try {
    const path = '/markets?limit=50&status=open'
    const headers = getKalshiHeaders('GET', path)

    if (Object.keys(headers).length === 0) return []

    const response = await fetch(
      `https://trading-api.kalshi.com/trade-api/v2${path}`,
      { headers, next: { revalidate: 300 } }
    )

    if (!response.ok) throw new Error(`Kalshi error: ${response.status}`)
    const data = await response.json()
    const markets = data.markets || []

    return markets.map((m: any) => {
      const yesCents = m.yes_ask ?? m.last_price ?? null
      const probability = yesCents !== null ? yesCents / 100 : null
      const vol = m.volume ? m.volume * 0.01 : null

      return {
        id: `kalshi-${m.ticker}`,
        platform: 'kalshi' as const,
        question: m.title,
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
              month: 'short',
              year: 'numeric',
            })
          : null,
        traders: null,
        category: m.category || null,
        url: `https://kalshi.com/markets/${m.ticker}`,
        status: 'active' as const,
        fetched_at: new Date().toISOString(),
      }
    })
  } catch (error) {
    console.error('Kalshi fetch error:', error)
    return []
  }
}