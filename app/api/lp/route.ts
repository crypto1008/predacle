// Public LP feed. Serves ranked opportunities from the cache with optional
// strategy filters: ?minDays=15&minReward=50&priceMin=0.15&priceMax=0.40&platform=polymarket
// Single-market lookup: ?id=<marketId> returns just that market's row (or none),
// used by the per-market LP panel on /markets/[id].
import { supabaseAdmin } from '../../../lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id        = searchParams.get('id') || ''
  const minDays   = Number(searchParams.get('minDays')   || 0)
  const minReward = Number(searchParams.get('minReward') || 0)
  const priceMin  = Number(searchParams.get('priceMin')  || 0)
  const priceMax  = Number(searchParams.get('priceMax')  || 1)
  const platform  = searchParams.get('platform') || ''
  const limit     = Math.min(Number(searchParams.get('limit') || 100), 200)

  let q = supabaseAdmin
    .from('lp_opportunities')
    .select('*')
    .order('lp_score', { ascending: false })

  if (id) {
    // Single-market lookup for the per-market LP panel — ignore strategy filters
    // so the panel always gets the row if this market is reward-eligible.
    q = q.eq('id', id)
  } else {
    if (platform)     q = q.eq('platform', platform)
    if (minReward)    q = q.gte('daily_reward', minReward)
    if (minDays)      q = q.gte('days', minDays)
    if (priceMin > 0) q = q.gte('price', priceMin)
    if (priceMax < 1) q = q.lte('price', priceMax)
  }

  const { data, error } = await q.limit(id ? 1 : limit)
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

  return Response.json({
    ok: true,
    count: data?.length ?? 0,
    updatedAt: data?.[0]?.fetched_at ?? null,
    opportunities: data ?? [],
  })
}
