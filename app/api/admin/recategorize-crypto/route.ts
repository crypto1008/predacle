import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { inferCategory } from '@/lib/utils/category'

export const runtime = 'nodejs'
export const maxDuration = 30

// One-time (re-runnable) backfill: fixes Polymarket markets that the old
// substring bug parked under `crypto`. Scoped deliberately:
//   - platform = polymarket  (only the keyword-inference path had the bug;
//     Myriad/Kalshi categorize from their own metadata, not the question)
//   - category = crypto      (the over-collected bucket)
//   - move ONLY when the fixed matcher returns a *confident* non-crypto
//     category. If it returns 'crypto' or 'other', leave the row alone so
//     keyword-less-but-legit crypto markets (e.g. "Fear or Greed?") are safe.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('markets')
    .select('id, question, category')
    .eq('status', 'active')
    .eq('platform', 'polymarket')
    .eq('category', 'crypto')
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data || []
  const toMove: { id: string; question: string; to: string }[] = []
  for (const m of rows) {
    const inferred = inferCategory(m.question || '')
    if (inferred !== 'crypto' && inferred !== 'other') {
      toMove.push({ id: m.id, question: m.question, to: inferred })
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

  const byCategory: Record<string, number> = {}
  for (const mv of toMove) byCategory[mv.to] = (byCategory[mv.to] || 0) + 1

  return NextResponse.json({
    scanned: rows.length,
    moved,
    byCategory,
    examples: toMove.slice(0, 25),
    errors: errors.length ? errors : undefined,
  })
}
