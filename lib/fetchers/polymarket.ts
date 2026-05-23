import { inferCategory } from '../utils/category'
import { Market } from '../types'

export async function fetchPolymarket(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://clob.polymarket.com/markets?next_cursor=MA==&limit=200',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) throw new Error(`Polymarket error: ${response.status}`)

    const data = await response.json()
    const markets = data.data || data.markets || []

    // Only keep markets with end dates in the future or within last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    return markets
      .filter((m: any) => {
        if (!m.question || !m.active) return false
        const endDate = m.end_date_iso || m.endDate
        if (endDate) {
          const end = new Date(endDate)
          if (end < sevenDaysAgo) return false
        }
        return true
      })
      .map((m: any) => {
        const tokens = m.tokens || []
        const yesToken = tokens.find((t: any) => t.outcome === 'Yes')
        const probability = yesToken?.price
          ? parseFloat(yesToken.price)
          : null
        const vol = parseFloat(m.volume || 0)

        return {
          id: `polymarket-${m.condition_id || m.id}`,
          platform: 'polymarket' as const,
          question: m.question,
          probability,
          volume: vol || null,
          volume_label: vol > 0
            ? vol >= 1_000_000
              ? `$${(vol / 1_000_000).toFixed(1)}M`
              : `$${Math.round(vol).toLocaleString()}`
            : null,
          end_date: m.end_date_iso || null,
          end_date_label: m.end_date_iso
            ? new Date(m.end_date_iso).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })
            : null,
          traders: null,
          category: (m.category && m.category !== 'All' && m.category !== 'all')
            ? m.category
            : inferCategory(m.question || ''),
          url: m.market_slug
            ? `https://polymarket.com/event/${m.market_slug}`
            : 'https://polymarket.com',
          status: 'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error: any) {
    console.error('Polymarket fetch error:', error.message)
    return []
  }
}