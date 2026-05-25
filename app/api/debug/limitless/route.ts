import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      'https://api.limitless.exchange/markets?limit=3&sortBy=liquidity&orderBy=desc',
      {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      }
    )
    const json   = await res.json()
    const all    = json.data || json.markets || json || []
    const sample = all[0] || {}

    return NextResponse.json({
      status:        res.status,
      all_fields:    Object.keys(sample),
      volume_fields: {
        volume:        sample.volume,
        volumeFormatted: sample.volumeFormatted,
        volume24h:     sample.volume24h,
        liquidity:     sample.liquidity,
        totalVolume:   sample.totalVolume,
        contractSize:  sample.contractSize,
      },
      trader_fields: {
        traders:       sample.traders,
        uniqueTraders: sample.uniqueTraders,
        bettors:       sample.bettors,
        participants:  sample.participants,
        users:         sample.users,
        tradesCount:   sample.tradesCount,
        traderCount:   sample.traderCount,
      },
      full_sample: sample,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}