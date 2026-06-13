import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GAMMA = 'https://gamma-api.polymarket.com/markets'
const CHUNK = 40   // condition_ids per Gamma call (well under any cap; URL stays short)
const LIMIT = 200  // candidates verified per run (backlog clears in ~2 runs)

// Query Gamma by condition_ids. Plain query returns only ACTIVE markets;
// closed=true returns RESOLVED ones (with final outcomePrices). Validated June 2026.
async function gamma(cids: string[], closed: boolean): Promise<any[]> {
  if (cids.length === 0) return []
  const params = cids.map(c => `condition_ids=${encodeURIComponent(c)}`).join('&')
  const url = `${GAMMA}?${params}${closed ? '&closed=true' : ''}&limit=500`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!r.ok) return []
    const j = await r.json()
    return Array.isArray(j) ? j : j.data || []
  } catch {
    return []
  }
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const t0 = Date.now()
  const now = new Date().toISOString()

  // Backlog: Polymarket markets we marked "closed" that actually resolve in the
  // future and haven't been verified yet. Each is either still live (false-closed,
  // reactivate) or genuinely resolved (record outcome) or delisted (leave closed).
  const { data: candidates, error } = await supabaseAdmin
    .from('markets')
    .select('id, question, probability')
    .eq('platform', 'polymarket')
    .eq('status', 'closed')
    .eq('resolution_checked', false)
    .gt('end_date', now)
    .limit(LIMIT)

  if (error) {
    return NextResponse.json({ error: error.message, step: 'candidates' }, { status: 500 })
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, note: 'no unverified closed-but-future polymarket markets' })
  }

  // Markets without a condition_id (event-level) can't be verified — mark them
  // checked so they don't clog the candidate pool forever.
  const skipIds = candidates.filter(c => !c.id.startsWith('polymarket-0x')).map(c => c.id)

  const byCid = new Map<string, any>()
  for (const c of candidates) {
    if (c.id.startsWith('polymarket-0x')) byCid.set(c.id.replace('polymarket-', ''), c)
  }
  const cids = [...byCid.keys()]

  const activeCids = new Set<string>()
  const resolved = new Map<string, number[]>() // cid -> final outcomePrices

  for (let i = 0; i < cids.length; i += CHUNK) {
    const batch = cids.slice(i, i + CHUNK)
    const act = await gamma(batch, false)
    for (const m of act) {
      if (m.conditionId && !m.closed && m.active) activeCids.add(m.conditionId)
    }
    const remaining = batch.filter(c => !activeCids.has(c))
    const res = await gamma(remaining, true)
    for (const m of res) {
      if (!m.conditionId || !m.closed) continue
      let p: number[] = []
      try { p = JSON.parse(m.outcomePrices || '[]').map(Number) } catch {}
      resolved.set(m.conditionId, p)
    }
  }

  const reactivateIds: string[] = []
  const resolvedRows: any[] = []
  const resolvedIds: string[] = []
  const goneIds: string[] = []

  for (const [cid, row] of byCid) {
    const id = 'polymarket-' + cid
    if (activeCids.has(cid)) {
      reactivateIds.push(id)
    } else if (resolved.has(cid)) {
      const p = resolved.get(cid)!
      const outcome = p[0] === 1 ? 'YES' : p[0] === 0 ? 'NO' : 'UNCLEAR'
      resolvedRows.push({
        id,
        platform: 'polymarket',
        question: row.question,
        resolved_outcome: outcome,
        final_probability: row.probability ?? null,
        resolution_source: 'polymarket-gamma',
        resolved_at: new Date().toISOString(),
      })
      resolvedIds.push(id)
    } else {
      goneIds.push(id)
    }
  }

  async function updateIn(ids: string[], patch: Record<string, unknown>) {
    for (let i = 0; i < ids.length; i += 100) {
      await supabaseAdmin.from('markets').update(patch).in('id', ids.slice(i, i + 100))
    }
  }

  // Rescue the false-closed (live) markets
  if (reactivateIds.length) {
    await updateIn(reactivateIds, { status: 'active', fetched_at: new Date().toISOString() })
  }
  // Record real outcomes, then take the resolved markets out of the candidate pool
  if (resolvedRows.length) {
    for (let i = 0; i < resolvedRows.length; i += 100) {
      await supabaseAdmin.from('market_resolutions').upsert(resolvedRows.slice(i, i + 100), { onConflict: 'id' })
    }
    await updateIn(resolvedIds, { resolution_checked: true })
  }
  // Delisted / unverifiable: leave closed, but stop re-checking
  if (goneIds.length) await updateIn(goneIds, { resolution_checked: true })
  if (skipIds.length) await updateIn(skipIds, { resolution_checked: true })

  return NextResponse.json({
    ok: true,
    checked: cids.length,
    reactivated: reactivateIds.length,
    resolved: resolvedRows.length,
    gone: goneIds.length,
    skipped_eventlevel: skipIds.length,
    remaining_estimate: candidates.length === LIMIT ? 'more — run again' : 'backlog likely cleared',
    tookMs: Date.now() - t0,
  })
}
