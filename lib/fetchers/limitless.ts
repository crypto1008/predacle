import { inferCategory } from '../utils/category'
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

    const json    = await response.json()
    const all: any[] = json.data || []
    console.log(`Limitless: ${all.length} markets received`)

    // Filter out very short-term markets (5-min, minutely)
    const markets = all.filter((m: any) => {
      if (!m.title) return false
      const cats = (m.categories || []).map((c: string) => c.toLowerCase())
      const tags  = (m.tags || []).map((t: string) => t.toLowerCase())
      // Skip 5-minute and minutely markets
      if (cats.some((c: string) => c.includes('minut'))) return false
      if (tags.some((t: string) => t.includes('minut'))) return false
      if (cats.includes('5 min')) return false
      return true
    })

    console.log(`Limitless: ${markets.length} after filtering short-term`)

    return markets.map((m: any) => {
      // Probability from prices array
      let probability: number | null = null
      if (Array.isArray(m.prices) && m.prices.length > 0) {
        const raw        = m.prices[0]
        const normalized = typeof raw === 'number'
          ? raw > 1 ? raw / 100 : raw
          : null
        if (normalized !== null && normalized > 0 && normalized < 1) {
          probability = Math.min(0.9999, Math.max(0.0001, normalized))
        }
      }

      // Volume
      const volRaw = parseFloat(String(m.volume || '0'))
      const vol    = volRaw > 0 ? volRaw : null

      // Category from API data
      const assetType = m.priceOracleMetadata?.assetType || ''
      const cats      = (m.categories || []).map((c: string) => c.toLowerCase())
      const category  = (() => {
        if (assetType === 'CRYPTO' || cats.includes('crypto'))    return 'crypto'
        if (cats.includes('sports') || cats.includes('sport'))    return 'sports'
        if (cats.includes('politics') || cats.includes('election')) return 'politics'
        if (cats.includes('economics') || cats.includes('finance')) return 'economics'
        return inferCategory(String(m.title || ''))
      })()

      // End date — skip if expires within 2 hours (too short-term)
      const expTs  = m.expirationTimestamp || null
      const expiry = expTs ? new Date(expTs) : null
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
      const endDate = expiry && expiry > twoHoursFromNow ? expiry : null

      // URL — prefer slug, fall back to id
      const url = m.slug
        ? `https://limitless.exchange/markets/${m.slug}`
        : `https://limitless.exchange/markets/${m.id}`

      return {
        id:       `limitless-${m.id}`,
        platform: 'limitless' as const,
        question: String(m.title),
        probability,
        volume: vol,
        volume_label: vol && vol > 0
          ? vol >= 1_000_000
            ? `$${(vol / 1_000_000).toFixed(1)}M`
            : `$${Math.round(vol).toLocaleString()}`
          : null,
        end_date: endDate
          ? endDate.toISOString().split('T')[0]
          : null,
        end_date_label: endDate
          ? endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          : null,
        traders:    null, // not available in Limitless API
        category,
        url,
        status:     'active' as const,
        fetched_at: new Date().toISOString(),
      }
    })
  } catch (error: any) {
    console.error('Limitless error:', error.message)
    return []
  }
}