import { fetchPolymarket } from './polymarket'
import { fetchManifold } from './manifold'
import { fetchKalshi } from './kalshi'
import { fetchMyriad } from './myriad'
import { fetchLimitless } from './limitless'
import { fetchAzuro } from './azuro'
import { Market } from '../types'

export async function fetchAllMarkets(): Promise<{
  markets: Market[]
  errors: Record<string, string>
}> {
  const results = await Promise.allSettled([
    fetchPolymarket(),
    fetchManifold(),
    fetchKalshi(),
    fetchMyriad(),
    fetchLimitless(),
    fetchAzuro(),
  ])

  const markets: Market[] = []
  const errors: Record<string, string> = {}
  const platforms = [
    'polymarket', 'manifold', 'kalshi',
    'myriad', 'limitless', 'azuro'
  ]

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      markets.push(...result.value)
    } else {
      errors[platforms[i]] = result.reason?.message || 'Unknown error'
      console.error(`${platforms[i]} failed:`, result.reason)
    }
  })

  // Per-platform quality floor. Drops near-dead markets so the app surfaces
  // only markets with real trading activity. Thresholds chosen from the live
  // volume distribution (median Polymarket ~$54k, Kalshi ~40% under $100).
  //   - Limitless & Azuro are intentionally omitted (= no floor): their volume
  //     isn't reported comparably and a dollar floor would wipe them out.
  //   - Manifold is play-money Mana, so its floor is on a different scale.
  // Existing markets below the floor stop being re-fetched and are auto-closed
  // by the 12h staleness sweep in the fetch-markets route. Tune freely.
  const MIN_VOLUME: Record<string, number> = {
    polymarket: 1000,
    kalshi: 1000,
    myriad: 1000,
    manifold: 5000,
    // limitless, azuro -> no floor
  }
  const beforeCount = markets.length
  const kept = markets.filter((m) => {
    const floor = MIN_VOLUME[m.platform]
    if (floor === undefined) return true
    return (m.volume ?? 0) >= floor
  })
  const dropped: Record<string, number> = {}
  for (const m of markets) {
    const floor = MIN_VOLUME[m.platform]
    if (floor !== undefined && (m.volume ?? 0) < floor) {
      dropped[m.platform] = (dropped[m.platform] || 0) + 1
    }
  }
  console.log(`Volume floor: kept ${kept.length}/${beforeCount}, dropped`, dropped)

  return { markets: kept, errors }
}
