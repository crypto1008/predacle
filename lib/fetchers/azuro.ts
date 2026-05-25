import { Market } from '../types'

const AZURO_API = 'https://api.onchainfeed.org/api/v1/public'

function oddsToProbability(odds: number | string | null | undefined): number | null {
  if (!odds) return null
  const v = typeof odds === 'string' ? parseFloat(odds) : odds
  if (!v || v <= 1) return null
  return Math.min(0.9999, Math.max(0.0001, 1 / v))
}

function mapSport(sportName: string): string {
  const s = (sportName || '').toLowerCase()
  if (s.includes('football') || s.includes('soccer')) return 'sports'
  if (s.includes('basket'))   return 'sports'
  if (s.includes('tennis'))   return 'sports'
  if (s.includes('hockey'))   return 'sports'
  if (s.includes('baseball')) return 'sports'
  if (s.includes('cricket'))  return 'sports'
  if (s.includes('rugby'))    return 'sports'
  if (s.includes('esport'))   return 'sports'
  if (s.includes('mma') || s.includes('boxing')) return 'sports'
  return 'sports'
}

export async function fetchAzuro(): Promise<Market[]> {
  try {
    console.log('Azuro: fetching from REST API...')

    // Try the new Backend REST API for prematch games
    const url = `${AZURO_API}/gateway/games?state=prematch&limit=100&withConditions=true`
    const response = await fetch(url, {
      headers: {
        'Accept':     'application/json',
        'User-Agent': 'Predacle/1.0',
      },
      cache: 'no-store',
    })

    console.log(`Azuro REST: status ${response.status}`)

    if (!response.ok) {
      // Fallback: try without withConditions
      console.log('Azuro: trying fallback endpoint...')
      const fallbackRes = await fetch(`${AZURO_API}/gateway/games?state=prematch&limit=100`, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      })
      console.log(`Azuro fallback: status ${fallbackRes.status}`)
      if (!fallbackRes.ok) return []
      const fallbackData = await fallbackRes.json()
      console.log('Azuro fallback response keys:', Object.keys(fallbackData))
      return []
    }

    const data = await response.json()
    console.log('Azuro REST response keys:', Object.keys(data))

    // Handle various response formats
    const games = data.games || data.data || data.items || data || []
    const gameList = Array.isArray(games) ? games : []

    console.log(`Azuro: ${gameList.length} games received`)

    if (gameList.length > 0) {
      const sample = gameList[0]
      console.log('Azuro game sample:', JSON.stringify({
        id:           sample.id || sample.gameId,
        title:        sample.title,
        startsAt:     sample.startsAt,
        sport:        sample.sport?.name || sample.sportName,
        participants: sample.participants?.map((p: any) => p.name),
        conditions:   sample.conditions?.length,
      }))
    }

    return gameList
      .filter((g: any) => g.participants?.length >= 2 || g.title || g.name)
      .map((g: any) => {
        const p0       = g.participants?.[0]?.name || 'Team A'
        const p1       = g.participants?.[1]?.name || 'Team B'
        const sportName = g.sport?.name || g.sportName || 'Sports'
        const league   = g.league?.name || g.leagueName || ''

        const question = g.title || g.name
          ? (g.title || g.name).replace('–', 'vs')
          : `Will ${p0} beat ${p1}?${league ? ` (${league})` : ''}`

        // Get probability from conditions/outcomes
        let probability: number | null = null
        const conditions = g.conditions || g.markets || []
        if (conditions.length > 0) {
          const outcomes = conditions[0]?.outcomes || conditions[0]?.selections || []
          if (outcomes.length > 0) {
            const firstOdds = outcomes[0]?.currentOdds || outcomes[0]?.odds || outcomes[0]?.price
            probability = oddsToProbability(firstOdds)
          }
        }

        // Handle startsAt as Unix seconds or ISO string
        let startDate: Date | null = null
        if (g.startsAt) {
          const ts = typeof g.startsAt === 'number' || /^\d+$/.test(String(g.startsAt))
            ? new Date(parseInt(String(g.startsAt)) * (String(g.startsAt).length === 10 ? 1000 : 1))
            : new Date(g.startsAt)
          if (!isNaN(ts.getTime())) startDate = ts
        }

        const gameId = g.id || g.gameId || Math.random().toString(36).slice(2)

        return {
          id:       `azuro-${gameId}`,
          platform: 'azuro' as const,
          question,
          probability,
          volume:       null,
          volume_label: null,
          end_date: startDate
            ? startDate.toISOString().split('T')[0]
            : null,
          end_date_label: startDate
            ? startDate.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
            : null,
          traders:  null,
          category: mapSport(sportName),
          url:      'https://azuro.org',
          status:   'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error: any) {
    console.error('Azuro error:', error.message)
    return []
  }
}