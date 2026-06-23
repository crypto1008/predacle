import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

// READ-ONLY. Measures the resolved dataset so we know whether there's enough
// to build credible track-record / calibration content (and where).
// "calibratable" = resolved_outcome is YES/NO AND final_probability is present
// — the rows usable for any accuracy claim.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const PAGE = 1000
  let from = 0
  type Row = {
    platform: string | null
    category: string | null
    resolved_outcome: string | null
    final_probability: number | null
    resolved_at: string | null
  }
  let rows: Row[] = []
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('market_resolutions')
      .select('platform, category, resolved_outcome, final_probability, resolved_at')
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    rows = rows.concat(data as Row[])
    if (data.length < PAGE) break
    from += PAGE
    if (from > 200000) break
  }

  const calibratable = (r: Row) =>
    (r.resolved_outcome === 'YES' || r.resolved_outcome === 'NO') &&
    r.final_probability != null && isFinite(Number(r.final_probability))

  const byPlatform: Record<string, { total: number; calibratable: number }> = {}
  const byCategory: Record<string, { total: number; calibratable: number }> = {}
  const byOutcome: Record<string, number> = {}
  let totalCalibratable = 0
  let earliest: string | null = null
  let latest: string | null = null

  for (const r of rows) {
    const p = r.platform || 'unknown'
    const c = r.category || 'uncategorized'
    const o = r.resolved_outcome || 'null'
    byPlatform[p] = byPlatform[p] || { total: 0, calibratable: 0 }
    byCategory[c] = byCategory[c] || { total: 0, calibratable: 0 }
    byPlatform[p].total++
    byCategory[c].total++
    byOutcome[o] = (byOutcome[o] || 0) + 1
    if (calibratable(r)) {
      byPlatform[p].calibratable++
      byCategory[c].calibratable++
      totalCalibratable++
    }
    if (r.resolved_at) {
      if (!earliest || r.resolved_at < earliest) earliest = r.resolved_at
      if (!latest || r.resolved_at > latest) latest = r.resolved_at
    }
  }

  return NextResponse.json({
    totalResolved: rows.length,
    totalCalibratable,
    dateRange: { earliest, latest },
    byOutcome,
    byPlatform,
    byCategory,
  })
}
