import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Use SQL GROUP BY to avoid 1000 row limit
    const { data: platformData, error: platformError } = await supabaseAdmin
      .rpc('get_platform_counts')

    const platformCounts: Record<string, number> = {}
    if (platformData) {
      platformData.forEach((row: any) => {
        platformCounts[row.platform] = parseInt(row.market_count)
      })
    }

    // Get accurate total count
    const { count: totalCount } = await supabaseAdmin
      .from('markets')
      .select('*', { count: 'exact', head: true })

    // Get last fetch time
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
      'polymarket', 'manifold', 'kalshi',
      'myriad', 'limitless', 'azuro',
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