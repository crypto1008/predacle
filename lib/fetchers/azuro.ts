import { Market } from '../types'

const AZURO_FEED =
  'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-polygon'

function oddsToProbability(odds: string | number | null | undefined): number | null {
  if (!odds) return null
  const v = typeof odds === 'string' ? parseFloat(odds) : odds
  if (!v || v <= 1) return null
  return Math.min(0.9999, Math.max(0.0001, 1 / v))
}

function getSportUrl(sportSlug: string, sportName: string): string {
  const s    = (sportSlug || sportName || '').toLowerCase()
  const base = 'https://bookmaker.xyz/polygon/live'
  if (s.includes('football') || s.includes('soccer')) return `${base}/football`
  if (s.includes('basket'))   return `${base}/basketball`
  if (s.includes('tennis'))   return `${base}/tennis`
  if (s.includes('hockey'))   return `${base}/ice-hockey`
  if (s.includes('baseball')) return `${base}/baseball`
  if (s.includes('cricket'))  return `${base}/cricket`
  if (s.includes('mma') || s.includes('boxing')) return `${base}/mma`
  if (s.includes('esport'))   return `${base}/esports`
  if (s.includes('rugby'))    return `${base}/rugby-union`
  if (s.includes('volley'))   return `${base}/volleyball`
  if (s.includes('table'))    return `${base}/table-tennis`
  return `${base}/football`
}

export async function fetchAzuro(): Promise<Market[]> {
  try {
    console.log('Azuro: fetching from data-feed subgraph...')

    const nowTs = Math.floor(Date.now() / 1000)
    const query = `
      query PrematchGames {
        games(
          where: {
            state: Prematch
            activeConditionsCount_gt: 0
            startsAt_gt: "${nowTs}"
          }
          first: 100
          orderBy: startsAt
          orderDirection: asc
        ) {
          id
          gameId
          title
          startsAt
          sport { name slug }
          league { name country { name } }
          participants { name }
          conditions(
            where: { state: Active, isPrematchEnabled: true }
            first: 1
          ) {
            conditionId
            outcomes {
              outcomeId
              currentOdds
            }
          }
        }
      }
    `

    const response = await fetch(AZURO_FEED, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body:  JSON.stringify({ query }),
      cache: 'no-store',
    })

    console.log(`Azuro: status ${response.status}`)
    if (!response.ok) return []

    const json = await response.json()

    if (json?.errors) {
      console.error('Azuro GraphQL errors:', JSON.stringify(json.errors))
      return []
    }

    const games = json?.data?.games || []
    console.log(`Azuro: ${games.length} prematch games with active conditions`)

    if (games.length > 0) {
      const g = games[0]
      console.log('Azuro sample:', JSON.stringify({
        title:     g.title,
        startsAt:  new Date(parseInt(g.startsAt) * 1000).toISOString(),
        sport:     g.sport?.name,
        conditions: g.conditions?.length,
        firstOdds: g.conditions?.[0]?.outcomes?.[0]?.currentOdds,
      }))
    }

    return games
      .filter((g: any) => g.participants?.length >= 2 || g.title)
      .map((g: any) => {
        const p0        = g.participants?.[0]?.name || 'Team A'
        const p1        = g.participants?.[1]?.name || 'Team B'
        const sportName = g.sport?.name || ''
        const sportSlug = g.sport?.slug || ''

        const question = g.title
          ? g.title.replace('–', 'vs').replace('—', 'vs')
          : `${p0} vs ${p1}`

        // Probability from first condition's first outcome odds
        const outcomes    = g.conditions?.[0]?.outcomes || []
        const probability = outcomes.length > 0
          ? oddsToProbability(outcomes[0]?.currentOdds)
          : null

        // Parse startsAt (Unix seconds)
        const startsAt  = g.startsAt ? parseInt(g.startsAt) : null
        const startDate = startsAt ? new Date(startsAt * 1000) : null

        // Sport-specific bookmaker.xyz URL
        const url = getSportUrl(sportSlug, sportName)

        return {
          id:       `azuro-${g.gameId || g.id}`,
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
          category: 'sports',
          url,
          status:   'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error: any) {
    console.error('Azuro error:', error.message)
    return []
  }
}