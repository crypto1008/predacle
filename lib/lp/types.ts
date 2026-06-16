// Shared, platform-agnostic LP types. Polymarket + Kalshi normalize into this.

export type LpPlatform = 'polymarket' | 'kalshi'

export interface LpFactors {
  reward: number   // 0..1 — size of the daily reward pool (0 for Kalshi: unmeasurable)
  time: number     // 0..1 — time-to-resolution sweet spot
  price: number    // 0..1 — price-band sweet spot (15-40c)
  spread: number   // 0..1 — spread tightness / book health
  volume: number   // 0..1 — market activity
}

export interface LpOpportunity {
  id: string                  // matches markets.id, e.g. `polymarket-${conditionId}`
  platform: LpPlatform
  conditionId: string | null  // Polymarket
  ticker: string | null       // Kalshi
  question: string
  url: string

  dailyReward: number         // daily reward pool, USD (0 for Kalshi)
  minSize: number | null      // min order size to qualify
  maxSpread: number | null    // reward band width (cents, e.g. 3.5)

  price: number | null        // mid, 0..1
  spread: number | null       // bestAsk - bestBid, 0..1
  days: number | null         // days to resolution
  volume24hr: number | null   // Polymarket: 24h $ volume; Kalshi: contract volume
  openInterest?: number | null // Kalshi: open interest (contracts); omitted for Polymarket

  lpScore: number             // 1..100
  competition?: number | null // 0..1 reward-pool crowding (Polymarket only; null = unmeasurable). Higher = more contested = thinner share.
  factors: LpFactors          // transparency / debugging
  rewardPrecision: 'exact' | 'qualitative'  // Polymarket exact; Kalshi qualitative

  fetchedAt: string
}
