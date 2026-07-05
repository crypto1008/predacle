// lib/lp/estimate.ts
//
// Honest LP reward estimator.
//
// Polymarket publishes each market's daily reward POOL but NOT the total in-band
// LP liquidity, so an exact "your share" is genuinely unknowable. Rather than
// fabricate a single confident number, we:
//   1. infer an equilibrium APR from how contested the pool is (the competition
//      proxy the engine already computes),
//   2. turn that into an implied amount of competing LP capital,
//   3. compute your share as stake / (stake + competing capital), and
//   4. return a conservative / typical / optimistic RANGE.
//
// Every figure is a model estimate with a stated assumption — never a guarantee.
// Kalshi has no published pool, so a dollar estimate is intentionally unavailable
// there (we return available=false and the UI shows the risk panel only).

export interface LpEstimateInput {
  stake: number               // user's capital, USD
  dailyReward: number         // market's daily reward pool, USD (0/unknown for Kalshi)
  competition: number | null  // 0..1 crowding proxy (null = unknown)
  price: number | null        // mid, 0..1
  spread: number | null       // bestAsk-bestBid, 0..1
  days: number | null         // days to resolution
  minSize: number | null      // min order size to qualify
}

export interface LpEstimatePoint {
  eqApr: number                    // assumed market-clearing APR (fraction, e.g. 0.5 = 50%)
  impliedCompetingCapital: number  // L, USD
  yourShare: number                // 0..1 of the pool
  dailyReward: number              // your estimated $/day
  totalReward: number              // your estimated $ over remaining days
  apr: number                      // your annualized return (fraction)
}

export type Level = 'low' | 'moderate' | 'high' | 'unknown'

export interface LpRisk {
  inventory: { level: Level; note: string }
  spread: { level: 'tight' | 'ok' | 'wide' | 'unknown'; cents: number | null }
  horizon: { level: 'short' | 'medium' | 'long' | 'unknown'; days: number | null }
  competition: { level: Level; value: number | null }
  minSize: number | null
}

export interface LpEstimate {
  available: boolean
  reason?: string
  conservative: LpEstimatePoint
  typical: LpEstimatePoint
  optimistic: LpEstimatePoint
  risk: LpRisk
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

// Competition (0..1) -> equilibrium APR (fraction). An underfished pool clears at
// a high APR (few LPs competing); a saturated pool compresses toward a low APR.
// These bounds are deliberately conservative and are shown to the user.
export const EQ_APR_MAX = 1.0   // 100% at zero competition
export const EQ_APR_MIN = 0.15  // 15% at full saturation

export function eqAprFor(competition: number): number {
  return EQ_APR_MAX - clamp(competition, 0, 1) * (EQ_APR_MAX - EQ_APR_MIN)
}

function zeroPoint(): LpEstimatePoint {
  return { eqApr: 0, impliedCompetingCapital: 0, yourShare: 0, dailyReward: 0, totalReward: 0, apr: 0 }
}

function pointFor(stake: number, pool: number, eqApr: number, days: number | null): LpEstimatePoint {
  const L = (pool * 365) / eqApr          // implied competing capital: at equilibrium, L earns pool*365/yr
  const share = stake / (stake + L)
  const daily = share * pool
  const horizon = days == null ? 0 : Math.max(0, days)
  return {
    eqApr,
    impliedCompetingCapital: Math.round(L),
    yourShare: share,
    dailyReward: daily,
    totalReward: daily * horizon,
    apr: stake > 0 ? (daily * 365) / stake : 0,
  }
}

function buildRisk(inp: LpEstimateInput): LpRisk {
  // Inventory / directional risk: near 50c an LP's fills stay balanced; near the
  // extremes you accumulate one-sided inventory you must hold to resolution.
  let inv: LpRisk['inventory']
  if (inp.price == null) {
    inv = { level: 'unknown', note: 'no live price' }
  } else {
    const d = Math.abs(inp.price - 0.5)
    if (d < 0.1) inv = { level: 'low', note: 'price near 50¢ — fills stay balanced' }
    else if (d < 0.25) inv = { level: 'moderate', note: 'off-centre price — some one-sided inventory' }
    else inv = { level: 'high', note: 'extreme price — you accumulate one-sided inventory to hold to resolution' }
  }

  const cents = inp.spread == null ? null : Math.round(inp.spread * 100 * 10) / 10
  let spread: LpRisk['spread']
  if (cents == null) spread = { level: 'unknown', cents: null }
  else if (cents <= 2) spread = { level: 'tight', cents }
  else if (cents <= 5) spread = { level: 'ok', cents }
  else spread = { level: 'wide', cents }

  let horizon: LpRisk['horizon']
  if (inp.days == null) horizon = { level: 'unknown', days: null }
  else if (inp.days < 7) horizon = { level: 'short', days: inp.days }
  else if (inp.days <= 30) horizon = { level: 'medium', days: inp.days }
  else horizon = { level: 'long', days: inp.days }

  let comp: LpRisk['competition']
  if (inp.competition == null) comp = { level: 'unknown', value: null }
  else if (inp.competition < 0.34) comp = { level: 'low', value: inp.competition }
  else if (inp.competition < 0.67) comp = { level: 'moderate', value: inp.competition }
  else comp = { level: 'high', value: inp.competition }

  return { inventory: inv, spread, horizon, competition: comp, minSize: inp.minSize }
}

export function estimateLp(inp: LpEstimateInput): LpEstimate {
  const risk = buildRisk(inp)
  const poolOk = inp.dailyReward > 0
  const stakeOk = inp.stake > 0
  if (!poolOk || !stakeOk) {
    return {
      available: false,
      reason: !poolOk ? 'pool not published' : 'enter a stake',
      conservative: zeroPoint(), typical: zeroPoint(), optimistic: zeroPoint(),
      risk,
    }
  }
  // Unknown competition -> assume the middle of the band.
  const c = inp.competition == null ? 0.5 : clamp(inp.competition, 0, 1)
  // Bracket the unknown: +/-0.2 competition shift gives the conservative/optimistic bounds.
  const cHi = clamp(c + 0.2, 0, 1) // more contested -> lower reward (conservative)
  const cLo = clamp(c - 0.2, 0, 1) // less contested -> higher reward (optimistic)
  return {
    available: true,
    conservative: pointFor(inp.stake, inp.dailyReward, eqAprFor(cHi), inp.days),
    typical: pointFor(inp.stake, inp.dailyReward, eqAprFor(c), inp.days),
    optimistic: pointFor(inp.stake, inp.dailyReward, eqAprFor(cLo), inp.days),
    risk,
  }
}
