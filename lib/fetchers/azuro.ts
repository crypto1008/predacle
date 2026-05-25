import { Market } from '../types'

// Gnosis chain is empty — all sports are on Polygon
const FEED = 'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-polygon'

// All sports with confirmed slugs + per-sport game limits
const SPORTS = [
  { slug: 'football',    limit: 25 },
  { slug: 'basketball',  limit: 20 },
  { slug: 'table-tennis',limit: 15 },
  { slug: 'tennis',      limit: 15 },
  { slug: 'cs2',         limit: 12 },
  { slug: 'cricket',     limit: 12 },
  { slug: 'mma',         limit: 10 },
  { slug: 'baseball',    limit: 10 },
  { slug: 'lol',         limit: 10 }, // League of Legends — slug is "lol" not "league-of-legends"
  { slug: 'ice-hockey',  limit: 8  },
  { slug: 'boxing',      limit: 8  },
  { slug: 'dota-2',      limit: 5  },
  { slug: 'volleyball',  limit: 2  },
  { slug: 'rugby-union', limit: 6  },
  { slug: 'rugby-league',limit: 3  },
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

function buildGameUrl(g: any): string {
  // Use sport slug directly from API — it's already the correct bookmaker.xyz slug
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

function getCategory(sportSlug: string): string {
  const esports = ['cs2', 'lol', 'dota-2']
  return esports.includes(sportSlug) ? 'tech' : 'sports'
}

async function fetchSport(sportSlug: string, limit: number, nowTs: number): Promise<any[]> {
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
        conditions(
          where: { state: Active, isPrematchEnabled: true }
          first: 1
        ) {
          outcomes {
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
    if (!res.ok) return []
    const json = await res.json()
    return json?.data?.games || []
  } catch {
    return []
  }
}

export async function fetchAzuro(): Promise<Market[]> {
  console.log('Azuro: fetching all sports from Polygon data-feed...')

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

    let sportCount = 0
    for (const g of result.value) {
      const gameId = String(g.gameId || g.id)
      if (seen.has(gameId)) continue

      // Only include games with valid odds — every card will show probability
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
        category:   getCategory(sportSlug),
        url:        buildGameUrl(g),
        status:     'active' as const,
        fetched_at: new Date().toISOString(),
      })
      sportCount++
    }

    if (sportCount > 0) {
      console.log(`Azuro ${sportSlug}: ${sportCount} games`)
    }
  }

  console.log(`Azuro total: ${markets.length} markets across ${SPORTS.length} sports`)
  return markets
}