import { inferCategory } from '../utils/category'
import { Market } from '../types'

export async function fetchMyriad(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://api-v2.myriadprotocol.com/markets?state=open&sort=volume_24h&limit=100',
      {
        headers: {
          'User-Agent':   'Predacle/1.0 (https://predacle.com)',
          'Accept':       'application/json',
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

    const markets = all.filter((m: any) => {
      const title = (m.title || m.question || '').toLowerCase().trim()

      // Skip if no title
      if (!m.title && !m.question) return false

      // Skip candle/chart markets
      if (title.includes('candle') || title.includes('candles')) return false

      // Skip generic "up or down" trading games
      if (title === 'up or down?' || title === 'up or down') return false
      if (title.includes('up or down')) return false

      // Skip vague multi-choice markets with no close date
      if (!m.closingDate && !m.expirationDate && !m.expiresAt && title.length < 20) return false

      // Skip markets with absurd volume (> $500M is clearly wrong data)
      const vol = parseFloat(String(m.volume || m.volume24h || '0'))
      if (vol > 500_000_000) return false

      // Skip markets asking "which has most upside" without a close date (non-binary vague)
      if (title.includes('upside') && !m.closingDate && !m.expirationDate) return false

      // Skip very short titles that are likely junk
      if (title.length < 10) return false

      // ← ADD THIS: skip already-expired markets
      const rawDate = m.closingDate || m.expirationDate || m.expiresAt || null
      if (rawDate && new Date(rawDate) < new Date()) return false

      const volCheck = parseFloat(String(m.volume || m.volume24h || '0'))
      if (volCheck > 500_000_000) return false

      return true
    }).slice(0, 100)

    console.log(`Myriad: got ${markets.length} markets (filtered from ${all.length})`)

    return markets.map((m: any) => {
      let probability: number | null = null

      if (m.outcomes && Array.isArray(m.outcomes) && m.outcomes.length > 0) {
        if (m.outcomes.length === 2) {
          const yesOutcome = m.outcomes.find(
            (o: any) =>
              o.title?.toLowerCase() === 'yes' ||
              o.label?.toLowerCase() === 'yes' ||
              o.id === 0
          )
          if (yesOutcome?.price !== undefined) {
            const raw = parseFloat(yesOutcome.price)
            probability = raw > 1 ? raw / 1e18 : raw
          } else {
            const raw = parseFloat(m.outcomes[0]?.price || '0')
            probability = raw > 0 && raw <= 1 ? raw : null
          }
        } else {
          const prices = m.outcomes
            .map((o: any) => parseFloat(o.price || '0'))
            .filter((v: number) => v > 0 && v <= 1)
          if (prices.length > 0) probability = Math.max(...prices)
        }
      }

      const volRaw  = m.volume || m.volume24h || null
      const vol     = volRaw ? parseFloat(String(volRaw)) : null
      const traders = m.users || m.bettors || m.traders || m.participants || null

      const rawDate = m.closingDate || m.expirationDate || m.expiresAt || null
      const endDate = (() => {
        if (!rawDate) return null
        if (new Date(rawDate).getFullYear() >= 2099) return null
        return rawDate
      })()

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
        end_date: endDate
          ? new Date(endDate).toISOString().split('T')[0]
          : null,
        end_date_label: endDate
          ? new Date(endDate).toLocaleDateString('en-US', {
              month: 'short', year: 'numeric',
            })
          : null,
        traders: traders ? Math.round(parseFloat(String(traders))) : null,
        category: (() => {
          const topics = m.topics || []
          if (topics.includes('Politics') || topics.includes('Elections')) return 'politics'
          if (topics.includes('Crypto')   || topics.includes('DeFi'))      return 'crypto'
          if (topics.includes('Sports'))                                    return 'sports'
          if (topics.includes('Economics')|| topics.includes('Finance'))    return 'economics'
          if (topics.includes('Science')  || topics.includes('Tech'))       return 'tech'
          return m.category || m.topic || inferCategory(m.title || m.question || '')
        })(),
        url,
        status:             'active' as const,
        fetched_at:         new Date().toISOString(),
        probability_change: null,
        image_url:          m.imageUrl || m.image || null,
      }
    })
  } catch (error: any) {
    console.error('Myriad fetch error:', error.message)
    return []
  }
}