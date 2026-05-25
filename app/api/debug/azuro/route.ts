import { NextResponse } from 'next/server'

const AZURO_GRAPHQL =
  'https://thegraph.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-api-polygon-v3'

export async function GET() {
  try {
    const res = await fetch(AZURO_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            games(
              where: { status: Created }
              first: 2
              orderBy: startsAt
              orderDirection: asc
            ) {
              gameId
              title
              startsAt
              sport { name }
              league { name country { name } }
              participants { name }
              conditions(first: 2) {
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
      }),
      cache: 'no-store',
    })

    const data = await res.json()
    const games = data?.data?.games || []

    return NextResponse.json({
      graphql_status: res.status,
      error:          data?.errors || null,
      games_count:    games.length,
      raw_games:      games,
      first_game_analysis: games[0] ? {
        gameId:          games[0].gameId,
        title:           games[0].title,
        startsAt:        games[0].startsAt,
        startsAt_parsed: games[0].startsAt
          ? new Date(parseInt(games[0].startsAt) * 1000).toISOString()
          : null,
        sport:           games[0].sport?.name,
        participants:    games[0].participants?.map((p: any) => p.name),
        conditions_count: games[0].conditions?.length,
        first_condition: games[0].conditions?.[0] || null,
        outcomes_count:  games[0].conditions?.[0]?.outcomes?.length,
        first_odds:      games[0].conditions?.[0]?.outcomes?.[0]?.currentOdds,
      } : null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}