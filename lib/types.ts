export type MarketStatus = 'active' | 'closed' | 'resolved'
export type Platform = 'polymarket' | 'manifold' | 'metaculus' | 'predictit' | 'kalshi'

export interface Market {
  id: string
  platform: Platform
  question: string
  probability: number | null
  volume: number | null
  volume_label: string | null
  end_date: string | null
  end_date_label: string | null
  traders: number | null
  category: string | null
  url: string
  status: MarketStatus
  fetched_at: string
  created_at?: string
}

export interface MarketGroup {
  fingerprint: string
  question: string
  markets: Market[]
  avgProbability: number
  platforms: Platform[]
}

export interface FetchResult {
  platform: Platform
  markets: Market[]
  error?: string
}