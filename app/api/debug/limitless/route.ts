import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      'https://api.limitless.exchange/markets/active',
      {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      }
    )
    const json   = await res.json()
    const all    = json.data || json.markets || json || []
    const sample = Array.isArray(all) ? all[0] : all

    return NextResponse.json({
      status:        res.status,
      total:         Array.isArray(all) ? all.length : 1,
      all_fields:    Object.keys(sample || {}),
      volume_fields: {
        volume:        sample?.volume,
        volume24h:     sample?.volume24h,
        liquidity:     sample?.liquidity,
        totalVolume:   sample?.totalVolume,
        volumeUsd:     sample?.volumeUsd,
        collateral:    sample?.collateral,
      },
      trader_fields: {
        traders:        sample?.traders,
        uniqueTraders:  sample?.uniqueTraders,
        bettors:        sample?.bettors,
        users:          sample?.users,
        tradesCount:    sample?.tradesCount,
        traderCount:    sample?.traderCount,
        positions:      sample?.positions,
        positionsCount: sample?.positionsCount,
      },
      price_fields: {
        prices:         sample?.prices,
        outcomePrices:  sample?.outcomePrices,
        odds:           sample?.odds,
      },
      full_sample: sample,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}