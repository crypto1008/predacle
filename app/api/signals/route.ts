import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/signals  -> real-money markets repricing right now.
// Optional query params: ?hours=24  ?minVol=1000
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const hours = Number(searchParams.get('hours') || 24)
  const minVol = Number(searchParams.get('minVol') || 1000)

  const { data, error } = await supabaseAdmin.rpc('get_live_signals', {
    hours_back: Number.isFinite(hours) ? hours : 24,
    min_vol: Number.isFinite(minVol) ? minVol : 1000,
    max_rows: 60,
  })

  if (error) {
    return NextResponse.json({ error: error.message, signals: [] }, { status: 500 })
  }

  const signals = (data || []).map((r: any) => ({
    id: r.market_id,
    question: r.question,
    platform: r.platform,
    volume: r.volume_label,
    now: r.now_prob,
    prior: r.prior_prob,
    move: r.move,
    tag: r.tag, // 'live' (still contested) | 'settling' (drifting to its outcome)
  }))

  const live = signals.filter((s: any) => s.tag === 'live')
  return NextResponse.json({ count: signals.length, liveCount: live.length, signals })
}
