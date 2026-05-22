import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const minGap = parseFloat(searchParams.get('minGap') || '0.03')
  const limit = parseInt(searchParams.get('limit') || '50')

  try {
    // Get all active markets with fingerprints and probabilities
    const { data, error } = await supabaseAdmin
      .from('markets')
      .select('id, platform, question, probability, url, category, fingerprint, volume_label')
      .eq('status', 'active')
      .not('fingerprint', 'is', null)
      .not('probability', 'is', null)
      .order('fetched_at', { ascending: false })
      .limit(5000)

    if (error) throw error

    // Group by fingerprint
    const groups: Record<string, any[]> = {}
    data?.forEach((market) => {
      if (!market.fingerprint) return
      if (!groups[market.fingerprint]) groups[market.fingerprint] = []
      groups[market.fingerprint].push(market)
    })

    // Find arbitrage opportunities
    const arbitrage = Object.entries(groups)
      .filter(([_, markets]) => {
        const platforms = new Set(markets.map((m) => m.platform))
        return platforms.size >= 2
      })
      .map(([fingerprint, markets]) => {
        const withProb = markets.filter((m) => m.probability !== null)
        if (withProb.length < 2) return null

        const probs = withProb.map((m) => m.probability as number)
        const maxProb = Math.max(...probs)
        const minProb = Math.min(...probs)
        const gap = maxProb - minProb

        const highMarket = withProb.find((m) => m.probability === maxProb)
        const lowMarket = withProb.find((m) => m.probability === minProb)

        return {
          fingerprint,
          question: markets[0].question,
          category: markets[0].category,
          gap: Math.round(gap * 100) / 100,
          gapPercent: Math.round(gap * 100),
          markets: withProb.map((m) => ({
            platform: m.platform,
            probability: Math.round((m.probability as number) * 100),
            url: m.url,
            volume: m.volume_label,
          })),
          highPlatform: highMarket?.platform,
          lowPlatform: lowMarket?.platform,
          platformCount: new Set(markets.map((m) => m.platform)).size,
        }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null && g.gap >= minGap)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, limit)

    return NextResponse.json({
      arbitrageCount: arbitrage.length,
      minGapUsed: minGap,
      opportunities: arbitrage,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch arbitrage data', detail: error.message },
      { status: 500 }
    )
  }
}