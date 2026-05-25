import { NextResponse } from 'next/server'

const FEEDS = [
  { url: 'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-polygon', chain: 'polygon' },
  { url: 'https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-gnosis',  chain: 'gnosis'  },
]

export async function GET() {
  const results: any = {}

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `
          query {
            sports(where: { activePrematchGamesCount_gt: 0 }) {
              id
              name
              slug
              activeGamesCount
              activePrematchGamesCount
            }
          }
        `}),
        cache: 'no-store',
      })
      const json = await res.json()
      results[feed.chain] = {
        status: res.status,
        errors: json?.errors || null,
        sports: json?.data?.sports || [],
      }
    } catch (e: any) {
      results[feed.chain] = { error: e.message }
    }
  }

  return NextResponse.json(results)
}