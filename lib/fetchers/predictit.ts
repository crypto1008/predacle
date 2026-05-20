import { Market } from '../types'

export async function fetchPredictIt(): Promise<Market[]> {
  // Try multiple approaches for PredictIt
  const approaches = [
    {
      url: 'https://www.predictit.org/api/marketdata/all',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.predictit.org/',
        'Origin': 'https://www.predictit.org',
        'Cache-Control': 'no-cache',
      }
    }
  ]

  for (const approach of approaches) {
    try {
      const response = await fetch(approach.url, {
        headers: approach.headers,
        cache: 'no-store',
      })

      if (!response.ok) {
        console.error(`PredictIt returned ${response.status}`)
        continue
      }

      const data = await response.json()
      const markets = data.markets || []

      return markets.slice(0, 50).map((m: any) => {
        const contract = m.contracts?.[0]
        const price = contract?.lastTradePrice ?? null
        return {
          id: `predictit-${m.id}`,
          platform: 'predictit' as const,
          question: m.name,
          probability: price,
          volume: null,
          volume_label: null,
          end_date: null,
          end_date_label: null,
          traders: null,
          category: 'politics',
          url: `https://www.predictit.org/markets/detail/${m.id}`,
          status: 'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
    } catch (error) {
      console.error('PredictIt attempt failed:', error)
    }
  }

  return []
}