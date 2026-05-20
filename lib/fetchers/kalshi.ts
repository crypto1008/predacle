import { Market } from '../types'

export async function fetchKalshi(): Promise<Market[]> {
  const apiKey = process.env.KALSHI_API_KEY
  if (!apiKey || apiKey === 'placeholder') {
    console.log('Kalshi API key not set — skipping')
    return []
  }
  try {
    const response = await fetch(
      'https://trading-api.kalshi.com/trade-api/v2/markets?limit=50&status=open',
      {
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 300 },
      }
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
        end_date: m.close_time ? new Date(m.close_time).toISOString().split('T')[0] : null,
        end_date_label: m.close_time
          ? new Date(m.close_time).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
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