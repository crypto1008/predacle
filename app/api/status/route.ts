import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: platformData } = await supabaseAdmin
      .from('markets')
      .select('platform')

    const platformCounts: Record<string, number> = {}
    platformData?.forEach((row) => {
      platformCounts[row.platform] = (platformCounts[row.platform] || 0) + 1
    })

    const { count: totalCount } = await supabaseAdmin
      .from('markets')
      .select('*', { count: 'exact', head: true })

    const { data: lastFetchData } = await supabaseAdmin
      .from('markets')
      .select('fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)

    const lastFetch = lastFetchData?.[0]?.fetched_at
    const minutesAgo = lastFetch
      ? Math.round((Date.now() - new Date(lastFetch).getTime()) / 60_000)
      : null

    const expectedPlatforms = [
      'polymarket',
      'manifold',
      'kalshi',
      'myriad',
    ]

    const platformStatus = expectedPlatforms.map((p) => ({
      platform: p,
      count: platformCounts[p] || 0,
      status: (platformCounts[p] || 0) > 0 ? '✅ Working' : '❌ No data',
    }))

    return NextResponse.json({
      overall: {
        status: totalCount && totalCount > 0 ? '✅ Healthy' : '❌ No data',
        totalMarkets: totalCount || 0,
        lastFetch,
        minutesAgo,
      },
      platforms: platformStatus,
      rawCounts: platformCounts,
    })
  } catch (error) {
    return NextResponse.json(
      { status: '❌ Error', error: String(error) },
      { status: 500 }
    )
  }
}