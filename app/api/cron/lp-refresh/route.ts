// Cron-protected refresh: runs the Polymarket + Kalshi LP adapters and
// full-replaces each platform's rows in lp_opportunities.
import { supabaseAdmin } from '../../../../lib/supabase'
import { fetchPolymarketLp } from '../../../../lib/lp/polymarket'
import { fetchKalshiLp } from '../../../../lib/lp/kalshi'
import { LpOpportunity } from '../../../../lib/lp/types'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
function toRow(o: LpOpportunity) {
  return {
    id: o.id, platform: o.platform, condition_id: o.conditionId, ticker: o.ticker,
    question: o.question, url: o.url, daily_reward: o.dailyReward, min_size: o.minSize,
    max_spread: o.maxSpread, price: o.price, spread: o.spread, days: o.days,
    volume_24hr: o.volume24hr, open_interest: o.openInterest, lp_score: o.lpScore,
    competition: o.competition ?? null,
    factors: o.factors, reward_precision: o.rewardPrecision, fetched_at: o.fetchedAt,
  }
}
async function refresh(platform: 'polymarket' | 'kalshi', fetcher: () => Promise<LpOpportunity[]>) {
  const opps = await fetcher()
  const rows = opps.map(toRow)
  const del = await supabaseAdmin.from('lp_opportunities').delete().eq('platform', platform)
  if (del.error) throw del.error
  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const ins = await supabaseAdmin.from('lp_opportunities').insert(rows.slice(i, i + 500))
    if (ins.error) throw ins.error
    inserted += Math.min(500, rows.length - i)
  }
  return { scored: opps.length, inserted, topScore: opps[0]?.lpScore ?? null }
}
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const started = Date.now()
  const results: Record<string, any> = {}
  for (const [platform, fetcher] of [['polymarket', fetchPolymarketLp], ['kalshi', fetchKalshiLp]] as const) {
    try { results[platform] = await refresh(platform, fetcher) }
    catch (e: any) { results[platform] = { error: e.message } }
  }
  return Response.json({ ok: true, results, tookMs: Date.now() - started })
}
