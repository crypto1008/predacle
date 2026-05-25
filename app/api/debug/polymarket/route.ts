import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=3&order=volume24hr&ascending=false',
      {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      }
    )
    const json   = await res.json()
    const all    = Array.isArray(json) ? json : json.data || []
    const sample = all[0] || {}

    return NextResponse.json({
      status:        res.status,
      all_fields:    Object.keys(sample),
      trader_fields: {
        uniqueBettors:   sample.uniqueBettors,
        uniqueTraders:   sample.uniqueTraders,
        numTraders:      sample.numTraders,
        numBettors:      sample.numBettors,
        traders:         sample.traders,
        bettors:         sample.bettors,
        traderCount:     sample.traderCount,
      },
      volume_fields: {
        volume:          sample.volume,
        volume24hr:      sample.volume24hr,
        liquidity:       sample.liquidity,
        liquidityNum:    sample.liquidityNum,
      },
      full_sample: sample,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}