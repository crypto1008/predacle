import { fetchPolymarket } from './polymarket'
import { fetchManifold } from './manifold'
import { fetchKalshi } from './kalshi'
import { fetchMyriad } from './myriad'
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
  ])

  const markets: Market[] = []
  const errors: Record<string, string> = {}
  const platforms = ['polymarket', 'manifold', 'kalshi', 'myriad']

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      markets.push(...result.value)
    } else {
      errors[platforms[i]] = result.reason?.message || 'Unknown error'
      console.error(`${platforms[i]} failed:`, result.reason)
    }
  })

  return { markets, errors }
}