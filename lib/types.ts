export type MarketStatus = 'active' | 'closed' | 'resolved'

export type Platform =
  | 'polymarket'
  | 'manifold'
  | 'kalshi'
  | 'myriad'
  | 'limitless'
  | 'metaculus'
  | 'predictit'

export interface Market {
  id: string
  platform: string
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
  probability_change?: number | null
  image_url?: string | null
}

export interface FetchResult {
  platform: Platform
  markets: Market[]
  error?: string
}