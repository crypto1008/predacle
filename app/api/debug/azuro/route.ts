import { NextResponse } from 'next/server'

const FEED = 'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-polygon'

async function gql(query: string) {
  const res = await fetch(FEED, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  })
  return res.json()
}

export async function GET() {
  const nowTs = Math.floor(Date.now() / 1000)

  const [t1, t2, t3, t4] = await Promise.all([
    // Test 1: sport_ slug filter
    gql(`{ games(where: { state: Prematch, activeConditionsCount_gt: 0, startsAt_gt: "${nowTs}", sport_: { slug: "basketball" } }, first: 2) { gameId title sport { name slug } conditions(first:1) { outcomes(first:1) { currentOdds } } } }`),

    // Test 2: sport by entity ID (basketball = "31")
    gql(`{ games(where: { state: Prematch, activeConditionsCount_gt: 0, startsAt_gt: "${nowTs}", sport: "31" }, first: 2) { gameId title sport { name slug } conditions(first:1) { outcomes(first:1) { currentOdds } } } }`),

    // Test 3: no sport filter first 20 — what sports appear?
    gql(`{ games(where: { state: Prematch, activeConditionsCount_gt: 0, startsAt_gt: "${nowTs}" }, first: 20, orderBy: startsAt, orderDirection: asc) { gameId sport { name slug } conditions(first:1) { outcomes(first:1) { currentOdds } } } }`),

    // Test 4: basketball NO date filter — maybe future games don't exist yet?
    gql(`{ games(where: { state: Prematch, activeConditionsCount_gt: 0, sport_: { slug: "basketball" } }, first: 3) { gameId title startsAt sport { name slug } conditions(first:1) { outcomes(first:1) { currentOdds } } } }`),
  ])

  const sportMap: Record<string, { count: number; sampleOdds: string }> = {}
  for (const g of t3?.data?.games || []) {
    const s = g.sport?.slug || '?'
    const odds = g.conditions?.[0]?.outcomes?.[0]?.currentOdds || 'null'
    if (!sportMap[s]) sportMap[s] = { count: 0, sampleOdds: odds }
    sportMap[s].count++
  }

  return NextResponse.json({
    t1_basketball_slug_filter: { errors: t1?.errors, count: t1?.data?.games?.length, games: t1?.data?.games },
    t2_basketball_id_filter:   { errors: t2?.errors, count: t2?.data?.games?.length, games: t2?.data?.games },
    t3_no_filter_sport_summary: sportMap,
    t4_basketball_no_date:     { errors: t4?.errors, count: t4?.data?.games?.length, games: t4?.data?.games },
  })
}