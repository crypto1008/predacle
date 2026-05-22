import { inferCategory } from '../utils/category'
import { Market } from '../types'

export async function fetchManifold(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://api.manifold.markets/v0/markets?limit=50',
      {
        headers: {
          'User-Agent': 'Predacle/1.0 (https://predacle.com)',
          'Accept': 'application/json',
        },
        next: { revalidate: 300 }
      }
    )
    if (!response.ok) throw new Error(`Manifold error: ${response.status}`)
    const data = await response.json()

    return data
      .filter((m: any) => m.outcomeType === 'BINARY' && m.probability != null && !m.isResolved)
      .map((m: any) => {
        const vol = m.volume || 0
        const closeTime = m.closeTime ? new Date(m.closeTime) : null
        const isExpired = closeTime && closeTime < new Date()
        return {
          id: `manifold-${m.id}`,
          platform: 'manifold' as const,
          question: m.question,
          probability: m.probability,
          volume: vol || null,
          volume_label: vol > 0 ? `$${Math.round(vol).toLocaleString()}` : null,
          end_date: closeTime ? closeTime.toISOString().split('T')[0] : null,
          end_date_label: closeTime
            ? closeTime.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : null,
          traders: m.uniqueBettorCount || null,
          category: m.groupSlugs?.[0]?.replace(/-/g, ' ') || inferCategory(m.question || ''),
          url: m.url || 'https://manifold.markets',
          status: isExpired ? 'closed' : 'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error) {
    console.error('Manifold fetch error:', error)
    return []
  }
}