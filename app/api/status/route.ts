import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const expectedPlatforms = [
      'polymarket', 'manifold', 'kalshi',
      'myriad', 'limitless', 'azuro',
    ]

    // Count each platform separately — avoids 1000 row limit
    const platformCounts = await Promise.all(
      expectedPlatforms.map(async (p) => {
        const { count } = await supabaseAdmin
          .from('markets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')
          .eq('platform', p)
        return { platform: p, count: count || 0 }
      })
    )

    const totalCount = platformCounts.reduce((sum, p) => sum + p.count, 0)

    // Last fetch time
    const { data: lastFetchData } = await supabaseAdmin
      .from('markets')
      .select('fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)

    const lastFetch  = lastFetchData?.[0]?.fetched_at
    const minutesAgo = lastFetch
      ? Math.round((Date.now() - new Date(lastFetch).getTime()) / 60_000)
      : null

    const platformStatus = platformCounts.map(p => ({
      platform: p.platform,
      count:    p.count,
      status:   p.count > 0 ? '✅ Working' : '❌ No data',
    }))

    const rawCounts = Object.fromEntries(
      platformCounts.filter(p => p.count > 0).map(p => [p.platform, p.count])
    )

    return NextResponse.json({
      overall: {
        status:       totalCount > 0 ? '✅ Healthy' : '❌ No data',
        totalMarkets: totalCount,
        lastFetch,
        minutesAgo,
      },
      platforms:  platformStatus,
      rawCounts,
    })
  } catch (error) {
    return NextResponse.json(
      { status: '❌ Error', error: String(error) },
      { status: 500 }
    )
  }
}