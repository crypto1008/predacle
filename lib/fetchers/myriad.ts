import { Market } from '../types'

export async function fetchMyriad(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://api-v2.myriadprotocol.com/markets?state=open&sort=volume_24h&limit=50',
      {
        headers: {
          'User-Agent': 'Predacle/1.0 (https://predacle.com)',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      console.error(`Myriad error: ${response.status}`)
      return []
    }

    const json = await response.json()
    const markets = json.data || json.markets || json || []

    if (!Array.isArray(markets) || markets.length === 0) {
      console.log('Myriad: no markets returned')
      return []
    }

    console.log(`Myriad: got ${markets.length} markets`)

    return markets
      .filter((m: any) => m.title || m.question)
      .map((m: any) => {
        // Extract YES probability from outcomes
        let probability: number | null = null

        if (m.outcomes && Array.isArray(m.outcomes)) {
          const yesOutcome = m.outcomes.find(
            (o: any) =>
              o.title?.toLowerCase() === 'yes' ||
              o.label?.toLowerCase() === 'yes' ||
              o.id === 0
          )
          if (yesOutcome?.price !== undefined) {
            const raw = parseFloat(yesOutcome.price)
            // Prices in 1e18 format (500000000000000000 = 0.50)
            probability = raw > 1 ? raw / 1e18 : raw
          }
        }

        const vol = m.volume24h || m.volume || null

        return {
          id: `myriad-${m.id}`,
          platform: 'myriad' as any,
          question: m.title || m.question || '',
          probability,
          volume: vol ? parseFloat(vol) : null,
          volume_label: vol
            ? parseFloat(vol) >= 1_000_000
              ? `$${(parseFloat(vol) / 1_000_000).toFixed(1)}M`
              : `$${Math.round(parseFloat(vol)).toLocaleString()}`
            : null,
          end_date: m.closingDate || m.expirationDate || null,
          end_date_label:
            m.closingDate || m.expirationDate
              ? new Date(
                  m.closingDate || m.expirationDate
                ).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })
              : null,
          traders: m.liquidity || null,
          category: m.category || m.topic || 'crypto',
          url: m.slug
            ? `https://myriad.markets/markets/${m.slug}`
            : m.id
            ? `https://myriad.markets/markets/${m.id}`
            : 'https://myriad.markets',
          status: 'active' as const,
          fetched_at: new Date().toISOString(),
        }
      })
  } catch (error: any) {
    console.error('Myriad fetch error:', error.message)
    return []
  }
}