import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { matchMarkets, isReal } from '@/lib/match'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const minGap = parseFloat(searchParams.get('minGap') || '0.03')
  const limit = parseInt(searchParams.get('limit') || '50')
  const realOnly = searchParams.get('realOnly') === 'true'

  try {
    // Pull active, priced markets. Note: we now need end_date (for date bucketing)
    // and volume (to pick one representative price per platform).
    const { data, error } = await supabaseAdmin
      .from('markets')
      .select('id, platform, question, probability, url, category, volume, volume_label, end_date')
      .eq('status', 'active')
      .not('probability', 'is', null)
      .order('fetched_at', { ascending: false })
      .limit(5000)

    if (error) throw error

    // Smart cross-platform clustering (threshold + date + subject + topic similarity)
    const { crossClusters, realClusters } = matchMarkets(data || [])
    const clusters = realOnly ? realClusters : crossClusters

    // One representative price per platform (highest volume) avoids double-counting
    const repByPlatform = (g: any[]) => {
      const b: Record<string, any> = {}
      for (const m of g) {
        const v = m.volume || 0
        if (!b[m.platform] || v > (b[m.platform].volume || 0)) b[m.platform] = m
      }
      return b
    }

    const opportunities = clusters
      .map((g: any[]) => {
        const reps = Object.values(repByPlatform(g)) as any[]
        const priced = reps.filter((m) => m.probability != null)
        if (priced.length < 2) return null

        const probs = priced.map((m) => m.probability as number)
        const maxProb = Math.max(...probs)
        const minProb = Math.min(...probs)
        const gap = maxProb - minProb
        const highMarket = priced.find((m) => m.probability === maxProb)
        const lowMarket = priced.find((m) => m.probability === minProb)

        return {
          fingerprint: g[0].id,                         // stable key for React lists
          question: g[0].question,
          category: g[0].category,
          gap: Math.round(gap * 100) / 100,
          gapPercent: Math.round(gap * 100),
          threshold: g[0]._th || null,                  // e.g. "gt:100000" or null (binary)
          endDate: g[0]._date || null,
          markets: reps.map((m) => ({
            platform: m.platform,
            probability: m.probability == null ? null : Math.round((m.probability as number) * 100),
            url: m.url,
            volume: m.volume_label,
          })),
          highPlatform: highMarket?.platform,
          lowPlatform: lowMarket?.platform,
          platformCount: reps.length,
          realMoney: reps.filter((m) => isReal(m.platform)).length >= 2,
          // flag stale/extreme prices (0% / 100%) so the UI can mark them "verify"
          suspect: reps.some((m) => m.probability != null && (m.probability <= 0.005 || m.probability >= 0.995)),
        }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null && g.gap >= minGap)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, limit)

    return NextResponse.json({
      arbitrageCount: opportunities.length,
      minGapUsed: minGap,
      opportunities,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch arbitrage data', detail: error.message },
      { status: 500 }
    )
  }
}
