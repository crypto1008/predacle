import { inferCategory } from '../utils/category'
import { Market } from '../types'

export async function fetchMyriad(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://api-v2.myriadprotocol.com/markets?state=open&sort=volume_24h&limit=100',
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
    const all  = json.data || json.markets || json || []

    if (!Array.isArray(all) || all.length === 0) {
      console.log('Myriad: no markets returned')
      return []
    }

    // Debug: log all available fields from first market
    if (all.length > 0) {
      console.log('Myriad fields:', Object.keys(all[0]).join(', '))
      console.log('Myriad volume sample:', JSON.stringify({
        volume:        all[0].volume,
        volume24h:     all[0].volume24h,
        volumeUsd:     all[0].volumeUsd,
        totalVolume:   all[0].totalVolume,
        liquidity:     all[0].liquidity,
        bettors:       all[0].bettors,
        traders:       all[0].traders,
        participants:  all[0].participants,
        uniqueTraders: all[0].uniqueTraders,
      }))
    }

    // Filter out short-term candle markets (expire in minutes)
    const markets = all.filter((m: any) => {
      const title = (m.title || m.question || '').toLowerCase()
      if (title.includes('candle'))  return false
      if (title.includes('candles')) return false
      if (!m.title && !m.question)   return false
      return true
    }).slice(0, 100)

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
          // Prices in 1e18 format (500000000000000000 = 0.50)
          probability = raw > 1 ? raw / 1e18 : raw
        }
      }

      // Use total volume first, fall back to 24h volume
      const volRaw = m.volume || m.volume24h || m.volumeUsd || m.totalVolume || null
      const vol    = volRaw ? parseFloat(String(volRaw)) : null

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
        volume: vol,
        volume_label: vol && vol > 0
          ? vol >= 1_000_000
            ? `$${(vol / 1_000_000).toFixed(1)}M`
            : `$${Math.round(vol).toLocaleString()}`
          : null,
        end_date: m.closingDate || m.expirationDate || null,
        end_date_label:
          m.closingDate || m.expirationDate
            ? new Date(m.closingDate || m.expirationDate)
                .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : null,
        // Use actual trader count fields, not liquidity
        traders: m.bettors || m.traders || m.participants || m.uniqueTraders || null,
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