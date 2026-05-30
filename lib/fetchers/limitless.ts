import { Market } from '../types'

// Limitless Exchange API only exposes short-term automated crypto price markets
// (5-min, hourly ETH/BTC/SOL up-or-down). Their politics, FIFA, esports pages
// on the website display Polymarket markets via their UI — not unique Limitless data.
// We already fetch those markets directly from Polymarket.
// Re-enable this fetcher if Limitless adds a proper long-term prediction market API.

export async function fetchLimitless(): Promise<Market[]> {
  return []
}