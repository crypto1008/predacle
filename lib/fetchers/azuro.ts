import { Market } from '../types'

// Multiple chains for more sports coverage
const FEEDS = [
  'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-polygon',
  'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-gnosis',
]

function toSlug(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function getSportSlug(sportName: string): string {
  const s = (sportName || '').toLowerCase()
  if (s.includes('football') || s.includes('soccer')) return 'football'
  if (s.includes('basket'))                            return 'basketball'
  if (s.includes('tennis') && !s.includes('table'))   return 'tennis'
  if (s.includes('table tennis'))                      return 'table-tennis'
  if (s.includes('cricket'))                           return 'cricket'
  if (s.includes('counter-strike') || s.includes('cs2') || s.includes('csgo')) return 'cs2'
  if (s.includes('league of legends') || s.includes('lol')) return 'league-of-legends'
  if (s.includes('dota'))                              return 'dota-2'
  if (s.includes('mma') || s.includes('martial'))     return 'mma'
  if (s.includes('boxing'))                            return 'boxing'
  if (s.includes('hockey'))                            return 'ice-hockey'
  if (s.includes('baseball'))                          return 'baseball'
  if (s.includes('volleyball'))                        return 'volleyball'
  if (s.includes('rugby'))                             return 'rugby-union'
  if (s.includes('esport') || s.includes('e-sport'))  return 'esports'
  return toSlug(sportName) || 'football'
}

function buildGameUrl(g: any): string {
  const sportSlug   = getSportSlug(g.sport?.name || '')
  const countrySlug = toSlug(g.league?.country?.name || '')
  const leagueSlug  = toSlug(g.league?.name || '')
  const p0Slug      = toSlug(g.participants?.[0]?.name || 'team-a')
  const p1Slug      = toSlug(g.participants?.[1]?.name || 'team-b')
  const gameId      = g.gameId || g.id

  if (countrySlug && leagueSlug && p0Slug && p1Slug && gameId) {
    return `https://bookmaker.xyz/polygon/sports/${sportSlug}/${countrySlug}/${leagueSlug}/${p0Slug}-${p1Slug}-${gameId}`
  }
  return `https://bookmaker.xyz/polygon/live/${sportSlug}`
}

function oddsToProbability(odds: string | number | null | undefined): number | null {
  if (!odds) return null
  const v = typeof odds === 'string' ? parseFloat(odds) : odds
  if (!v || v <= 1) return null
  return Math.min(0.9999, Math.max(0.0001, 1 / v))
}

async function fetchFromFeed(feedUrl: string, nowTs: number): Promise<any[]> {
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
  try {
    const res = await fetch(feedUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ query }),
      cache:   'no-store',
    })
    if (!res.ok) return []
    const json = await res.json()
    if (json?.errors) {
      console.error('Azuro GraphQL error:', JSON.stringify(json.errors))
      return []
    }
    return json?.data?.games || []
  } catch (e: any) {
    console.error(`Azuro feed error (${feedUrl}):`, e.message)
    return []
  }
}

export async function fetchAzuro(): Promise<Market[]> {
  console.log('Azuro: fetching from multiple chains...')

  const nowTs = Math.floor(Date.now() / 1000)

  // Fetch from all chains in parallel
  const results = await Promise.allSettled(
    FEEDS.map(feed => fetchFromFeed(feed, nowTs))
  )

  // Merge and deduplicate by gameId
  const seen       = new Set<string>()
  const allGames: any[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const g of result.value) {
        const id = String(g.gameId || g.id)
        if (seen.has(id)) continue
        seen.add(id)
        allGames.push(g)
      }
    }
  }

  console.log(`Azuro: ${allGames.length} total games across all chains`)

  // Log sport breakdown
  const sportCounts: Record<string, number> = {}
  for (const g of allGames) {
    const sport = g.sport?.name || 'Unknown'
    sportCounts[sport] = (sportCounts[sport] || 0) + 1
  }
  console.log('Azuro sports:', JSON.stringify(sportCounts))

  return allGames
    .filter((g: any) => g.participants?.length >= 2 || g.title)
    .map((g: any) => {
      const p0        = g.participants?.[0]?.name || 'Team A'
      const p1        = g.participants?.[1]?.name || 'Team B'
      const sportName = g.sport?.name || ''

      const question = g.title
        ? g.title.replace('–', 'vs').replace('—', 'vs')
        : `${p0} vs ${p1}`

      // Probability from first condition odds
      const outcomes    = g.conditions?.[0]?.outcomes || []
      const probability = outcomes.length > 0
        ? oddsToProbability(outcomes[0]?.currentOdds)
        : null

      // Start date
      const startsAt  = g.startsAt ? parseInt(g.startsAt) : null
      const startDate = startsAt ? new Date(startsAt * 1000) : null

      // Specific game URL
      const url = buildGameUrl(g)

      // Category from sport
      const sportSlug = getSportSlug(sportName)
      const category  = (() => {
        if (['cs2', 'league-of-legends', 'dota-2', 'esports'].includes(sportSlug)) return 'tech'
        return 'sports'
      })()

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
              month: 'short', day: 'numeric', year: 'numeric',
            })
          : null,
        traders:  null,
        category,
        url,
        status:   'active' as const,
        fetched_at: new Date().toISOString(),
      }
    })
}