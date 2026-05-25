import { inferCategory } from '../utils/category'
import { Market } from '../types'

export async function fetchManifold(): Promise<Market[]> {
  try {
    const response = await fetch(
      // sort=last-bet-time gets recently active markets, not just newest created
      'https://api.manifold.markets/v0/markets?limit=100&sort=last-bet-time',
      {
        headers: {
          'User-Agent': 'Predacle/1.0 (https://predacle.com)',
          'Accept':     'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) throw new Error(`Manifold error: ${response.status}`)
    const data = await response.json()

    return data
      .filter((m: any) =>
        m.outcomeType === 'BINARY' &&
        m.probability != null &&
        !m.isResolved &&
        (m.uniqueBettorCount || 0) >= 10  // skip ghost markets with 1-2 bettors
      )
      .map((m: any) => {
        const vol       = m.volume || 0
        const closeTime = m.closeTime ? new Date(m.closeTime) : null
        const isExpired = closeTime && closeTime < new Date()

        // Manifold uses Mana (M$) — NOT real USD. Label clearly.
        const volume_label = vol > 0
          ? vol >= 1_000_000
            ? `M$${(vol / 1_000_000).toFixed(1)}M`
            : `M$${Math.round(vol).toLocaleString()}`
          : null

        // Category: prefer groupSlugs mapping, fall back to inferCategory
        const rawGroup = m.groupSlugs?.[0] || ''
        const category = (() => {
          if (!rawGroup) return inferCategory(m.question || '')
          const g = rawGroup.toLowerCase()
          if (g.includes('crypto') || g.includes('bitcoin') || g.includes('ethereum')) return 'crypto'
          if (g.includes('politic') || g.includes('election') || g.includes('government')) return 'politics'
          if (g.includes('econom') || g.includes('finance') || g.includes('stock') || g.includes('market')) return 'economics'
          if (g.includes('sport') || g.includes('football') || g.includes('soccer') || g.includes('basketball') || g.includes('nba') || g.includes('nfl')) return 'sports'
          if (g.includes('tech') || g.includes('ai') || g.includes('science') || g.includes('software')) return 'tech'
          if (g.includes('entertain') || g.includes('film') || g.includes('music') || g.includes('celebrity')) return 'entertainment'
          return inferCategory(m.question || '')
        })()

        return {
          id:           `manifold-${m.id}`,
          platform:     'manifold' as const,
          question:     m.question,
          probability:  m.probability,
          volume:       vol || null,
          volume_label,
          end_date: closeTime
            ? closeTime.toISOString().split('T')[0]
            : null,
          end_date_label: closeTime
            ? closeTime.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : null,
          traders:    m.uniqueBettorCount || null,
          category,
          url:        m.url || 'https://manifold.markets',
          status:     isExpired ? 'closed' : 'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error) {
    console.error('Manifold fetch error:', error)
    return []
  }
}