import { Market } from '../types'

export async function fetchLimitless(): Promise<Market[]> {
  try {
    console.log('Limitless: fetching...')

    const response = await fetch(
      'https://api.limitless.exchange/markets/active',
      {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      }
    )

    console.log(`Limitless: status ${response.status}`)
    if (!response.ok) return []

    const json = await response.json()
    const markets: any[] = json.data || []

    console.log(`Limitless: ${markets.length} markets received`)

    return markets
      .filter((m: any) => !!m.title)
      .map((m: any) => {
        let probability: number | null = null
        if (Array.isArray(m.prices) && typeof m.prices[0] === 'number') {
          const raw = m.prices[0]
          // Normalize: some markets use percentage (65) others decimal (0.565)
          const normalized = raw > 1 ? raw / 100 : raw
          // Clamp to valid DECIMAL(5,4) range
          probability = Math.min(0.9999, Math.max(0, normalized))
        }

        return {
          id: `limitless-${m.id}`,
          platform: 'limitless',
          question: String(m.title),
          probability,
          volume: null,
          volume_label: null,
          end_date: null,
          end_date_label: null,
          traders: null,
          category: 'crypto',
          url: `https://limitless.exchange/markets/${m.id}`,
          status: 'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error: any) {
    console.error('Limitless error:', error.message)
    return []
  }
}