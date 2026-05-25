import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      'https://api-v2.myriadprotocol.com/markets?state=open&sort=volume_24h&limit=3',
      {
        headers: {
          'User-Agent': 'Predacle/1.0',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      }
    )

    const json    = await res.json()
    const all     = json.data || json.markets || json || []
    const sample  = all[0] || {}

    return NextResponse.json({
      status:         res.status,
      total_returned: all.length,
      all_fields:     Object.keys(sample),
      volume_fields: {
        volume:        sample.volume,
        volume24h:     sample.volume24h,
        volumeUsd:     sample.volumeUsd,
        totalVolume:   sample.totalVolume,
        liquidity:     sample.liquidity,
      },
      trader_fields: {
        bettors:       sample.bettors,
        traders:       sample.traders,
        participants:  sample.participants,
        uniqueTraders: sample.uniqueTraders,
        traderCount:   sample.traderCount,
        numTraders:    sample.numTraders,
      },
      full_sample: sample,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}