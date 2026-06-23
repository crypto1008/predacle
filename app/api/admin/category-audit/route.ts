import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { inferCategory } from '@/lib/utils/category'

export const runtime = 'nodejs'
export const maxDuration = 30

// READ-ONLY. Scans active, non-ladder markets and flags ones whose stored
// category disagrees with what the (fixed) matcher infers from the question —
// but ONLY when the matcher is confident (returns a real category, not 'other').
// A flag means "worth reviewing," NOT "definitely wrong": some platforms
// (Myriad/Kalshi) categorize from their own metadata, so a flagged non-Polymarket
// market may still be correct. Polymarket flags are almost always real bugs,
// since Polymarket's tag comes from this same keyword matcher.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Paginate past Supabase's 1000-row cap.
  const PAGE = 1000
  let from = 0
  let all: { id: string; question: string; category: string | null; platform: string }[] = []
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('markets')
      .select('id, question, category, platform')
      .eq('status', 'active')
      .is('ladder_key', null)
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    all = all.concat(data as any)
    if (data.length < PAGE) break
    from += PAGE
    if (from > 50000) break // hard safety stop
  }

  type Bucket = {
    suspicious: number
    movesTo: Record<string, number>
    platforms: Record<string, number>
  }
  const byStored: Record<string, Bucket> = {}
  const examples: { stored: string; inferred: string; platform: string; question: string }[] = []

  for (const m of all) {
    const stored = m.category || 'null'
    const inferred = inferCategory(m.question || '')
    if (inferred === 'other' || inferred === stored) continue
    if (!byStored[stored]) byStored[stored] = { suspicious: 0, movesTo: {}, platforms: {} }
    const b = byStored[stored]
    b.suspicious++
    b.movesTo[inferred] = (b.movesTo[inferred] || 0) + 1
    b.platforms[m.platform] = (b.platforms[m.platform] || 0) + 1
    if (examples.length < 60) {
      examples.push({ stored, inferred, platform: m.platform, question: m.question })
    }
  }

  const suspiciousTotal = Object.values(byStored).reduce((s, b) => s + b.suspicious, 0)

  return NextResponse.json({
    totalActiveScanned: all.length,
    suspiciousTotal,
    byStoredCategory: byStored,
    examples,
  })
}
