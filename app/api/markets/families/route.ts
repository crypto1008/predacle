import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Aggregates active price-ladder rungs (hidden from the main feed) into ONE
// summary row per family. No DB change: grouped in-memory.
//
// Each "above $X" rung's probability = P(value >= threshold), so within a family
// probability falls as the threshold rises (a CDF). The implied median is the
// threshold where that crosses 0.5 — a single number summarising the ladder.

interface Rung {
  id: string
  platform: string
  category: string | null
  question: string
  probability: number | null   // 0..1
  volume: number | null
  end_date: string | null
  end_date_label: string | null
  url: string
  ladder_key: string
  ladder_threshold: number | null
  fetched_at: string
}

// Robust median: anchor on the rung whose probability is CLOSEST to 0.5, then
// interpolate toward the neighbour that brackets 0.5. Immune to noisy tails /
// early non-monotonic dips that broke a naive "first crossing" approach.
function impliedMedian(rungs: Rung[]): number | null {
  const pts = rungs
    .filter(r => r.probability != null && r.ladder_threshold != null)
    .map(r => ({ t: Number(r.ladder_threshold), p: Number(r.probability) }))
    .sort((a, b) => a.t - b.t)
  if (pts.length < 2) return null

  let ci = 0, cd = Infinity
  for (let i = 0; i < pts.length; i++) {
    const d = Math.abs(pts[i].p - 0.5)
    if (d < cd) { cd = d; ci = i }
  }
  const c = pts[ci]
  // pick the neighbour on the side that moves probability across 0.5
  const nb = c.p >= 0.5 ? (pts[ci + 1] ?? pts[ci - 1]) : (pts[ci - 1] ?? pts[ci + 1])
  if (!nb || nb.p === c.p) return +c.t.toFixed(2)
  const frac = Math.max(-1, Math.min(2, (c.p - 0.5) / (c.p - nb.p)))
  return +(c.t + frac * (nb.t - c.t)).toFixed(2)
}

function pickRepresentative(rungs: Rung[], median: number | null): Rung {
  if (median != null) {
    let best = rungs[0], bestD = Infinity
    for (const r of rungs) {
      if (r.ladder_threshold == null) continue
      const d = Math.abs(Number(r.ladder_threshold) - median)
      if (d < bestD) { bestD = d; best = r }
    }
    return best
  }
  return rungs[Math.floor(rungs.length / 2)]
}

// "bitcoin price on jun 19, 2026?" -> "Bitcoin price on jun 19, 2026?"
function prettify(key: string): string {
  if (!key) return key
  return key.charAt(0).toUpperCase() + key.slice(1)
}

// Infer the threshold unit from the family key so the card shows %/$T/points
// instead of always "$". Default = dollar (most ladders are prices: BTC/ETH/gas/oil).
function inferUnit(key: string): string {
  const k = (key || '').toLowerCase()
  if (k.includes('%') || k.includes('inflation') || k.includes('rate of')) return 'percent'
  if (k.includes('trillion') || k.includes('valuation') || /\$x\s*t\b/.test(k)) return 'trillion'
  if (/\bnasdaq|s&p|\bdow\b|\brussell\b|\bindex\b/.test(k)) return 'index'
  return 'dollar'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const category = searchParams.get('category')
    const limit = Math.min(60, Math.max(1, parseInt(searchParams.get('limit') || '24')))
    // Substantial families only — drops 12-rung hourly-crypto noise. Tunable.
    const minRungs = Math.max(3, parseInt(searchParams.get('minRungs') || '20'))

    let q = supabaseAdmin
      .from('markets')
      .select('id, platform, category, question, probability, volume, end_date, end_date_label, url, ladder_key, ladder_threshold, fetched_at')
      .eq('status', 'active')
      .not('ladder_key', 'is', null)
      .not('ladder_threshold', 'is', null)
      .limit(4000)
    if (platform) q = q.eq('platform', platform)
    if (category) q = q.eq('category', category)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const groups = new Map<string, Rung[]>()
    for (const r of (data as Rung[]) || []) {
      if (!r.ladder_key) continue
      if (!groups.has(r.ladder_key)) groups.set(r.ladder_key, [])
      groups.get(r.ladder_key)!.push(r)
    }

    const families = []
    for (const [key, rungs] of groups) {
      if (rungs.length < minRungs) continue
      rungs.sort((a, b) => (a.ladder_threshold ?? 0) - (b.ladder_threshold ?? 0))
      const median = impliedMedian(rungs)
      const rep = pickRepresentative(rungs, median)
      const totalVolume = rungs.reduce((s, r) => s + (Number(r.volume) || 0), 0)
      const latest = rungs.reduce((m, r) => (r.fetched_at > m ? r.fetched_at : m), rungs[0].fetched_at)
      families.push({
        ladderKey: key,
        unit: inferUnit(key),
        baseLabel: prettify(key),
        sampleQuestion: rungs[Math.floor(rungs.length / 2)].question,
        platform: rungs[0].platform,
        category: rungs[0].category,
        rungCount: rungs.length,
        thresholdMin: rungs[0].ladder_threshold,
        thresholdMax: rungs[rungs.length - 1].ladder_threshold,
        impliedMedian: median,
        totalVolume,
        repId: rep.id,
        repUrl: rep.url,
        endDate: rungs[0].end_date,
        endLabel: rungs[0].end_date_label,
        fetchedAt: latest,
      })
    }

    families.sort((a, b) => b.totalVolume - a.totalVolume)
    return NextResponse.json({ families: families.slice(0, limit), total: families.length })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to build families', detail: error.message }, { status: 500 })
  }
}
