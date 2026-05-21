import { Market } from '../types'

export async function fetchLimitless(): Promise<Market[]> {
  try {
    // Try the documented endpoint
    const response = await fetch(
      'https://api.limitless.exchange/api-v1/markets/browse-active',
      {
        headers: {
          'User-Agent': 'Predacle/1.0 (https://predacle.com)',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    console.log(`Limitless response status: ${response.status}`)

    if (!response.ok) {
      const text = await response.text()
      console.error(`Limitless error ${response.status}: ${text.substring(0, 200)}`)
      return []
    }

    const json = await response.json()
    console.log(`Limitless raw response type: ${typeof json}`)
    console.log(`Limitless raw keys: ${Object.keys(json).join(', ')}`)

    // Handle different response formats
    const markets = json.markets || json.data || json.items ||
      (Array.isArray(json) ? json : [])

    if (!Array.isArray(markets) || markets.length === 0) {
      console.log('Limitless: empty response — raw:', JSON.stringify(json).substring(0, 300))
      return []
    }

    console.log(`Limitless: processing ${markets.length} markets`)
    console.log('Limitless sample market:', JSON.stringify(markets[0]).substring(0, 300))

    return markets
      .filter((m: any) => m.title || m.question || m.slug)
      .map((m: any) => {
        let probability: number | null = null

        // Try multiple price field names
        if (m.prices?.yes !== undefined) {
          probability = parseFloat(m.prices.yes)
        } else if (m.bestAsk !== undefined) {
          probability = parseFloat(m.bestAsk)
        } else if (m.lastPrice !== undefined) {
          probability = parseFloat(m.lastPrice)
        } else if (m.probability !== undefined) {
          probability = parseFloat(m.probability)
        } else if (m.price !== undefined) {
          probability = parseFloat(m.price)
        }

        const vol = m.volume || m.totalVolume || m.volumeUsd || null
        const volNum = vol ? parseFloat(String(vol)) : null

        return {
          id: `limitless-${m.slug || m.id || Math.random()}`,
          platform: 'limitless',
          question: m.title || m.question || m.name || String(m.slug) || '',
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
          category: m.category || m.group || m.tags?.[0] || 'crypto',
          url: m.slug
            ? `https://limitless.exchange/${m.slug}`
            : m.id
            ? `https://limitless.exchange/market/${m.id}`
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