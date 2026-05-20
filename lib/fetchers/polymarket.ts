import { Market } from '../types'

export async function fetchPolymarket(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://clob.polymarket.com/markets?next_cursor=MA==&limit=50',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        next: { revalidate: 300 }
      }
    )
    if (!response.ok) throw new Error(`Polymarket error: ${response.status}`)
    const data = await response.json()
    const markets = data.data || data.markets || []

    return markets
      .filter((m: any) => m.question && m.active)
      .map((m: any) => {
        const tokens = m.tokens || []
        const yesToken = tokens.find((t: any) => t.outcome === 'Yes')
        const probability = yesToken?.price ? parseFloat(yesToken.price) : null
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
            ? new Date(m.end_date_iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : null,
          traders: null,
          category: m.category || null,
          url: m.market_slug
            ? `https://polymarket.com/event/${m.market_slug}`
            : 'https://polymarket.com',
          status: 'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error) {
    console.error('Polymarket fetch error:', error)
    return []
  }
}