import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

// READ-ONLY. Buckets active, non-ladder markets by volume, per platform, and
// shows how many would survive at each candidate volume floor. Use this to pick
// a quality threshold. NOTE: Manifold is play-money (Mana), so its "volume" is
// NOT comparable to the real-money platforms — judge each platform on its own.
const THRESHOLDS = [0, 1000, 5000, 10000, 25000, 50000, 100000]

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const PAGE = 1000
  let from = 0
  let rows: { platform: string; volume: number | null }[] = []
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('markets')
      .select('platform, volume')
      .eq('status', 'active')
      .is('ladder_key', null)
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    rows = rows.concat(data as any)
    if (data.length < PAGE) break
    from += PAGE
    if (from > 100000) break
  }

  // Group volumes by platform.
  const vols: Record<string, number[]> = {}
  for (const r of rows) {
    const p = r.platform || 'unknown'
    if (!vols[p]) vols[p] = []
    vols[p].push(typeof r.volume === 'number' ? r.volume : 0)
  }

  const byPlatform: Record<string, any> = {}
  for (const [p, arr] of Object.entries(vols)) {
    // keptAtFloor: how many markets have volume >= threshold
    const keptAtFloor: Record<string, number> = {}
    for (const t of THRESHOLDS) keptAtFloor[`>=${t}`] = arr.filter((v) => v >= t).length
    // readable buckets
    const buckets = {
      '100k+': arr.filter((v) => v >= 100000).length,
      '50k-100k': arr.filter((v) => v >= 50000 && v < 100000).length,
      '10k-50k': arr.filter((v) => v >= 10000 && v < 50000).length,
      '5k-10k': arr.filter((v) => v >= 5000 && v < 10000).length,
      '1k-5k': arr.filter((v) => v >= 1000 && v < 5000).length,
      '100-1k': arr.filter((v) => v >= 100 && v < 1000).length,
      '0-100': arr.filter((v) => v < 100).length,
    }
    const sorted = [...arr].sort((a, b) => a - b)
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
    byPlatform[p] = { total: arr.length, median, buckets, keptAtFloor }
  }

  return NextResponse.json({ totalScanned: rows.length, byPlatform })
}
