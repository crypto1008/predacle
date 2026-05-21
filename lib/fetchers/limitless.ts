import { Market } from '../types'

export async function fetchLimitless(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://api.limitless.exchange/api-v1/markets/browse-active',
      {
        headers: {
          'User-Agent': 'Predacle/1.0 (https://predacle.com)',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      console.error(`Limitless error: ${response.status}`)
      return []
    }

    const data = await response.json()
    const markets = data.markets || data.data || data || []

    if (!Array.isArray(markets) || markets.length === 0) {
      console.log('Limitless: no markets returned')
      return []
    }

    console.log(`Limitless: got ${markets.length} markets`)

    return markets
      .filter((m: any) => m.title || m.question || m.slug)
      .map((m: any) => {
        // YES price between 0.01 and 0.99 = probability
        let probability: number | null = null
        if (m.prices?.yes !== undefined) {
          probability = parseFloat(m.prices.yes)
        } else if (m.bestAsk !== undefined) {
          probability = parseFloat(m.bestAsk)
        } else if (m.lastPrice !== undefined) {
          probability = parseFloat(m.lastPrice)
        }

        const vol = m.volume || m.totalVolume || null
        const volNum = vol ? parseFloat(String(vol)) : null

        return {
          id: `limitless-${m.slug || m.id}`,
          platform: 'limitless',
          question: m.title || m.question || m.slug || '',
          probability,
          volume: volNum,
          volume_label: volNum
            ? volNum >= 1_000_000
              ? `$${(volNum / 1_000_000).toFixed(1)}M`
              : `$${Math.round(volNum).toLocaleString()}`
            : null,
          end_date: m.expiresAt || m.endDate || null,
          end_date_label:
            m.expiresAt || m.endDate
              ? new Date(m.expiresAt || m.endDate).toLocaleDateString(
                  'en-US',
                  { month: 'short', year: 'numeric' }
                )
              : null,
          traders: null,
          category: m.category || m.group || 'crypto',
          url: m.slug
            ? `https://limitless.exchange/${m.slug}`
            : 'https://limitless.exchange',
          status: 'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error: any) {
    console.error('Limitless fetch error:', error.message)
    return []
  }
}