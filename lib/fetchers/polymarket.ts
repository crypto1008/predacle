import { inferCategory } from '../utils/category'
import { Market } from '../types'

export async function fetchPolymarket(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://gamma-api.polymarket.com/events?active=true&closed=false&limit=100&order=volume24hr&ascending=false',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        cache: 'no-store',
      }
    )

    console.log(`Polymarket events status: ${response.status}`)
    if (!response.ok) throw new Error(`Polymarket error: ${response.status}`)

    const events = await response.json()
    const list   = Array.isArray(events) ? events : events.data || []
    console.log(`Polymarket events: ${list.length} events`)

    const markets: Market[] = []

    for (const ev of list) {
      if (!ev.active || ev.closed || ev.archived) continue

      const eventSlug    = ev.slug || ev.ticker || ''
      const eventUrl     = eventSlug
        ? `https://polymarket.com/event/${eventSlug}`
        : 'https://polymarket.com'
      const eventTraders = ev.uniqueBettors ? parseInt(String(ev.uniqueBettors)) : null
      const eventVol     = parseFloat(ev.volume || ev.volumeClob || 0)

      const evMarkets: any[] = ev.markets || []

      for (const m of evMarkets) {
        if (!m.question || !m.active || m.closed) continue

        let probability: number | null = null
        try {
          const prices = JSON.parse(m.outcomePrices || '[]')
          const p      = parseFloat(prices[0])
          if (p > 0 && p < 1) probability = p
        } catch {}
        if (probability === null && m.bestBid) {
          const p = parseFloat(m.bestBid)
          if (p > 0 && p < 1) probability = p
        }

        const mVol = parseFloat(m.volume || m.volumeClob || 0)
        const vol  = mVol > 0 ? mVol : eventVol > 0 ? eventVol / Math.max(evMarkets.length, 1) : null

        // Probability trend from oneMonthPriceChange
        const probability_change = typeof m.oneMonthPriceChange === 'number'
          ? Math.round(m.oneMonthPriceChange * 1000) / 1000
          : null

        // Market image from icon field
        const image_url = m.icon || m.image || ev.icon || ev.image || null

        markets.push({
          id:       `polymarket-${m.conditionId || m.id}`,
          platform: 'polymarket' as const,
          question: m.question,
          probability,
          volume:   vol || null,
          volume_label: vol && vol > 0
            ? vol >= 1_000_000
              ? `$${(vol / 1_000_000).toFixed(1)}M`
              : `$${Math.round(vol).toLocaleString()}`
            : null,
          end_date: m.endDate || ev.endDate || null,
          end_date_label: (m.endDate || ev.endDate)
            ? new Date(m.endDate || ev.endDate).toLocaleDateString('en-US', {
                month: 'short', year: 'numeric',
              })
            : null,
          traders: eventTraders,
          category: (m.category && m.category !== 'All' && m.category !== 'all')
            ? m.category
            : inferCategory(m.question || ev.title || ''),
          url: eventUrl,
          status:            'active' as const,
          fetched_at:        new Date().toISOString(),
          probability_change,
          image_url,
        })
      }

      if (evMarkets.length === 0 && ev.title) {
        markets.push({
          id:       `polymarket-ev-${ev.id}`,
          platform: 'polymarket' as const,
          question: ev.title,
          probability: null,
          volume:   eventVol || null,
          volume_label: eventVol > 0
            ? eventVol >= 1_000_000
              ? `$${(eventVol / 1_000_000).toFixed(1)}M`
              : `$${Math.round(eventVol).toLocaleString()}`
            : null,
          end_date:       ev.endDate ? new Date(ev.endDate).toISOString().split('T')[0] : null,
          end_date_label: ev.endDate
            ? new Date(ev.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : null,
          traders:           eventTraders,
          category:          inferCategory(ev.title || ''),
          url:               eventUrl,
          status:            'active' as const,
          fetched_at:        new Date().toISOString(),
          probability_change: null,
          image_url:          ev.icon || ev.image || null,
        })
      }
    }

    const seen    = new Set<string>()
    const deduped = markets.filter(m => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    }).slice(0, 100)

    console.log(`Polymarket: ${deduped.length} markets, ${deduped.filter(m => m.probability_change !== null).length} with trend`)
    return deduped

  } catch (error: any) {
    console.error('Polymarket fetch error:', error.message)
    return []
  }
}