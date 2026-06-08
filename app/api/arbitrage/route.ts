import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { matchMarkets, isReal } from '@/lib/match'

// Supabase caps each query at 1000 rows, so paginate to get the whole table.
async function fetchActiveMarkets() {
  const cols = 'id, platform, question, probability, url, category, volume, volume_label, end_date'
  const PAGE = 1000
  const all: any[] = []
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('markets')
      .select(cols)
      .eq('status', 'active')
      .order('id', { ascending: true })       // stable order for pagination
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
  }
  return all
}

/* ------------------------------------------------------------------ *
 * Opportunity scoring — heuristic, 0-100, no AI.
 * Turns a raw price divergence into a ranked, quality-graded opportunity.
 *
 *   Components (max):  gap/edge 50 · liquidity 22 · timing 14 · consensus 14
 *   Hard multipliers:  not real-money x0.35 · suspect (near-0/100 leg) x0.5
 *
 * The gap is the core edge but only AFTER it clears a friction allowance
 * (spread + round-trip fees); a 4pt gap is mostly noise, an 18pt+ net gap
 * earns full marks. Liquidity is the thinner of the two key legs — that's
 * the side that limits how much you can actually trade. Constants are kept
 * deliberately simple and named so they're easy to tune later.
 * ------------------------------------------------------------------ */
const FRICTION_PTS = 4      // pts a gap must clear before it counts as edge
const GAP_FULL_AT = 18      // net edge (pts) that earns the full gap score
const LIQ_FULL_AT = 50000   // min-leg volume that earns the full liquidity score

function scoreOpportunity(p: {
  gapPercent: number
  realMoney: boolean
  suspect: boolean
  minVolume: number
  daysToEnd: number | null
  platformCount: number
}): number {
  const netEdge = Math.max(0, p.gapPercent - FRICTION_PTS)
  const gapScore = Math.min(1, netEdge / GAP_FULL_AT) * 50

  const liqScore =
    p.minVolume > 0
      ? Math.min(1, Math.log10(p.minVolume + 1) / Math.log10(LIQ_FULL_AT)) * 22
      : 0

  let timeScore = 7 // neutral when the end date is unknown
  if (p.daysToEnd != null) {
    if (p.daysToEnd < 1) timeScore = 0
    else if (p.daysToEnd < 3) timeScore = 6
    else if (p.daysToEnd <= 90) timeScore = 14
    else if (p.daysToEnd <= 180) timeScore = 8
    else timeScore = 4
  }

  const consensusScore = p.platformCount >= 3 ? 14 : p.platformCount === 2 ? 9 : 0

  let score = gapScore + liqScore + timeScore + consensusScore
  if (!p.realMoney) score *= 0.35
  if (p.suspect) score *= 0.5

  return Math.round(Math.max(0, Math.min(100, score)))
}

function qualityTier(score: number): 'high' | 'medium' | 'low' {
  if (score >= 68) return 'high'
  if (score >= 45) return 'medium'
  return 'low'
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (isNaN(t)) return null
  return Math.ceil((t - Date.now()) / 86400000)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const minGap = parseFloat(searchParams.get('minGap') || '0.03')
  const limit = parseInt(searchParams.get('limit') || '50')
  const realOnly = searchParams.get('realOnly') === 'true'
  const debug = searchParams.get('debug') === '1'

  try {
    const data = await fetchActiveMarkets()
    const { crossClusters, realClusters } = matchMarkets(data)

    if (debug) {
      const byPlatform: Record<string, number> = {}
      for (const d of data) byPlatform[d.platform] = (byPlatform[d.platform] || 0) + 1
      return NextResponse.json({
        debug: true,
        rowsPulled: data.length,
        byPlatform,
        crossClusters: crossClusters.length,
        realClusters: realClusters.length,
        sampleCross: crossClusters.slice(0, 8).map((g: any[]) => ({
          platforms: [...new Set(g.map((x) => x.platform))],
          questions: g.map((x) => (x.question || '').slice(0, 45)),
        })),
      })
    }

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

        const gapPercent = Math.round(gap * 100)
        const endDate = g[0]._date || null
        const realMoney = reps.filter((m) => isReal(m.platform)).length >= 2
        const suspect = reps.some(
          (m) => m.probability != null && (m.probability <= 0.005 || m.probability >= 0.995)
        )
        // The binding liquidity constraint is the thinner of the two legs you'd
        // actually trade (buy the cheap side, sell the dear side).
        const minVolume = Math.min(highMarket?.volume || 0, lowMarket?.volume || 0)
        const daysToEnd = daysUntil(endDate)

        const score = scoreOpportunity({
          gapPercent,
          realMoney,
          suspect,
          minVolume,
          daysToEnd,
          platformCount: reps.length,
        })

        return {
          fingerprint: g[0].id,
          question: g[0].question,
          category: g[0].category,
          gap: Math.round(gap * 100) / 100,
          gapPercent,
          threshold: g[0]._th || null,
          endDate,
          markets: reps.map((m) => ({
            platform: m.platform,
            probability: m.probability == null ? null : Math.round((m.probability as number) * 100),
            url: m.url,
            volume: m.volume_label,
          })),
          highPlatform: highMarket?.platform,
          lowPlatform: lowMarket?.platform,
          platformCount: reps.length,
          realMoney,
          suspect,
          score,
          quality: qualityTier(score),
        }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null && g.gap >= minGap)
      // Rank by opportunity score (the whole point of this layer), gap as tiebreak.
      .sort((a, b) => (b.score - a.score) || (b.gap - a.gap))
      .slice(0, limit)

    return NextResponse.json({ arbitrageCount: opportunities.length, minGapUsed: minGap, opportunities })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch arbitrage data', detail: error.message }, { status: 500 })
  }
}
