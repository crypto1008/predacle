import { inferCategory } from '../utils/category'
import { Market } from '../types'

export async function fetchPolymarket(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume24hr&ascending=false',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      }
    )

    console.log(`Polymarket Gamma status: ${response.status}`)
    if (!response.ok) throw new Error(`Polymarket error: ${response.status}`)

    const markets = await response.json()
    const list = Array.isArray(markets) ? markets : markets.data || []

    console.log(`Polymarket Gamma: ${list.length} markets`)

    return list
      .filter((m: any) => m.question && m.active && !m.closed)
      .map((m: any) => {
        const probability = m.outcomePrices
          ? parseFloat(JSON.parse(m.outcomePrices)[0])
          : m.bestBid
          ? parseFloat(m.bestBid)
          : null

        const vol = parseFloat(m.volume || m.volume24hr || 0)

        // Use event slug for URL (more reliable than market slug)
        const eventSlug = m.events?.[0]?.slug
          || m.event_slug
          || m.eventSlug
          || m.groupSlug
          || m.slug
          || m.conditionId

        const url = m.url
          || m.link
          || (eventSlug ? `https://polymarket.com/event/${eventSlug}` : 'https://polymarket.com')

        return {
          id: `polymarket-${m.conditionId || m.id}`,
          platform: 'polymarket' as const,
          question: m.question,
          probability: probability && probability > 0 && probability < 1 ? probability : null,
          volume: vol || null,
          volume_label: vol > 0
            ? vol >= 1_000_000
              ? `$${(vol / 1_000_000).toFixed(1)}M`
              : `$${Math.round(vol).toLocaleString()}`
            : null,
          end_date: m.endDate || null,
          end_date_label: m.endDate
            ? new Date(m.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : null,
          traders: m.uniqueBettors ? parseInt(m.uniqueBettors) : null,
          category: (m.category && m.category !== 'All' && m.category !== 'all')
            ? m.category
            : inferCategory(m.question || ''),
          url,
          status: 'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error: any) {
    console.error('Polymarket fetch error:', error.message)
    return []
  }
}