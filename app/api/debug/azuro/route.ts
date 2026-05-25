import { NextResponse } from 'next/server'

const FEEDS = [
  { url: 'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-polygon', chain: 'polygon' },
  { url: 'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-gnosis', chain: 'gnosis' },
]

export async function GET() {
  const nowTs = Math.floor(Date.now() / 1000)

  // Query sports that actually exist with prematch games
  const sportQuery = `
    query {
      sports {
        id
        name
        slug
        activePrematchGamesCount
        activePrematchLeaguesCount
      }
    }
  `

  // Also fetch 10 non-football games to see what's there
  const gamesQuery = `
    query {
      games(
        where: {
          state: Prematch
          activeConditionsCount_gt: 0
          startsAt_gt: "${nowTs}"
        }
        first: 200
        orderBy: startsAt
        orderDirection: asc
      ) {
        gameId
        sport { name slug }
      }
    }
  `

  const results: any = {}

  for (const feed of FEEDS) {
    try {
      // Fetch sports list
      const sportRes = await fetch(feed.url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: sportQuery }),
        cache:   'no-store',
      })
      const sportData = await sportRes.json()

      // Fetch games and count by sport
      const gamesRes = await fetch(feed.url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ query: gamesQuery }),
        cache:   'no-store',
      })
      const gamesData = await gamesRes.json()

      const games = gamesData?.data?.games || []
      const sportCounts: Record<string, { count: number; slug: string }> = {}
      for (const g of games) {
        const name = g.sport?.name || 'Unknown'
        const slug = g.sport?.slug || '?'
        if (!sportCounts[name]) sportCounts[name] = { count: 0, slug }
        sportCounts[name].count++
      }

      results[feed.chain] = {
        sports_entity:  sportData?.data?.sports || sportData?.errors,
        games_by_sport: sportCounts,
        total_games:    games.length,
      }
    } catch (e: any) {
      results[feed.chain] = { error: e.message }
    }
  }

  return NextResponse.json(results)
}