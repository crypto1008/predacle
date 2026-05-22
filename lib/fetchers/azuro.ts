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
      conditions(where: { status: Created }, first: 1) {
        outcomes {
          outcomeId
          currentOdds
        }
      }
    }
  }
`

export async function fetchAzuro(): Promise<Market[]> {
  try {
    console.log('Azuro: fetching...')

    const response = await fetch(AZURO_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query: QUERY }),
      cache: 'no-store',
    })

    console.log(`Azuro: status ${response.status}`)
    if (!response.ok) return []

    const json = await response.json()
    const games = json?.data?.games || []

    console.log(`Azuro: ${games.length} games received`)

    return games
      .filter((g: any) => g.title || g.participants?.length >= 2)
      .map((g: any) => {
        // Convert odds to probability: 1 / odds
        let probability: number | null = null
        const outcomes = g.conditions?.[0]?.outcomes || []
        if (outcomes.length > 0 && outcomes[0]?.currentOdds) {
          const odds = parseFloat(outcomes[0].currentOdds)
          if (odds > 0) {
            probability = Math.min(0.9999, Math.max(0, 1 / odds))
          }
        }

        const question =
          g.title ||
          (g.participants?.length >= 2
            ? `${g.participants[0].name} vs ${g.participants[1].name}`
            : 'Sports market')

        const sport = g.sport?.name?.toLowerCase() || 'sports'
        const league = g.league?.name || ''
        const country = g.league?.country?.name || ''

        return {
          id: `azuro-${g.gameId}`,
          platform: 'azuro',
          question,
          probability,
          volume: null,
          volume_label: null,
          end_date: g.startsAt
            ? new Date(parseInt(g.startsAt) * 1000)
                .toISOString()
                .split('T')[0]
            : null,
          end_date_label: g.startsAt
            ? new Date(parseInt(g.startsAt) * 1000).toLocaleDateString(
                'en-US',
                { month: 'short', year: 'numeric' }
              )
            : null,
          traders: null,
          category: sport,
          url: 'https://azuro.org',
          status: 'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error: any) {
    console.error('Azuro error:', error.message)
    return []
  }
}