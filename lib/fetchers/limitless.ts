import { inferCategory } from '../utils/category'
import { Market } from '../types'

const MIN_EXPIRY_HOURS = 24 // only keep markets expiring 24+ hours from now

async function fetchPage(page: number): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api.limitless.exchange/markets/active?page=${page}`,
      { headers: { 'Accept': 'application/json' }, cache: 'no-store' }
    )
    if (!res.ok) return []
    const json = await res.json()
    return json.data || []
  } catch { return [] }
}

export async function fetchLimitless(): Promise<Market[]> {
  try {
    console.log('Limitless: fetching pages...')

    // Fetch up to 10 pages to find longer-term markets
    const pages = await Promise.all(
      Array.from({ length: 10 }, (_, i) => fetchPage(i + 1))
    )

    const all: any[] = pages.flat()
    console.log(`Limitless: ${all.length} total markets across all pages`)

    const minExpiry = Date.now() + MIN_EXPIRY_HOURS * 60 * 60 * 1000

    const markets = all.filter((m: any) => {
      if (!m.title) return false

      const title = (m.title || '').toLowerCase().trim()
      const cats  = (m.categories || []).map((c: string) => c.toLowerCase())
      const tags  = (m.tags || []).map((t: string) => t.toLowerCase())

      // Skip short-term category markets
      if (cats.some((c: string) => c.includes('minut') || c.includes('hourly') || c === '5 min' || c === '1h' || c === '4h')) return false
      if (tags.some((t: string) => t.includes('minut') || t.includes('recurring') || t === 'lumy')) return false

      // Skip short-term title patterns
      if (title.includes('up or down')) return false
      if (title.includes('hourly')) return false
      if (/\d+ min/.test(title)) return false
      if (/price on \w+ \d+,/.test(title)) return false // "ETH price on May 30,"

      // Must expire more than 24 hours from now
      const expTs = m.expirationTimestamp || null
      if (!expTs) return false
      if (expTs < minExpiry) return false

      // Skip very short titles
      if (title.length < 10) return false

      return true
    })

    console.log(`Limitless: ${markets.length} long-term markets found`)

    // Deduplicate by id
    const seen = new Set<string>()
    const deduped = markets.filter((m: any) => {
      if (seen.has(String(m.id))) return false
      seen.add(String(m.id))
      return true
    })

    return deduped.map((m: any) => {
      // Probability
      let probability: number | null = null
      if (Array.isArray(m.prices) && m.prices.length > 0) {
        const raw = m.prices[0]
        const normalized = typeof raw === 'number'
          ? raw > 1 ? raw / 100 : raw
          : null
        if (normalized !== null && normalized > 0 && normalized < 1) {
          probability = Math.min(0.9999, Math.max(0.0001, normalized))
        }
      }

      // Volume
      const decimals = m.collateralToken?.decimals ?? 6
      const volRaw   = parseFloat(String(m.volume || '0'))
      const vol      = volRaw > 0 ? volRaw / Math.pow(10, decimals) : null

      // Category
      const assetType = m.priceOracleMetadata?.assetType || ''
      const cats      = (m.categories || []).map((c: string) => c.toLowerCase())
      const category  = (() => {
        if (assetType === 'CRYPTO' || cats.includes('crypto'))      return 'crypto'
        if (cats.includes('sports')  || cats.includes('sport'))     return 'sports'
        if (cats.includes('politics')|| cats.includes('election'))  return 'politics'
        if (cats.includes('finance') || cats.includes('economics')) return 'economics'
        if (cats.includes('esports') || cats.includes('gaming'))    return 'tech'
        if (cats.includes('football')|| cats.includes('soccer') || cats.includes('fifa')) return 'sports'
        return inferCategory(String(m.title || ''))
      })()

      const expiry  = new Date(m.expirationTimestamp)
      const url     = m.slug
        ? `https://limitless.exchange/markets/${m.slug}`
        : 'https://limitless.exchange'

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
        end_date:       expiry.toISOString().split('T')[0],
        end_date_label: expiry.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        traders:            null,
        category,
        url,
        status:             'active' as const,
        fetched_at:         new Date().toISOString(),
        probability_change: null,
        image_url:          m.imageUrl || m.ogImageURI || null,
      }
    })
  } catch (error: any) {
    console.error('Limitless error:', error.message)
    return []
  }
}