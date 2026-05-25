import { Market } from '../types'

const AZURO_GRAPHQL =
  'https://thegraph.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-api-polygon-v3'

function buildQuery(nowTs: number) {
  return `
    query ActiveGames {
      games(
        where: {
          status: Created
          startsAt_gt: "${nowTs}"
        }
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
          conditionId
          status
          outcomes {
            outcomeId
            currentOdds
          }
        }
      }
    }
  `
}

function oddsToProbability(oddsStr: string | null | undefined): number | null {
  if (!oddsStr) return null
  const raw = parseFloat(oddsStr)
  if (!raw || raw <= 0) return null
  // Handle both decimal odds (1.92) and 1e18 format (1920000000000000000)
  const odds = raw > 1e9 ? raw / 1e18 : raw
  if (odds <= 1) return null
  const prob = 1 / odds
  return Math.min(0.9999, Math.max(0.0001, prob))
}

function mapSport(sportName: string): string {
  const s = (sportName || '').toLowerCase()
  if (s.includes('football') || s.includes('soccer')) return 'sports'
  if (s.includes('basket'))  return 'sports'
  if (s.includes('tennis'))  return 'sports'
  if (s.includes('hockey'))  return 'sports'
  if (s.includes('baseball'))return 'sports'
  if (s.includes('cricket')) return 'sports'
  if (s.includes('rugby'))   return 'sports'
  if (s.includes('esport'))  return 'sports'
  if (s.includes('mma') || s.includes('boxing')) return 'sports'
  return 'sports'
}

export async function fetchAzuro(): Promise<Market[]> {
  try {
    console.log('Azuro: fetching...')

    // Only fetch games starting in the FUTURE
    const nowTs = Math.floor(Date.now() / 1000)

    const response = await fetch(AZURO_GRAPHQL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body:  JSON.stringify({ query: buildQuery(nowTs) }),
      cache: 'no-store',
    })

    console.log(`Azuro: status ${response.status}`)
    if (!response.ok) return []

    const json  = await response.json()

    if (json?.errors) {
      console.error('Azuro GraphQL errors:', JSON.stringify(json.errors))
      return []
    }

    const games = json?.data?.games || []
    console.log(`Azuro: ${games.length} future games received`)

    // Debug first game
    if (games.length > 0) {
      const g = games[0]
      console.log('Azuro first game:', JSON.stringify({
        title:      g.title,
        startsAt:   new Date(parseInt(g.startsAt) * 1000).toISOString(),
        conditions: g.conditions?.length,
        firstOdds:  g.conditions?.[0]?.outcomes?.[0]?.currentOdds,
      }))
    }

    return games
      .filter((g: any) => g.participants?.length >= 2 || g.title)
      .map((g: any) => {
        const p0 = g.participants?.[0]?.name || 'Team A'
        const p1 = g.participants?.[1]?.name || 'Team B'

        // Build clean question
        const league   = g.league?.name ? ` (${g.league.name})` : ''
        const question = g.title
          ? g.title.replace('–', 'vs')
          : `Will ${p0} beat ${p1}?${league}`

        // Probability from first outcome odds
        const outcomes    = g.conditions?.[0]?.outcomes || []
        const probability = outcomes.length > 0
          ? oddsToProbability(outcomes[0]?.currentOdds)
          : null

        // End date from startsAt (Unix seconds → Date)
        const startsAt  = g.startsAt ? parseInt(g.startsAt) : null
        const startDate = startsAt ? new Date(startsAt * 1000) : null

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
                month: 'short',
                day:   'numeric',
                year:  'numeric',
              })
            : null,
          traders:  null,
          category: mapSport(g.sport?.name || ''),
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