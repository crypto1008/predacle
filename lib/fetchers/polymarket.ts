import { inferCategory } from '../utils/category'
import { Market } from '../types'

export async function fetchPolymarket(): Promise<Market[]> {
  try {
    const response = await fetch(
      'https://gamma-api.polymarket.com/events?active=true&closed=false&limit=200&order=volume24hr&ascending=false',
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
        // ── Prop bet filter ──────────────────────────────────────────
        // Skip in-game prop bets: "Game 1: Odd/Even Kills", "Game 2: First Baron" etc.
        if (/^Game \d+:/i.test(m.question)) continue
        // Skip O/U lines: "Points O/U 24.5", "Rebounds O/U 8.5"
        if (/\bO\/U\b/i.test(m.question)) continue
        if (/\b(handicap|moneyline|odd\/even|completed match|to score first|first (blood|baron|tower|inning)|map \d+|set \d+ winner|game \d+ winner|total (points|runs|maps|kills|games))\b/i.test(m.question)) continue
        // Skip dust markets under $50 volume (junk markets with no real activity)
        const mVol = parseFloat(m.volume || m.volumeClob || 0)
        if (mVol > 0 && mVol < 50) continue
        // ────────────────────────────────────────────────────────────
        // Probability: prefer the live order-book midpoint, but only when the book
        // is liquid (tight spread). Not-yet-traded future markets (e.g. team-vs-team
        // games created early) carry stale, extreme outcomePrices (~0.99) that must
        // NOT be trusted — that was the source of the bogus 99%/100% values.
        let probability: number | null = null
        const bid = parseFloat(m.bestBid)
        const ask = parseFloat(m.bestAsk)
        if (Number.isFinite(bid) && Number.isFinite(ask) && ask >= bid && bid >= 0 && ask <= 1) {
          if (ask - bid <= 0.15) probability = (bid + ask) / 2          // liquid → trust midpoint
        }
        if (probability === null) {
          try {
            const p   = parseFloat(JSON.parse(m.outcomePrices || '[]')[0])
            const liq = parseFloat(m.liquidity ?? m.liquidityClob ?? m.liquidityNum ?? '0')
            if (p > 0 && p < 1 && liq >= 500) probability = p           // trust price only with real liquidity
          } catch {}
        }
        // else: leave null — unknown/illiquid markets are excluded instead of faking 99%
        const vol = mVol > 0 ? mVol : eventVol > 0 ? eventVol / Math.max(evMarkets.length, 1) : null
        const probability_change = typeof m.oneMonthPriceChange === 'number'
          ? Math.round(m.oneMonthPriceChange * 1000) / 1000
          : null
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
          traders:           eventTraders,
          category: (m.category && m.category !== 'All' && m.category !== 'all')
            ? m.category
            : inferCategory(m.question || ev.title || ''),
          url:               eventUrl,
          status:            'active' as const,
          fetched_at:        new Date().toISOString(),
          probability_change,
          image_url,
        })
      }
      // Event with no nested markets
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
    }).slice(0, 500)
    console.log(`Polymarket: ${deduped.length} markets after prop bet filter`)
    return deduped
  } catch (error: any) {
    console.error('Polymarket fetch error:', error.message)
    return []
  }
}