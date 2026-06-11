// Cron-protected refresh: runs the Polymarket LP adapter and full-replaces
// the polymarket rows in lp_opportunities. Trigger like your other cron:
//   curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/lp-refresh
import { supabaseAdmin } from '../../../../lib/supabase'
import { fetchPolymarketLp } from '../../../../lib/lp/polymarket'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const started = Date.now()
  try {
    const opps = await fetchPolymarketLp()

    const rows = opps.map(o => ({
      id: o.id,
      platform: o.platform,
      condition_id: o.conditionId,
      ticker: o.ticker,
      question: o.question,
      url: o.url,
      daily_reward: o.dailyReward,
      min_size: o.minSize,
      max_spread: o.maxSpread,
      price: o.price,
      spread: o.spread,
      days: o.days,
      volume_24hr: o.volume24hr,
      lp_score: o.lpScore,
      factors: o.factors,
      reward_precision: o.rewardPrecision,
      fetched_at: o.fetchedAt,
    }))

    const del = await supabaseAdmin.from('lp_opportunities').delete().eq('platform', 'polymarket')
    if (del.error) throw del.error

    let inserted = 0
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const ins = await supabaseAdmin.from('lp_opportunities').insert(chunk)
      if (ins.error) throw ins.error
      inserted += chunk.length
    }

    return Response.json({
      ok: true,
      platform: 'polymarket',
      scored: opps.length,
      inserted,
      topScore: opps[0]?.lpScore ?? null,
      tookMs: Date.now() - started,
    })
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message, tookMs: Date.now() - started }, { status: 500 })
  }
}
