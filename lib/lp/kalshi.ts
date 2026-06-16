// Kalshi LP adapter. Pulls macro/econ/politics series (no sports, no MVE flood),
// filters + scores with the no-reward model, returns LpOpportunity[].
// Kalshi publishes no reward pool, so rewardPrecision is 'qualitative'.

import { LpOpportunity } from './types'
import { lpKalshiExcludeReason, lpScoreNoReward } from './score'
import { createSign } from 'crypto'

const BASE = 'https://api.elections.kalshi.com'

// Macro / econ / crypto / politics only — single-event sports deliberately excluded.
const SERIES = [
  'KXFEDDECISION', 'KXCPIYOY', 'KXINXU', 'KXNASDAQ100U', 'KXAAAGASM',
  'KXBTC', 'KXBTCD', 'KXETH', 'KXETHD', 'KXNEXTPOPE', 'KXCANADAPM',
]

function kalshiHeaders(method: string, path: string): Record<string, string> {
  const keyId = process.env.KALSHI_API_KEY_ID
  const pkRaw = process.env.KALSHI_PRIVATE_KEY
  if (!keyId || !pkRaw || keyId === 'placeholder') return {}
  const privateKey = pkRaw.replace(/\\n/g, '\n').replace(/\\r/g, '').trim()
  const ts = Date.now().toString()
  try {
    const s = createSign('RSA-SHA256')
    s.update(`${ts}${method}${path.split('?')[0]}`); s.end()
    return {
      'KALSHI-ACCESS-KEY': keyId,
      'KALSHI-ACCESS-TIMESTAMP': ts,
      'KALSHI-ACCESS-SIGNATURE': s.sign(privateKey, 'base64'),
      'Accept': 'application/json',
    }
  } catch { return {} }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const num = (v: any): number | null => { const n = parseFloat(v); return Number.isFinite(n) ? n : null }
const daysUntil = (iso: string | null): number | null => { if (!iso) return null; const t = Date.parse(iso); return Number.isNaN(t) ? null : Math.round((t - Date.now()) / 86400000) }
const cleanTitle = (t: string): string => (t || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()

export async function fetchKalshiLp(): Promise<LpOpportunity[]> {
  const keyId = process.env.KALSHI_API_KEY_ID
  if (!keyId || keyId === 'placeholder') return []

  const now = new Date().toISOString()
  const seen = new Set<string>()
  const out: LpOpportunity[] = []

  for (const series of SERIES) {
    const path = `/trade-api/v2/markets?limit=200&status=open&series_ticker=${series}`
    const headers = kalshiHeaders('GET', path)
    if (Object.keys(headers).length === 0) continue

    let data: any
    try {
      const res = await fetch(`${BASE}${path}`, { headers, cache: 'no-store' })
      if (res.status === 429) { await sleep(400); continue }
      if (!res.ok) { await sleep(120); continue }
      data = await res.json()
    } catch { continue }

    for (const m of (data?.markets || [])) {
      const ticker = m.ticker || ''
      if (!ticker || seen.has(ticker)) continue
      seen.add(ticker)

      const yb = num(m.yes_bid_dollars), ya = num(m.yes_ask_dollars)
      const price = (yb != null && ya != null) ? (yb + ya) / 2 : null
      const spread = (yb != null && ya != null) ? +(ya - yb).toFixed(4) : null
      const days = daysUntil(m.close_time || m.expiration_time)
      const volume = num(m.volume_fp) ?? num(m.volume_24h_fp)
      const openInterest = num(m.open_interest_fp) ?? num(m.open_interest)

      const input = { price, spread, days, volume }
      if (lpKalshiExcludeReason(input)) continue

      const { score, factors } = lpScoreNoReward(input)
      const seriesLower = String(m.series_ticker || series).toLowerCase()

      out.push({
        id: `kalshi-${ticker}`,
        platform: 'kalshi',
        conditionId: null,
        ticker,
        question: cleanTitle(m.title),
        url: `https://kalshi.com/markets/${seriesLower}`,
        dailyReward: 0,
        minSize: null,
        maxSpread: null,
        price: price != null ? +Number(price).toFixed(4) : null,
        spread,
        days,
        volume24hr: volume,
        openInterest,
        lpScore: score,
        competition: null,   // no published reward pool -> crowding unmeasurable
        factors,
        rewardPrecision: 'qualitative',
        fetchedAt: now,
      })
    }
    await sleep(220)
  }

  out.sort((a, b) => b.lpScore - a.lpScore)
  return out
}
