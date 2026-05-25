import { NextResponse } from 'next/server'

const AZURO_FEED =
  'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-polygon'

export async function GET() {
  try {
    const nowTs = Math.floor(Date.now() / 1000)
    const query = `
      query {
        games(
          where: {
            state: Prematch
            activeConditionsCount_gt: 0
            startsAt_gt: "${nowTs}"
          }
          first: 2
          orderBy: startsAt
          orderDirection: asc
        ) {
          id
          gameId
          title
          startsAt
          sport { name }
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

    const res = await fetch(AZURO_FEED, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query }),
      cache:   'no-store',
    })

    const data = await res.json()
    const games = data?.data?.games || []

    return NextResponse.json({
      status:      res.status,
      errors:      data?.errors || null,
      games_count: games.length,
      raw_games:   games,
      analysis: games.map((g: any) => ({
        title:       g.title,
        startsAt:    new Date(parseInt(g.startsAt) * 1000).toISOString(),
        sport:       g.sport?.name,
        participants: g.participants?.map((p: any) => p.name),
        conditions:  g.conditions?.length,
        outcomes:    g.conditions?.[0]?.outcomes?.length,
        first_odds:  g.conditions?.[0]?.outcomes?.[0]?.currentOdds,
        probability: (() => {
          const o = g.conditions?.[0]?.outcomes?.[0]?.currentOdds
          if (!o) return null
          const v = parseFloat(o)
          return v > 1 ? Math.round((1/v) * 100) + '%' : null
        })(),
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}