// Platform-agnostic LP quality filters + scoring. Identical math whether the
// row came from Polymarket or Kalshi. Tunable constants live at the top.

import { LpFactors } from './types'

export const LP_REWARD_FLOOR = 25     // candidate universe: pools >= $25/day
export const LP_MIN_DAYS     = 2      // exclude same-day / next-day churn
export const LP_MIN_VOLUME   = 10000  // exclude thin books ($/24h)
export const LP_MAX_SPREAD   = 0.10   // exclude dead / wide books

const W = { reward: 0.30, time: 0.20, price: 0.20, spread: 0.15, volume: 0.15 }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export interface LpScoreInput {
  dailyReward: number
  price: number | null
  spread: number | null
  days: number | null
  volume24hr: number | null
}

// Returns an exclusion reason, or null if the market is a valid LP opportunity.
export function lpExcludeReason(o: LpScoreInput): string | null {
  if (o.days == null || o.days < LP_MIN_DAYS)            return 'resolved / too soon'
  if (o.price == null)                                  return 'no price'
  if (o.price < 0.05 || o.price > 0.95)                 return 'extreme price'
  if (o.spread == null)                                 return 'no live book'
  if (o.spread > LP_MAX_SPREAD)                         return 'dead / wide book'
  if (o.volume24hr == null || o.volume24hr < LP_MIN_VOLUME) return 'low volume'
  return null
}

const rewardScore = (r: number) => clamp01((Math.log10(r) - 1) / (Math.log10(1000) - 1)) // $10->0, $1000->1
const timeScore   = (d: number) => d < 3 ? 0.3 : d <= 45 ? 1 - Math.abs(d - 20) / 40 : clamp01(0.6 - (d - 45) / 600)
const priceScore  = (p: number) => (p >= 0.15 && p <= 0.40) ? 1 : p < 0.15 ? clamp01(p / 0.15) : clamp01(1 - (p - 0.40) / 0.55)
const spreadScore = (s: number) => clamp01(1 - s / 0.05)
const volumeScore = (v: number) => clamp01((Math.log10(v) - 4) / (Math.log10(3e6) - 4))

export function lpFactors(o: LpScoreInput): LpFactors {
  return {
    reward: rewardScore(o.dailyReward),
    time:   timeScore(o.days ?? 0),
    price:  priceScore(o.price ?? 0),
    spread: spreadScore(o.spread ?? 1),
    volume: volumeScore(o.volume24hr ?? 0),
  }
}

export function lpScore(o: LpScoreInput): { score: number; factors: LpFactors } {
  const f = lpFactors(o)
  const s = f.reward * W.reward + f.time * W.time + f.price * W.price + f.spread * W.spread + f.volume * W.volume
  return { score: Math.round(100 * s), factors: f }
}

/* ---------------- Kalshi (no published reward pool) ----------------
   Kalshi's API exposes no reward field and liquidity_dollars is always 0,
   so we score on book health only: time + price + spread + activity(volume),
   renormalized to 100. The reward factor is set to 0 (the UI drops its bar). */

export const LP_KALSHI_VOL_FLOOR = 1000  // min contract volume (activity floor)

const activityScore = (v: number) => clamp01((Math.log10(v) - 3) / (Math.log10(1e7) - 3)) // 1e3->0, 1e7->1
const W_NOREWARD = { time: 0.30, price: 0.30, spread: 0.20, activity: 0.20 }

export interface LpKalshiInput {
  price: number | null
  spread: number | null
  days: number | null
  volume: number | null   // contract volume
}

export function lpKalshiExcludeReason(o: LpKalshiInput): string | null {
  if (o.price == null)                                    return 'no book'
  if (o.price < 0.03 || o.price > 0.97)                   return 'extreme price'
  if (o.spread == null || o.spread > LP_MAX_SPREAD)       return 'wide / dead book'
  if (o.days == null || o.days < LP_MIN_DAYS)             return 'resolved / too soon'
  if (o.volume == null || o.volume < LP_KALSHI_VOL_FLOOR) return 'low volume'
  return null
}

export function lpScoreNoReward(o: LpKalshiInput): { score: number; factors: LpFactors } {
  const time     = timeScore(o.days ?? 0)
  const price    = priceScore(o.price ?? 0)
  const spread   = spreadScore(o.spread ?? 1)
  const activity = activityScore(o.volume ?? 0)
  const s = time * W_NOREWARD.time + price * W_NOREWARD.price + spread * W_NOREWARD.spread + activity * W_NOREWARD.activity
  return { score: Math.round(100 * s), factors: { reward: 0, time, price, spread, volume: activity } }
}
