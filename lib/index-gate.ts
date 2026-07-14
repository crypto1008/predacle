// lib/index-gate.ts
// -----------------------------------------------------------------------------
// Which market pages deserve to be in Google's index.
//
// THE PROBLEM (Search Console, 2026-07-14):
//   Indexed: 42.   "Discovered - currently not indexed": 6,929.
// The sitemap offers ~7,000 market URLs. Google sampled them, found ephemeral
// near-duplicates (Bitcoin-at-5pm, resolved sports props, Fed-outcome sets), and
// DEFERRED THE CRAWL on the rest. The curated /odds pages are queued behind them.
//
// THE INSIGHT: the churn IS the filter. A market that resolves before Google can
// realistically crawl it can never be usefully indexed. Offering it is pure waste.
//
// Measured against live data (100-market sample):
//   median volume $6,328 | 25% under $2,017 | 28% close within 7 days
//   gate at $50k + 7d  ->  ~15% survive  ->  ~1,050 of 7,000
//
// Pages stay LIVE and `follow` — users see them, link equity still flows to the
// odds pages. They simply stop asking to rank.
// -----------------------------------------------------------------------------

/** Minimum real volume for a market page to be worth ranking. */
export const INDEX_MIN_VOLUME = 50_000

/** A market resolving sooner than this is stale before Google can crawl it. */
export const INDEX_MIN_DAYS_TO_RESOLVE = 7

/** Price-ladder rung, e.g. "Bitcoin price on Jun 12? — $63,500 or above". */
export function isLadderRung(question?: string | null): boolean {
  if (!question) return false
  return /[—–-]\s*\$\s*[\d,]+(?:\.\d+)?\s*(?:or|and)\s+(?:above|below|higher|lower|more|less)\b/i.test(question)
}

/**
 * Kalshi encodes multi-outcome families in the ID:
 *   kalshi-KXFEDDECISION-26JUL-H0 / -H25 / -C25 ...  (one Fed decision, 5 outcomes)
 *   kalshi-KXBTC-26JUL1717-<range>                    (14 price ranges)
 * Indexing ONE outcome of a set while hiding its siblings serves nobody — the
 * /odds pages are the correct surface for these.
 *
 * Requires >=4 hyphen segments. Polymarket/Manifold IDs are opaque hashes
 * (polymarket-0x8ac...), carry no family info, and are deliberately NOT grouped:
 * naive splitting collapsed every Polymarket market into one fake 145-member
 * "family" and hid the standalone questions we want to keep.
 */
export function isKalshiOutcomeSet(id?: string | null): boolean {
  if (!id || !id.startsWith('kalshi-')) return false
  return id.split('-').length >= 4
}

export interface IndexGateInput {
  id: string
  question: string | null
  status: string | null
  volume: number | null
  end_date: string | null
}

export interface IndexGateResult {
  index: boolean
  reason: string
}

/** The single source of truth. Used by BOTH sitemap.ts and markets/[id] robots. */
export function shouldIndexMarket(m: IndexGateInput): IndexGateResult {
  // Resolved/closed markets: archived, not answers to a live question. Google
  // finds these by crawling /resolved, NOT via the sitemap — which is why
  // "Resolved: Malik Tillman: 2+ shots on target" is in the index today. The
  // sitemap alone cannot fix them; only a robots noindex can.
  if ((m.status || '').toLowerCase() !== 'active') {
    return { index: false, reason: 'not active' }
  }
  if (isLadderRung(m.question)) {
    return { index: false, reason: 'ladder rung' }
  }
  if (isKalshiOutcomeSet(m.id)) {
    return { index: false, reason: 'kalshi outcome set' }
  }
  const vol = m.volume ?? 0
  if (vol < INDEX_MIN_VOLUME) {
    return { index: false, reason: `volume below ${INDEX_MIN_VOLUME}` }
  }
  if (!m.end_date) {
    return { index: false, reason: 'no end date' }
  }
  const days = Math.ceil(
    (new Date(m.end_date).getTime() - Date.now()) / 86_400_000,
  )
  if (!Number.isFinite(days) || days < INDEX_MIN_DAYS_TO_RESOLVE) {
    return { index: false, reason: `closes in ${days}d` }
  }
  return { index: true, reason: 'index' }
}

// -----------------------------------------------------------------------------
// Canonical consolidation.
//
// Some markets are near-duplicate rungs of a set that now has a BETTER home on a
// curated /odds page. Google will never rank 21 "Will Bitcoin reach $X by Dec 31"
// pages — it picks one and treats the rest as duplicates. Rather than throw that
// signal away with a noindex, point them all at the odds page so it accumulates.
//
// Deliberately NOT noindex: these have real volume and real search demand. We
// want the signal, just consolidated onto one strong URL.
// -----------------------------------------------------------------------------

/** Returns an /odds slug to canonicalise to, or null to keep the page's own URL. */
export function canonicalOddsSlug(question?: string | null): string | null {
  if (!question) return null
  const q = question.toLowerCase()

  // Bitcoin price ladder, end of 2026. Upside rungs -> the price page.
  //   "Will Bitcoin reach $90,000 by December 31, 2026?"
  //   "Will Bitcoin hit $150k by December 31, 2026?"
  if (/^will bitcoin (reach|hit) \$[\d,]+\s*[kmb]?\s+by december 31, 2026/.test(q)) {
    return 'bitcoin-price-2026'
  }
  // Downside rungs -> the crash page.
  //   "Will Bitcoin dip to $55,000 by December 31, 2026?"
  if (/^will bitcoin dip to \$[\d,]+\s*[kmb]?\s+by december 31, 2026/.test(q)) {
    return 'bitcoin-crash-2026'
  }
  return null
}
