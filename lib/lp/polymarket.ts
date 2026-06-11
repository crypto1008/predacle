// Polymarket LP adapter. Pure data: fetches the reward universe (CLOB sampling)
// + market meta (gamma by condition_id), normalizes, scores, returns sorted
// LpOpportunity[]. No DB here — persistence lives in the refresh route.

import { LpOpportunity } from './types'
import { lpExcludeReason, lpScore, LP_REWARD_FLOOR } from './score'

const SAMPLING = 'https://clob.polymarket.com/sampling-simplified-markets'
const GAMMA    = 'https://gamma-api.polymarket.com/markets'
const SCAN_PAGES = 25
const BATCH      = 20

interface RewardRow { rate: number; minSize: number | null; maxSpread: number | null; yesPrice: number | null }
interface MetaRow   { question: string; bid: number | null; ask: number | null; endDate: string | null; volume24hr: number; slug: string | null }

async function getJSON(url: string): Promise<any> {
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
  if (!r.ok) throw new Error(`${url.slice(0, 60)} -> ${r.status}`)
  return r.json()
}

async function loadRewardUniverse(): Promise<Map<string, RewardRow>> {
  const out = new Map<string, RewardRow>()
  let cursor = ''
  for (let i = 0; i < SCAN_PAGES; i++) {
    const d = await getJSON(cursor ? `${SAMPLING}?next_cursor=${encodeURIComponent(cursor)}` : SAMPLING)
    const data: any[] = d.data || []
    for (const m of data) {
      const rate = Math.max(0, ...((m.rewards?.rates) || []).map((r: any) => Number(r.rewards_daily_rate) || 0))
      if (rate < LP_REWARD_FLOOR) continue
      const yes = (m.tokens || []).find((t: any) => (t.outcome || '').toLowerCase() === 'yes')
      out.set(String(m.condition_id || '').toLowerCase(), {
        rate,
        minSize: m.rewards?.min_size ?? null,
        maxSpread: m.rewards?.max_spread ?? null,
        yesPrice: yes ? Number(yes.price) : null,
      })
    }
    cursor = d.next_cursor || ''
    if (!cursor || cursor === 'LTE=' || data.length === 0) break
  }
  return out
}

async function loadGammaMeta(ids: string[]): Promise<Map<string, MetaRow>> {
  const idx = new Map<string, MetaRow>()
  for (let i = 0; i < ids.length; i += BATCH) {
    const qs = ids.slice(i, i + BATCH).map(c => `condition_ids=${c}`).join('&')
    let d: any
    try { d = await getJSON(`${GAMMA}?limit=${BATCH}&${qs}`) } catch { continue }
    const list: any[] = Array.isArray(d) ? d : (d.data || [])
    for (const m of list) {
      const cid = String(m.conditionId || '').toLowerCase()
      if (!cid) continue
      idx.set(cid, {
        question: m.question || '',
        bid: m.bestBid != null ? Number(m.bestBid) : null,
        ask: m.bestAsk != null ? Number(m.bestAsk) : null,
        endDate: m.endDate || m.endDateIso || null,
        volume24hr: Number(m.volume24hr || m.volume24hrClob || 0),
        slug: m.slug || null,
      })
    }
  }
  return idx
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isNaN(t) ? null : Math.round((t - Date.now()) / 86400000)
}

export async function fetchPolymarketLp(): Promise<LpOpportunity[]> {
  const universe = await loadRewardUniverse()
  const ids = [...universe.keys()]
  const meta = await loadGammaMeta(ids)
  const now = new Date().toISOString()
  const out: LpOpportunity[] = []

  for (const cid of ids) {
    const rw = universe.get(cid)!
    const g = meta.get(cid)
    const haveBook = !!g && g.bid != null && g.ask != null
    const price = haveBook ? (g!.bid! + g!.ask!) / 2 : rw.yesPrice
    const spread = haveBook ? +(g!.ask! - g!.bid!).toFixed(4) : null
    const days = daysUntil(g?.endDate ?? null)
    const volume24hr = g?.volume24hr ?? null

    const input = { dailyReward: rw.rate, price, spread, days, volume24hr }
    if (lpExcludeReason(input)) continue

    const { score, factors } = lpScore(input)
    out.push({
      id: `polymarket-${cid}`,
      platform: 'polymarket',
      conditionId: cid,
      ticker: null,
      question: g?.question || '',
      url: g?.slug ? `https://polymarket.com/event/${g.slug}` : 'https://polymarket.com',
      dailyReward: rw.rate,
      minSize: rw.minSize,
      maxSpread: rw.maxSpread,
      price: price != null ? +Number(price).toFixed(4) : null,
      spread,
      days,
      volume24hr,
      lpScore: score,
      factors,
      rewardPrecision: 'exact',
      fetchedAt: now,
    })
  }

  out.sort((a, b) => b.lpScore - a.lpScore)
  return out
}
