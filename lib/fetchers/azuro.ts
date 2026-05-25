import { Market } from '../types'

const FEED = 'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-polygon'

const SPORTS = [
  { slug: 'football',     limit: 25 },
  { slug: 'basketball',   limit: 20 },
  { slug: 'table-tennis', limit: 15 },
  { slug: 'tennis',       limit: 15 },
  { slug: 'cs2',          limit: 12 },
  { slug: 'cricket',      limit: 12 },
  { slug: 'mma',          limit: 10 },
  { slug: 'baseball',     limit: 10 },
  { slug: 'lol',          limit: 10 },
  { slug: 'ice-hockey',   limit: 8  },
  { slug: 'boxing',       limit: 8  },
  { slug: 'dota-2',       limit: 5  },
  { slug: 'volleyball',   limit: 2  },
  { slug: 'rugby-union',  limit: 6  },
  { slug: 'rugby-league', limit: 3  },
]

const ESPORTS = new Set(['cs2', 'lol', 'dota-2'])

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

function buildGameUrl(g: any): string {
  const sportSlug   = g.sport?.slug || 'football'
  const countrySlug = toSlug(g.league?.country?.name || '')
  const leagueSlug  = toSlug(g.league?.name || '')
  const p0Slug      = toSlug(g.participants?.[0]?.name || '')
  const p1Slug      = toSlug(g.participants?.[1]?.name || '')
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

async function fetchSport(sportSlug: string, limit: number, nowTs: number): Promise<any[]> {
  // No nested conditions filter — activeConditionsCount_gt: 0 already guarantees
  // active conditions exist. Nested where was stripping non-football odds.
  const query = `
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
        conditions(first: 1) {
          outcomes(first: 2) {
            currentOdds
          }
        }
      }
    }
  `
  try {
    const res = await fetch(FEED, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ query }),
      cache:   'no-store',
    })
    if (!res.ok) {
      console.error(`Azuro ${sportSlug}: HTTP ${res.status}`)
      return []
    }
    const json = await res.json()
    if (json?.errors) {
      console.error(`Azuro ${sportSlug} errors:`, JSON.stringify(json.errors))
      return []
    }
    const games = json?.data?.games || []
    console.log(`Azuro ${sportSlug}: ${games.length} games fetched`)
    return games
  } catch (e: any) {
    console.error(`Azuro ${sportSlug} fetch error:`, e.message)
    return []
  }
}

export async function fetchAzuro(): Promise<Market[]> {
  console.log('Azuro: fetching all 15 sports from Polygon data-feed...')

  const nowTs   = Math.floor(Date.now() / 1000)

  const results = await Promise.allSettled(
    SPORTS.map(s => fetchSport(s.slug, s.limit, nowTs))
  )

  const seen    = new Set<string>()
  const markets: Market[] = []

  for (let i = 0; i < results.length; i++) {
    const result    = results[i]
    const sportSlug = SPORTS[i].slug
    if (result.status !== 'fulfilled') continue

    for (const g of result.value) {
      const gameId = String(g.gameId || g.id)
      if (seen.has(gameId)) continue

      // Need valid odds — skip games where bookmaker hasn't posted yet
      const odds = parseFloat(g.conditions?.[0]?.outcomes?.[0]?.currentOdds || '0')
      if (odds <= 1) continue

      seen.add(gameId)

      const p0       = g.participants?.[0]?.name || 'Team A'
      const p1       = g.participants?.[1]?.name || 'Team B'
      const question = g.title
        ? g.title.replace('–', 'vs').replace('—', 'vs')
        : `${p0} vs ${p1}`

      const startsAt  = g.startsAt ? parseInt(g.startsAt) : null
      const startDate = startsAt ? new Date(startsAt * 1000) : null

      markets.push({
        id:       `azuro-${gameId}`,
        platform: 'azuro' as const,
        question,
        probability:  oddsToProbability(odds),
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
        traders:    null,
        category:   ESPORTS.has(sportSlug) ? 'tech' : 'sports',
        url:        buildGameUrl(g),
        status:     'active' as const,
        fetched_at: new Date().toISOString(),
      })
    }
  }

  const sportBreakdown = markets.reduce((acc, m) => {
    const sport = m.url.split('/')[6] || 'unknown'
    acc[sport] = (acc[sport] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`Azuro total: ${markets.length} markets`)
  console.log('Azuro breakdown:', JSON.stringify(sportBreakdown))

  return markets
}