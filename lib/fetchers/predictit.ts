import { Market } from '../types'

export async function fetchPredictIt(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://www.predictit.org/api/marketdata/all',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.predictit.org/',
        },
        next: { revalidate: 300 }
      }
    )
    if (!response.ok) throw new Error(`PredictIt error: ${response.status}`)
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
    console.error('PredictIt fetch error:', error)
    return []
  }
}