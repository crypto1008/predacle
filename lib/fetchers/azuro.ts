import { Market } from '../types'

const FEEDS = [
  { url: 'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-polygon', chain: 'polygon' },
  { url: 'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-gnosis', chain: 'gnosis' },
]

// Sports to fetch with per-sport limits for diversity
const SPORTS = [
  { slug: 'football',          limit: 25 },
  { slug: 'basketball',        limit: 15 },
  { slug: 'tennis',            limit: 10 },
  { slug: 'table-tennis',      limit: 8  },
  { slug: 'cricket',           limit: 8  },
  { slug: 'cs2',               limit: 8  },
  { slug: 'league-of-legends', limit: 8  },
  { slug: 'mma',               limit: 6  },
  { slug: 'boxing',            limit: 5  },
  { slug: 'ice-hockey',        limit: 5  },
  { slug: 'baseball',          limit: 5  },
  { slug: 'volleyball',        limit: 5  },
]

function toSlug(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function getSportSlug(sportName: string, sportSlug: string): string {
  const s = (sportSlug || sportName || '').toLowerCase()
  if (s === 'football' || s.includes('soccer'))           return 'football'
  if (s === 'basketball')                                  return 'basketball'
  if (s === 'tennis' && !s.includes('table'))             return 'tennis'
  if (s.includes('table') && s.includes('tennis'))        return 'table-tennis'
  if (s === 'cricket')                                     return 'cricket'
  if (s.includes('counter') || s === 'cs2' || s === 'csgo') return 'cs2'
  if (s.includes('league-of-legends') || s === 'lol')    return 'league-of-legends'
  if (s.includes('dota'))                                  return 'dota-2'
  if (s === 'mma' || s.includes('mixed-martial'))         return 'mma'
  if (s === 'boxing')                                      return 'boxing'
  if (s.includes('hockey'))                                return 'ice-hockey'
  if (s === 'baseball')                                    return 'baseball'
  if (s.includes('volleyball'))                            return 'volleyball'
  if (s.includes('rugby'))                                 return 'rugby-union'
  if (s.includes('esport'))                                return 'esports'
  return toSlug(sportName) || 'football'
}

function buildGameUrl(g: any, chain: string): string {
  const sportSlug   = getSportSlug(g.sport?.name || '', g.sport?.slug || '')
  const countrySlug = toSlug(g.league?.country?.name || '')
  const leagueSlug  = toSlug(g.league?.name || '')
  const p0Slug      = toSlug(g.participants?.[0]?.name || '')
  const p1Slug      = toSlug(g.participants?.[1]?.name || '')
  const gameId      = g.gameId || g.id

  if (countrySlug && leagueSlug && p0Slug && p1Slug && gameId) {
    return `https://bookmaker.xyz/${chain}/sports/${sportSlug}/${countrySlug}/${leagueSlug}/${p0Slug}-${p1Slug}-${gameId}`
  }
  return `https://bookmaker.xyz/${chain}/live/${sportSlug}`
}

function oddsToProbability(odds: string | number | null | undefined): number | null {
  if (!odds) return null
  const v = typeof odds === 'string' ? parseFloat(odds) : odds
  if (!v || v <= 1) return null
  return Math.min(0.9999, Math.max(0.0001, 1 / v))
}

function buildSportQuery(sportSlug: string, limit: number, nowTs: number): string {
  return `
    query {
      games(
        where: {
          state: Prematch
          activeConditionsCount_gt: 0
          startsAt_gt: "${nowTs}"
          sport_: { slug: "${sportSlug}" }
        }
        first: ${limit}
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
}

async function fetchSportFromFeed(
  feedUrl: string,
  chain: string,
  sportSlug: string,
  limit: number,
  nowTs: number
): Promise<{ game: any; chain: string }[]> {
  try {
    const res = await fetch(feedUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ query: buildSportQuery(sportSlug, limit, nowTs) }),
      cache:   'no-store',
    })
    if (!res.ok) return []
    const json = await res.json()
    if (json?.errors) return []
    const games = json?.data?.games || []
    return games.map((g: any) => ({ game: g, chain }))
  } catch {
    return []
  }
}

export async function fetchAzuro(): Promise<Market[]> {
  console.log('Azuro: fetching multiple sports from multiple chains...')

  const nowTs = Math.floor(Date.now() / 1000)
  const seen  = new Set<string>()

  // Fetch each sport from each chain in parallel
  const fetchTasks = FEEDS.flatMap(feed =>
    SPORTS.map(sport =>
      fetchSportFromFeed(feed.url, feed.chain, sport.slug, sport.limit, nowTs)
    )
  )

  const results = await Promise.allSettled(fetchTasks)

  const allEntries: { game: any; chain: string }[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const entry of result.value) {
        const id = String(entry.game.gameId || entry.game.id)
        if (seen.has(id)) continue
        seen.add(id)
        allEntries.push(entry)
      }
    }
  }

  // Only keep games with valid odds data — ensures all cards show probability
  const withOdds = allEntries.filter(({ game }) => {
    const outcomes = game.conditions?.[0]?.outcomes || []
    if (outcomes.length === 0) return false
    const odds = parseFloat(outcomes[0]?.currentOdds || '0')
    return odds > 1
  })

  console.log(`Azuro: ${allEntries.length} total games, ${withOdds.length} with valid odds`)

  // Log sport breakdown
  const sportCounts: Record<string, number> = {}
  for (const { game } of withOdds) {
    const s = game.sport?.name || 'Unknown'
    sportCounts[s] = (sportCounts[s] || 0) + 1
  }
  console.log('Azuro sport breakdown:', JSON.stringify(sportCounts))

  return withOdds.map(({ game: g, chain }) => {
    const p0        = g.participants?.[0]?.name || 'Team A'
    const p1        = g.participants?.[1]?.name || 'Team B'
    const sportName = g.sport?.name || ''
    const sportSlug = getSportSlug(sportName, g.sport?.slug || '')

    const question = g.title
      ? g.title.replace('–', 'vs').replace('—', 'vs')
      : `${p0} vs ${p1}`

    const outcomes    = g.conditions?.[0]?.outcomes || []
    const probability = oddsToProbability(outcomes[0]?.currentOdds)

    const startsAt  = g.startsAt ? parseInt(g.startsAt) : null
    const startDate = startsAt ? new Date(startsAt * 1000) : null

    const category = ['cs2','league-of-legends','dota-2','esports']
      .includes(sportSlug) ? 'tech' : 'sports'

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
      url:    buildGameUrl(g, chain),
      status: 'active' as const,
      fetched_at: new Date().toISOString(),
    }
  })
}