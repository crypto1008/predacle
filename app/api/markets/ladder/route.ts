// Ladder family lookup for the per-market distribution panel.
//   ?id=<rungId>   resolves that market's ladder_key, then returns the whole family
//   ?key=<ladderKey>  fetches a family directly
// Returns rungs sorted by threshold (ascending). Empty family => panel self-hides.
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id  = searchParams.get('id')  || ''
  const key = searchParams.get('key') || ''

  if (!id && !key) {
    return Response.json({ ok: false, error: 'id or key required' }, { status: 400 })
  }

  let ladderKey = key
  if (!ladderKey && id) {
    const { data: rung, error: e1 } = await supabaseAdmin
      .from('markets')
      .select('ladder_key')
      .eq('id', id)
      .maybeSingle()
    if (e1) return Response.json({ ok: false, error: e1.message }, { status: 500 })
    ladderKey = rung?.ladder_key || ''
  }

  // Not a ladder rung (or not found) — return an empty family so the panel hides.
  if (!ladderKey) return Response.json({ ok: true, family: null, count: 0, rungs: [] })

  const { data, error } = await supabaseAdmin
    .from('markets')
    .select('id, platform, question, probability, url, ladder_threshold, volume_label')
    .eq('ladder_key', ladderKey)
    .eq('status', 'active')
    .order('ladder_threshold', { ascending: true })
    .limit(500)

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })

  const rungs = (data || []).filter(
    (r) => r.ladder_threshold != null && r.probability != null
  )

  return Response.json({
    ok: true,
    family: ladderKey,
    platform: rungs[0]?.platform ?? null,
    count: rungs.length,
    rungs,
  })
}
