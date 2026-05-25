import { Market } from '../types'

const AZURO_GRAPHQL =
  'https://thegraph.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-api-polygon-v3'

const QUERY = `
  query ActiveGames {
    games(
      where: { status: Created }
      first: 100
      orderBy: startsAt
      orderDirection: asc
    ) {
      gameId
      title
      startsAt
      sport { name }
      league {
        name
        country { name }
      }
      participants { name }
      conditions(first: 1) {
        status
        outcomes {
          outcomeId
          currentOdds
        }
      }
    }
  }
`

function oddsToProbability(oddsStr: string): number | null {
  if (!oddsStr) return null
  const odds = parseFloat(oddsStr)
  if (!odds || odds <= 0) return null

  // Azuro odds might be in 1e18 format (BigDecimal)
  const normalised = odds > 1e9 ? odds / 1e18 : odds
  if (normalised <= 1) return null

  const prob = 1 / normalised
  return Math.min(0.9999, Math.max(0.0001, prob))
}

function inferAzuroCategory(sportName: string): string {
  const s = sportName.toLowerCase()
  if (s.includes('soccer') || s.includes('football')) return 'sports'
  if (s.includes('basket'))                            return 'sports'
  if (s.includes('tennis'))                            return 'sports'
  if (s.includes('baseball'))                          return 'sports'
  if (s.includes('hockey'))                            return 'sports'
  if (s.includes('cricket'))                           return 'sports'
  if (s.includes('rugby'))                             return 'sports'
  if (s.includes('esport') || s.includes('e-sport'))  return 'sports'
  return 'sports'
}

export async function fetchAzuro(): Promise<Market[]> {
  try {
    console.log('Azuro: fetching...')
    const response = await fetch(AZURO_GRAPHQL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body:  JSON.stringify({ query: QUERY }),
      cache: 'no-store',
    })

    console.log(`Azuro: status ${response.status}`)
    if (!response.ok) return []

    const json  = await response.json()
    const games = json?.data?.games || []
    console.log(`Azuro: ${games.length} games received`)

    // Debug first game to see odds format
    if (games.length > 0) {
      const g = games[0]
      console.log('Azuro sample:', JSON.stringify({
        gameId:     g.gameId,
        startsAt:   g.startsAt,
        conditions: g.conditions?.length,
        outcomes:   g.conditions?.[0]?.outcomes?.length,
        firstOdds:  g.conditions?.[0]?.outcomes?.[0]?.currentOdds,
      }))
    }

    return games
      .filter((g: any) => g.participants?.length >= 2 || g.title)
      .map((g: any) => {

        // Build clean question
        const p0       = g.participants?.[0]?.name || 'Team A'
        const p1       = g.participants?.[1]?.name || 'Team B'
        const sport    = g.sport?.name || 'Sports'
        const league   = g.league?.name ? ` (${g.league.name})` : ''
        const question = g.title || `Will ${p0} beat ${p1}?${league}`

        // Extract probability from first condition's first outcome
        let probability: number | null = null
        const outcomes = g.conditions?.[0]?.outcomes || []
        if (outcomes.length > 0) {
          // Try first outcome (usually home win)
          probability = oddsToProbability(outcomes[0]?.currentOdds)
        }

        // End date from startsAt (Unix timestamp in seconds)
        const startsAt  = g.startsAt ? parseInt(g.startsAt) : null
        const startDate = startsAt ? new Date(startsAt * 1000) : null

        // Category from sport name
        const category = inferAzuroCategory(sport)

        return {
          id:       `azuro-${g.gameId}`,
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
          category,
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