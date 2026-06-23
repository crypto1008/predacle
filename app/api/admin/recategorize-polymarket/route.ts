import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { inferCategory } from '@/lib/utils/category'

export const runtime = 'nodejs'
export const maxDuration = 60

// On-demand sweep: re-categorizes POLYMARKET markets whose stored category
// disagrees with the (fixed) keyword matcher — across ALL categories.
// Safe because Polymarket is the one platform whose category comes from this
// same matcher, so re-inferring can only correct it. Strictly guarded:
//   - platform = polymarket only (never touches Myriad/Kalshi/Manifold metadata)
//   - moves ONLY when the matcher is confident (not 'other')
// The widened fetcher already re-tags active Polymarket markets every run, so
// this is mainly a belt-and-braces tool / immediate fixer.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Paginate past Supabase's 1000-row cap.
  const PAGE = 1000
  let from = 0
  let rows: { id: string; question: string; category: string | null }[] = []
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('markets')
      .select('id, question, category')
      .eq('status', 'active')
      .eq('platform', 'polymarket')
      .is('ladder_key', null)
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    rows = rows.concat(data as any)
    if (data.length < PAGE) break
    from += PAGE
    if (from > 50000) break
  }

  const toMove: { id: string; question: string; from: string; to: string }[] = []
  for (const m of rows) {
    const stored = m.category || 'null'
    const inferred = inferCategory(m.question || '')
    if (inferred !== 'other' && inferred !== stored) {
      toMove.push({ id: m.id, question: m.question, from: stored, to: inferred })
    }
  }

  let moved = 0
  const errors: string[] = []
  for (const mv of toMove) {
    const { error: upErr } = await supabaseAdmin
      .from('markets')
      .update({ category: mv.to })
      .eq('id', mv.id)
    if (upErr) errors.push(`${mv.id}: ${upErr.message}`)
    else moved++
  }

  const byMove: Record<string, number> = {}
  for (const mv of toMove) {
    const k = `${mv.from}->${mv.to}`
    byMove[k] = (byMove[k] || 0) + 1
  }

  return NextResponse.json({
    scanned: rows.length,
    moved,
    byMove,
    examples: toMove.slice(0, 30),
    errors: errors.length ? errors : undefined,
  })
}
