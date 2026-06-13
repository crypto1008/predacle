import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSign } from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GAMMA = 'https://gamma-api.polymarket.com/markets'
const KALSHI_BASE = 'https://api.elections.kalshi.com'
const POLY_CHUNK = 40
const KALSHI_CHUNK = 50
const LIMIT = 200          // candidates per platform per run
const STALE_HOURS = 12     // an active market not fetched in this long has dropped from coverage
const RECHECK_HOURS = 24   // re-verify a still-active stale market at most this often

type PassResult = { checked: number; active: number; resolved: number; gone: number }
type Cand = { id: string; question: string; probability: number | null; status: string }

// ---------- Polymarket (Gamma) ----------
async function gamma(cids: string[], closed: boolean): Promise<any[]> {
  if (cids.length === 0) return []
  const params = cids.map(c => `condition_ids=${encodeURIComponent(c)}`).join('&')
  const url = `${GAMMA}?${params}${closed ? '&closed=true' : ''}&limit=500`
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, cache: 'no-store' })
    if (!r.ok) return []
    const j = await r.json()
    return Array.isArray(j) ? j : j.data || []
  } catch { return [] }
}

// ---------- Kalshi (signed) ----------
function kalshiHeaders(method: string, path: string): Record<string, string> | null {
  const keyId = process.env.KALSHI_API_KEY_ID
  const privRaw = process.env.KALSHI_PRIVATE_KEY
  if (!keyId || !privRaw || keyId === 'placeholder') return null
  const privateKey = privRaw.replace(/\\n/g, '\n').replace(/\\r/g, '').trim()
  const ts = Date.now().toString()
  const message = `${ts}${method}${path.split('?')[0]}`
  try {
    const sign = createSign('RSA-SHA256'); sign.update(message); sign.end()
    return {
      'KALSHI-ACCESS-KEY': keyId,
      'KALSHI-ACCESS-TIMESTAMP': ts,
      'KALSHI-ACCESS-SIGNATURE': sign.sign(privateKey, 'base64'),
      Accept: 'application/json',
    }
  } catch { return null }
}
async function kalshiByTickers(tickers: string[]): Promise<any[]> {
  if (tickers.length === 0) return []
  const path = `/trade-api/v2/markets?tickers=${tickers.join(',')}&limit=200`
  const headers = kalshiHeaders('GET', path)
  if (!headers) return []
  try {
    const r = await fetch(`${KALSHI_BASE}${path}`, { headers, cache: 'no-store' })
    if (!r.ok) return []
    const j = await r.json()
    return j.markets || []
  } catch { return [] }
}
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

