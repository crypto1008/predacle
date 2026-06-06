import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { matchMarkets, isReal } from '@/lib/match'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const minGap = parseFloat(searchParams.get('minGap') || '0.03')
  const limit = parseInt(searchParams.get('limit') || '50')
  const realOnly = searchParams.get('realOnly') === 'true'
  const debug = searchParams.get('debug') === '1'

  try {
    const { data, error } = await supabaseAdmin
      .from('markets')
      .select('id, platform, question, probability, url, category, volume, volume_label, end_date')
      .eq('status', 'active')
      .not('probability', 'is', null)
      .order('fetched_at', { ascending: false })
      .limit(5000)

    if (error) throw error

    const { crossClusters, realClusters } = matchMarkets(data || [])

    // ── DEBUG: report what the route actually sees ──────────────────────
    if (debug) {
      const byPlatform: Record<string, number> = {}
      for (const d of data || []) byPlatform[d.platform] = (byPlatform[d.platform] || 0) + 1
      return NextResponse.json({
        debug: true,
        rowsPulled: (data || []).length,
        byPlatform,
        crossClusters: crossClusters.length,
        realClusters: realClusters.length,
        sampleCross: crossClusters.slice(0, 6).map((g: any[]) => ({
          platforms: [...new Set(g.map((x) => x.platform))],
          questions: g.map((x) => (x.question || '').slice(0, 45)),
        })),
        sampleRows: (data || []).slice(0, 4).map((d: any) => ({
          platform: d.platform,
          end_date: d.end_date,
          probability: d.probability,
          question: (d.question || '').slice(0, 40),
        })),
      })
    }
    // ────────────────────────────────────────────────────────────────────

    const clusters = realOnly ? realClusters : crossClusters
    const repByPlatform = (g: any[]) => {
      const b: Record<string, any> = {}
      for (const m of g) { const v = m.volume || 0; if (!b[m.platform] || v > (b[m.platform].volume || 0)) b[m.platform] = m }
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
          fingerprint: g[0].id,
          question: g[0].question,
          category: g[0].category,
          gap: Math.round(gap * 100) / 100,
          gapPercent: Math.round(gap * 100),
          threshold: g[0]._th || null,
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
          suspect: reps.some((m) => m.probability != null && (m.probability <= 0.005 || m.probability >= 0.995)),
        }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null && g.gap >= minGap)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, limit)

    return NextResponse.json({ arbitrageCount: opportunities.length, minGapUsed: minGap, opportunities })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch arbitrage data', detail: error.message }, { status: 500 })
  }
}
