import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Sig = {
  id: string; question: string; platform: string; volume: string | null
  now: number; prior: number; move: number; tag: string
}

// Collapse complementary binary pairs (same event, opposite outcomes) into one row.
// Safe by construction: only structured ids (kalshi-TYPE-EVENT-OUTCOME, 4+ segments)
// are grouped, and a group is only collapsed when it has EXACTLY two members whose
// probabilities sum to ~1. CPI ladders (many thresholds, don't sum to 1) and
// Polymarket ids (no shared prefix) are left fully intact.
function dedupeComplementary(signals: Sig[]): Sig[] {
  const groups = new Map<string, Sig[]>()
  for (const s of signals) {
    const parts = s.id.split('-')
    if (parts.length < 4) continue
    const key = parts.slice(0, -1).join('-')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }
  const drop = new Set<string>()
  for (const members of groups.values()) {
    if (members.length !== 2) continue
    const sum = members[0].now + members[1].now
    if (sum < 0.9 || sum > 1.1) continue
    // keep the bigger move; drop the mirror side
    const loser = Math.abs(members[0].move) >= Math.abs(members[1].move) ? members[1] : members[0]
    drop.add(loser.id)
  }
  return signals.filter(s => !drop.has(s.id))
}

// GET /api/signals  -> real-money markets repricing right now.
// Optional query params: ?hours=24  ?minVol=1000
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const hours = Number(searchParams.get('hours') || 24)
  const minVol = Number(searchParams.get('minVol') || 1000)

  const { data, error } = await supabaseAdmin.rpc('get_live_signals', {
    hours_back: Number.isFinite(hours) ? hours : 24,
    min_vol: Number.isFinite(minVol) ? minVol : 1000,
    max_rows: 80, // fetch extra so the feed stays full after dedup
  })

  if (error) {
    return NextResponse.json({ error: error.message, signals: [] }, { status: 500 })
  }

  const raw: Sig[] = (data || []).map((r: any) => ({
    id: r.market_id,
    question: r.question,
    platform: r.platform,
    volume: r.volume_label,
    now: r.now_prob,
    prior: r.prior_prob,
    move: r.move,
    tag: r.tag, // 'live' (still contested) | 'settling' (drifting to its outcome)
  }))

  const signals = dedupeComplementary(raw).slice(0, 60)
  const live = signals.filter(s => s.tag === 'live')
  return NextResponse.json({ count: signals.length, liveCount: live.length, signals })
}
