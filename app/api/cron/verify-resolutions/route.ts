import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSign } from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GAMMA = 'https://gamma-api.polymarket.com/markets'
const KALSHI_BASE = 'https://api.elections.kalshi.com'
const POLY_CHUNK = 40
const KALSHI_CHUNK = 50
const LIMIT = 200 // candidates per platform per run

type PassResult = { checked: number; reactivated: number; resolved: number; gone: number }

// ---------- Polymarket (Gamma) ----------
// Plain query returns only ACTIVE markets; closed=true returns RESOLVED ones.
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
// Mirrors lib/fetchers/kalshi.ts signing exactly (signature covers path before '?').
function kalshiHeaders(method: string, path: string): Record<string, string> | null {
  const keyId = process.env.KALSHI_API_KEY_ID
  const privRaw = process.env.KALSHI_PRIVATE_KEY
  if (!keyId || !privRaw || keyId === 'placeholder') return null
  const privateKey = privRaw.replace(/\\n/g, '\n').replace(/\\r/g, '').trim()
  const ts = Date.now().toString()
  const message = `${ts}${method}${path.split('?')[0]}`
  try {
    const sign = createSign('RSA-SHA256')
    sign.update(message)
    sign.end()
    const sig = sign.sign(privateKey, 'base64')
    return {
      'KALSHI-ACCESS-KEY': keyId,
      'KALSHI-ACCESS-TIMESTAMP': ts,
      'KALSHI-ACCESS-SIGNATURE': sig,
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

// ---------- shared DB helpers ----------
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

// ---------- Polymarket pass ----------
async function verifyPoly(now: string): Promise<PassResult> {
  const { data: candidates, error } = await supabaseAdmin
    .from('markets')
    .select('id, question, probability')
    .eq('platform', 'polymarket')
    .eq('status', 'closed')
    .eq('resolution_checked', false)
    .gt('end_date', now)
    .limit(LIMIT)
  if (error || !candidates || candidates.length === 0) return { checked: 0, reactivated: 0, resolved: 0, gone: 0 }

  const skipIds = candidates.filter(c => !c.id.startsWith('polymarket-0x')).map(c => c.id)
  const byCid = new Map<string, any>()
  for (const c of candidates) if (c.id.startsWith('polymarket-0x')) byCid.set(c.id.replace('polymarket-', ''), c)
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

  const reIds: string[] = [], rRows: any[] = [], rIds: string[] = [], gIds: string[] = []
  for (const [cid, row] of byCid) {
    const id = 'polymarket-' + cid
    if (activeCids.has(cid)) reIds.push(id)
    else if (resolved.has(cid)) {
      const p = resolved.get(cid)!
      const o = p[0] === 1 ? 'YES' : p[0] === 0 ? 'NO' : 'UNCLEAR'
      rRows.push({ id, platform: 'polymarket', question: row.question, resolved_outcome: o, final_probability: row.probability ?? null, resolution_source: 'polymarket-gamma', resolved_at: new Date().toISOString() })
      rIds.push(id)
    } else gIds.push(id)
  }

  if (reIds.length) await updateIn(reIds, { status: 'active', fetched_at: new Date().toISOString() })
  if (rRows.length) { await recordResolutions(rRows); await updateIn(rIds, { resolution_checked: true }) }
  if (gIds.length) await updateIn(gIds, { resolution_checked: true })
  if (skipIds.length) await updateIn(skipIds, { resolution_checked: true })
  return { checked: cids.length, reactivated: reIds.length, resolved: rRows.length, gone: gIds.length }
}

// ---------- Kalshi pass ----------
async function verifyKalshi(now: string): Promise<PassResult> {
  const { data: candidates, error } = await supabaseAdmin
    .from('markets')
    .select('id, question, probability')
    .eq('platform', 'kalshi')
    .eq('status', 'closed')
    .eq('resolution_checked', false)
    .gt('end_date', now)
    .limit(LIMIT)
  if (error || !candidates || candidates.length === 0) return { checked: 0, reactivated: 0, resolved: 0, gone: 0 }

  const byTicker = new Map<string, any>(candidates.map(c => [c.id.replace('kalshi-', ''), c]))
  const tickers = [...byTicker.keys()]

  const found = new Map<string, any>()
  for (let i = 0; i < tickers.length; i += KALSHI_CHUNK) {
    const batch = tickers.slice(i, i + KALSHI_CHUNK)
    const mkts = await kalshiByTickers(batch)
    for (const m of mkts) if (m.ticker) found.set(m.ticker, m)
    await sleep(250)
  }

  const reIds: string[] = [], rRows: any[] = [], rIds: string[] = [], gIds: string[] = []
  for (const [ticker, row] of byTicker) {
    const id = 'kalshi-' + ticker
    const m = found.get(ticker)
    if (!m) { gIds.push(id); continue }
    const status = String(m.status || '').toLowerCase()
    if (status === 'open' || status === 'active') {
      reIds.push(id)
    } else if (status === 'closed') {
      // trading ended, not yet settled — leave as a candidate for the next run
      continue
    } else {
      // finalized / settled / determined / anything else terminal
      const res = String(m.result || '').toLowerCase().trim()
      const o = res === 'yes' ? 'YES' : res === 'no' ? 'NO' : (res ? res.toUpperCase() : 'UNCLEAR')
      rRows.push({ id, platform: 'kalshi', question: row.question, resolved_outcome: o, final_probability: row.probability ?? null, resolution_source: 'kalshi', resolved_at: new Date().toISOString() })
      rIds.push(id)
    }
  }

  if (reIds.length) await updateIn(reIds, { status: 'active', fetched_at: new Date().toISOString() })
  if (rRows.length) { await recordResolutions(rRows); await updateIn(rIds, { resolution_checked: true }) }
  if (gIds.length) await updateIn(gIds, { resolution_checked: true })
  return { checked: tickers.length, reactivated: reIds.length, resolved: rRows.length, gone: gIds.length }
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const t0 = Date.now()
  const now = new Date().toISOString()
  const polymarket = await verifyPoly(now)
  const kalshi = await verifyKalshi(now)
  const more = polymarket.checked === LIMIT || kalshi.checked === LIMIT
  return NextResponse.json({
    ok: true,
    polymarket,
    kalshi,
    remaining_estimate: more ? 'more — run again' : 'backlog likely cleared',
    tookMs: Date.now() - t0,
  })
}