// ---------- shared helpers ----------
async function gatherCandidates(platform: string, now: string, staleBefore: string, recheckBefore: string): Promise<Cand[]> {
  // backlog: closed-but-future that we've never resolution-checked
  const { data: backlog } = await supabaseAdmin
    .from('markets').select('id, question, probability, status')
    .eq('platform', platform).eq('status', 'closed').eq('resolution_checked', false)
    .gt('end_date', now).limit(LIMIT)
  // resolved-early suspects: active, dropped from coverage, not verified recently
  const { data: stale } = await supabaseAdmin
    .from('markets').select('id, question, probability, status')
    .eq('platform', platform).eq('status', 'active')
    .lt('fetched_at', staleBefore)
    .or(`verified_at.is.null,verified_at.lt.${recheckBefore}`)
    .limit(LIMIT)
  const seen = new Set<string>()
  return [...(backlog || []), ...(stale || [])]
    .filter(c => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .slice(0, LIMIT) as Cand[]
}

async function updateIn(ids: string[], patch: Record<string, unknown>) {
  for (let i = 0; i < ids.length; i += 100) {
    await supabaseAdmin.from('markets').update(patch).in('id', ids.slice(i, i + 100))
  }
}
async function recordResolutions(rows: any[]) {
  for (let i = 0; i < rows.length; i += 100) {
    await supabaseAdmin.from('market_resolutions').upsert(rows.slice(i, i + 100), { onConflict: 'id' })
  }
}

// Set each market's status to whatever the platform reported.
async function applyTruth(nowIso: string, l: {
  activeIds: string[]; rRows: any[]; resolvedIds: string[]; goneClosedIds: string[]; goneActiveIds: string[]; skipIds: string[]
}) {
  // confirmed live (reactivate a false-close, or keep a stale market alive)
  if (l.activeIds.length) await updateIn(l.activeIds, { status: 'active', verified_at: nowIso })
  // resolved (record outcome, ensure closed)
  if (l.rRows.length) {
    await recordResolutions(l.rRows)
    await updateIn(l.resolvedIds, { status: 'closed', resolution_checked: true, verified_at: nowIso })
  }
  // was closed & not found on platform -> terminal
  if (l.goneClosedIds.length) await updateIn(l.goneClosedIds, { resolution_checked: true, verified_at: nowIso })
  // was active & couldn't confirm resolution -> leave active, just re-throttle
  if (l.goneActiveIds.length) await updateIn(l.goneActiveIds, { verified_at: nowIso })
  // unverifiable (no condition_id) -> terminal
  if (l.skipIds.length) await updateIn(l.skipIds, { resolution_checked: true, verified_at: nowIso })
}

// ---------- Polymarket pass ----------
async function verifyPoly(now: string, staleBefore: string, recheckBefore: string): Promise<PassResult> {
  const cand = await gatherCandidates('polymarket', now, staleBefore, recheckBefore)
  if (cand.length === 0) return { checked: 0, active: 0, resolved: 0, gone: 0 }

  const skipIds = cand.filter(c => !c.id.startsWith('polymarket-0x')).map(c => c.id)
  const byCid = new Map<string, Cand>()
  for (const c of cand) if (c.id.startsWith('polymarket-0x')) byCid.set(c.id.replace('polymarket-', ''), c)
  const cids = [...byCid.keys()]

  const activeCids = new Set<string>()
  const resolved = new Map<string, number[]>()
  for (let i = 0; i < cids.length; i += POLY_CHUNK) {
    const batch = cids.slice(i, i + POLY_CHUNK)
    const act = await gamma(batch, false)
    for (const m of act) if (m.conditionId && !m.closed && m.active) activeCids.add(m.conditionId)
    const remaining = batch.filter(c => !activeCids.has(c))
    const res = await gamma(remaining, true)
    for (const m of res) {
      if (!m.conditionId || !m.closed) continue
      let p: number[] = []
      try { p = JSON.parse(m.outcomePrices || '[]').map(Number) } catch {}
      resolved.set(m.conditionId, p)
    }
  }

  const nowIso = new Date().toISOString()
  const activeIds: string[] = [], rRows: any[] = [], resolvedIds: string[] = [], goneClosedIds: string[] = [], goneActiveIds: string[] = []
  for (const [cid, row] of byCid) {
    const id = 'polymarket-' + cid
    if (activeCids.has(cid)) activeIds.push(id)
    else if (resolved.has(cid)) {
      const p = resolved.get(cid)!
      const o = p[0] === 1 ? 'YES' : p[0] === 0 ? 'NO' : 'UNCLEAR'
      rRows.push({ id, platform: 'polymarket', question: row.question, resolved_outcome: o, final_probability: row.probability ?? null, resolution_source: 'polymarket-gamma', resolved_at: nowIso })
      resolvedIds.push(id)
    } else if (row.status === 'active') goneActiveIds.push(id)
    else goneClosedIds.push(id)
  }

  await applyTruth(nowIso, { activeIds, rRows, resolvedIds, goneClosedIds, goneActiveIds, skipIds })
  return { checked: cids.length, active: activeIds.length, resolved: rRows.length, gone: goneClosedIds.length }
}

// ---------- Kalshi pass ----------
async function verifyKalshi(now: string, staleBefore: string, recheckBefore: string): Promise<PassResult> {
  const cand = await gatherCandidates('kalshi', now, staleBefore, recheckBefore)
  if (cand.length === 0) return { checked: 0, active: 0, resolved: 0, gone: 0 }

  const byTicker = new Map<string, Cand>(cand.map(c => [c.id.replace('kalshi-', ''), c]))
  const tickers = [...byTicker.keys()]
  const found = new Map<string, any>()
  for (let i = 0; i < tickers.length; i += KALSHI_CHUNK) {
    const mkts = await kalshiByTickers(tickers.slice(i, i + KALSHI_CHUNK))
    for (const m of mkts) if (m.ticker) found.set(m.ticker, m)
    await sleep(250)
  }

  const nowIso = new Date().toISOString()
  const activeIds: string[] = [], rRows: any[] = [], resolvedIds: string[] = [], goneClosedIds: string[] = [], goneActiveIds: string[] = []
  for (const [ticker, row] of byTicker) {
    const id = 'kalshi-' + ticker
    const m = found.get(ticker)
    if (!m) { (row.status === 'active' ? goneActiveIds : goneClosedIds).push(id); continue }
    const status = String(m.status || '').toLowerCase()
    if (status === 'open' || status === 'active') activeIds.push(id)
    else if (status === 'closed') continue // trading ended, not yet settled — re-check next run
    else {
      const res = String(m.result || '').toLowerCase().trim()
      const o = res === 'yes' ? 'YES' : res === 'no' ? 'NO' : (res ? res.toUpperCase() : 'UNCLEAR')
      rRows.push({ id, platform: 'kalshi', question: row.question, resolved_outcome: o, final_probability: row.probability ?? null, resolution_source: 'kalshi', resolved_at: nowIso })
      resolvedIds.push(id)
    }
  }

  await applyTruth(nowIso, { activeIds, rRows, resolvedIds, goneClosedIds, goneActiveIds, skipIds: [] })
  return { checked: tickers.length, active: activeIds.length, resolved: rRows.length, gone: goneClosedIds.length }
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const t0 = Date.now()
  const now = new Date().toISOString()
  const staleBefore = new Date(Date.now() - STALE_HOURS * 3600e3).toISOString()
  const recheckBefore = new Date(Date.now() - RECHECK_HOURS * 3600e3).toISOString()

  const polymarket = await verifyPoly(now, staleBefore, recheckBefore)
  const kalshi = await verifyKalshi(now, staleBefore, recheckBefore)
  const more = polymarket.checked === LIMIT || kalshi.checked === LIMIT
  return NextResponse.json({
    ok: true,
    polymarket,
    kalshi,
    remaining_estimate: more ? 'more — run again' : 'caught up',
    tookMs: Date.now() - t0,
  })
}
