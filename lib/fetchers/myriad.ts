import { inferCategory } from '../utils/category'
import { Market } from '../types'

export async function fetchMyriad(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://api-v2.myriadprotocol.com/markets?state=open&sort=volume_24h&limit=200',
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

    const json    = await response.json()
    const all     = json.data || json.markets || json || []
    if (!Array.isArray(all) || all.length === 0) {
      console.log('Myriad: no markets returned')
      return []
    }

    // Filter out short-term candle markets (expire in minutes, URLs break instantly)
    const markets = all.filter((m: any) => {
      const title = (m.title || m.question || '').toLowerCase()
      if (title.includes('candle'))  return false
      if (title.includes('candles')) return false
      // Skip markets with no title
      if (!m.title && !m.question)   return false
      return true
    }).slice(0, 100) // Keep top 100 after filtering

    console.log(`Myriad: got ${markets.length} markets (filtered from ${all.length})`)

    return markets.map((m: any) => {
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
          probability = raw > 1 ? raw / 1e18 : raw
        }
      }

      const vol = m.volume24h || m.volume || null

      // Build URL from slug (includes UUID for uniqueness)
      const url = m.slug
        ? `https://myriad.markets/markets/${m.slug}`
        : m.id
        ? `https://myriad.markets/markets/${m.id}`
        : 'https://myriad.markets'

      return {
        id:       `myriad-${m.id}`,
        platform: 'myriad' as const,
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
            ? new Date(m.closingDate || m.expirationDate)
                .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : null,
        traders: m.liquidity
          ? Math.round(parseFloat(String(m.liquidity)))
          : null,
        category:
          m.category || m.topic || inferCategory(m.title || m.question || ''),
        url,
        status:     'active' as const,
        fetched_at: new Date().toISOString(),
      }
    })
  } catch (error: any) {
    console.error('Myriad fetch error:', error.message)
    return []
  }
}