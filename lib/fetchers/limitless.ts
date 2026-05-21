import { Market } from '../types'

export async function fetchLimitless(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://api.limitless.exchange/markets/active?limit=50',
      {
        headers: {
          'User-Agent': 'Predacle/1.0 (https://predacle.com)',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      }
    )

    console.log(`Limitless status: ${response.status}`)

    if (!response.ok) {
      console.error(`Limitless error: ${response.status}`)
      return []
    }

    const json = await response.json()
    const markets = json.data || []

    if (!Array.isArray(markets) || markets.length === 0) {
      console.log('Limitless: no markets returned')
      return []
    }

    console.log(`Limitless: got ${markets.length} markets`)

    return markets
      .filter((m: any) => m.title)
      .map((m: any) => {
        // Extract YES probability from prices array
        let probability: number | null = null
        if (Array.isArray(m.prices) && m.prices.length > 0) {
          const yesPrice = m.prices.find(
            (p: any) =>
              p.outcome?.toLowerCase() === 'yes' ||
              p.name?.toLowerCase() === 'yes' ||
              p.side?.toLowerCase() === 'yes'
          )
          if (yesPrice?.price !== undefined) {
            probability = parseFloat(String(yesPrice.price))
          } else if (typeof m.prices[0] === 'number') {
            probability = m.prices[0]
          } else if (m.prices[0]?.price !== undefined) {
            probability = parseFloat(String(m.prices[0].price))
          }
        }

        const vol = m.volume || m.totalVolume || null
        const volNum = vol ? parseFloat(String(vol)) : null

        return {
          id: `limitless-${m.id}`,
          platform: 'limitless',
          question: m.title || '',
          probability,
          volume: volNum,
          volume_label: volNum
            ? volNum >= 1_000_000
              ? `$${(volNum / 1_000_000).toFixed(1)}M`
              : `$${Math.round(volNum).toLocaleString()}`
            : null,
          end_date: m.expiresAt || m.endDate || m.closingDate || null,
          end_date_label:
            m.expiresAt || m.endDate || m.closingDate
              ? new Date(
                  m.expiresAt || m.endDate || m.closingDate
                ).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })
              : null,
          traders: null,
          category: m.category || 'crypto',
          url: `https://limitless.exchange/markets/${m.id}`,
          status: 'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error: any) {
    console.error('Limitless fetch error:', error.message)
    return []
  }
}