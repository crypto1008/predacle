import { supabaseAdmin } from '@/lib/supabase'

// Category calibration — the question this page answers:
// "When prediction markets in category X priced something at P%, how often did
//  it actually happen?"
//
// For every resolved BINARY market we have the true outcome (resolved_outcome
// YES/NO) and the last pre-resolution price (final_probability = P(YES)). Same
// scoring math as the platform leaderboard, but sliced by category:
//   - brier            mean (p - y)^2          lower = sharper
//   - accuracy         P(favoured side won)    directional hit-rate
//   - calibrationError ECE: how far "60%" is from actually hitting 60%
//   - curve            10 buckets of predicted vs actual, for the chart
// SCALAR / UNCLEAR resolutions are non-binary and excluded.
//
// Scope: only categories with a confident, well-populated history are shown.
// Thin categories (economics, tech) are omitted rather than reported noisily.

const MIN_SAMPLE = 100                                   // floor before a category is shown
const SCOPE = ['sports', 'politics'] as const            // genuine event-forecasting categories
// Crypto is omitted for now. On these platforms resolved crypto markets are
// ~99% automated short-term price targets ("Will Bitcoin reach $X on June 12?")
// that settle at 1% or 99%; under ~10 genuine forecasting markets have resolved,
// far below the sample floor. Crypto rejoins automatically once enough accrue.
const NB = 10                                           // calibration buckets (deciles)
const EPS = 1e-6

const CRYPTO_ASSET = /\b(bitcoin|btc|ethereum|eth|ether|solana|sol|xrp|ripple|dogecoin|doge|cardano|ada|bnb|litecoin|ltc|avalanche|avax|polkadot|dot|chainlink|link|toncoin|ton|tron|trx|shiba|pepe)\b/i

// True for automated short-term crypto price markets we want to exclude.
function isShortTermCryptoPrice(question: string): boolean {
  const q = String(question || '')
  const hasIntraday = /\bat\s+\d{1,2}(:\d{2})?\s?(am|pm)\b/i.test(q) || /\b(edt|est|utc|gmt)\b/i.test(q)
  const hasStrike =
    /\bor\s+(above|below|higher|lower|more|less)\b/i.test(q) ||
    /[\u2265\u2264]\s?\$/.test(q) ||           // ≥ $ / ≤ $
    /(>=|<=)\s?\$/.test(q)
  const hasDirection = /\b(up or down|higher or lower|above or below)\b/i.test(q)
  const isCryptoPrice = CRYPTO_ASSET.test(q) && /\bprice\b/i.test(q)

  // Short-term price targets, e.g. "Will Bitcoin reach $65,000 on June 13?" or
  // "Will Bitcoin dip to $62,500 in June?". Caught only with a near-term horizon
  // (a specific day, or a bare month); long-horizon markets ("by end of 2026",
  // "in 2027") are NOT caught, so genuine forecasts survive.
  const priceVerb = /\b(reach|reaches|dip to|dips to|hit|hits|fall to|falls to|rise to|rises to|drop to|drops to|climb to|climbs to)\b/i.test(q)
  const hasDollar = /\$\s?[\d,]+/.test(q)
  const nearTermDay = /\bon\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i.test(q)
  const bareMonth = /\bin\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(q)
  const longHorizon =
    /\b(by end of|end of|by)\s+\d{4}\b/i.test(q) ||
    /\bin\s+\d{4}\b/i.test(q) ||
    /\bby\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/i.test(q)
  const shortTermPriceTarget =
    CRYPTO_ASSET.test(q) && priceVerb && hasDollar && (nearTermDay || bareMonth) && !longHorizon

  return (isCryptoPrice && (hasIntraday || hasStrike)) || (hasDirection && CRYPTO_ASSET.test(q)) || shortTermPriceTarget
}

interface Row { category: string; p: number; y: number }

function score(arr: Row[]) {
  const n = arr.length
  let brier = 0, logloss = 0, hits = 0, sumP = 0, sumY = 0
  const buckets = Array.from({ length: NB }, () => ({ sumP: 0, sumY: 0, n: 0 }))

  for (const { p, y } of arr) {
    brier += (p - y) ** 2
    const pc = Math.min(1 - EPS, Math.max(EPS, p))
    logloss += -(y * Math.log(pc) + (1 - y) * Math.log(1 - pc))
    if ((p >= 0.5 ? 1 : 0) === y) hits++
    sumP += p; sumY += y
    let bi = Math.floor(p * NB)
    if (bi >= NB) bi = NB - 1
    if (bi < 0) bi = 0
    buckets[bi].sumP += p; buckets[bi].sumY += y; buckets[bi].n++
  }

  let ece = 0
  const curve = buckets.map((b, i) => {
    const predicted = b.n ? b.sumP / b.n : null
    const actual = b.n ? b.sumY / b.n : null
    if (b.n) ece += Math.abs(predicted! - actual!) * (b.n / n)
    return {
      lo: i / NB,
      hi: (i + 1) / NB,
      n: b.n,
      predicted: predicted != null ? +predicted.toFixed(4) : null,
      actual: actual != null ? +actual.toFixed(4) : null,
    }
  })

  return {
    n,
    brier: +(brier / n).toFixed(4),
    logloss: +(logloss / n).toFixed(4),
    accuracy: +(hits / n).toFixed(4),
    calibrationError: +ece.toFixed(4),
    avgPred: +(sumP / n).toFixed(4),
    yesRate: +(sumY / n).toFixed(4),
    curve,
  }
}

export interface CalibrationResult {
  categories: Array<Record<string, unknown>>
  overall: Record<string, unknown> | null
  totalCalibratable: number
  excludedLadders: number
  minSample: number
  method: string
  generatedAt: string
}

export async function getCalibration(): Promise<CalibrationResult> {
  try {
    // Price-ladder rungs (e.g. Kalshi/Limitless hourly "ETH $X or above") are
    // near-deterministic and dominate crypto, distorting calibration. They are
    // marked with ladder_key on the markets table; resolved markets persist
    // there, so we pull the ladder id set and exclude those resolutions.
    const ladderIds = new Set<string>()
    {
      const PAGE = 1000
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabaseAdmin
          .from('markets')
          .select('id')
          .not('ladder_key', 'is', null)
          .range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        if (!data || data.length === 0) break
        for (const r of data as any[]) ladderIds.add(r.id)
        if (data.length < PAGE) break
      }
    }

    const rows: Row[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('market_resolutions')
        .select('id, category, question, final_probability, resolved_outcome')
        .in('resolved_outcome', ['YES', 'NO'])
        .not('final_probability', 'is', null)
        .range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break
      for (const r of data as any[]) {
        if (ladderIds.has(r.id)) continue                 // skip tagged price-ladder rungs
        const cat = (r.category || 'other').toLowerCase()
        if (cat === 'crypto' && isShortTermCryptoPrice(r.question || '')) continue  // skip automated short-term crypto
        const p = Number(r.final_probability)
        if (!isFinite(p)) continue
        rows.push({ category: cat, p, y: r.resolved_outcome === 'YES' ? 1 : 0 })
      }
      if (data.length < PAGE) break
    }

    const byCat = new Map<string, Row[]>()
    for (const r of rows) {
      if (!byCat.has(r.category)) byCat.set(r.category, [])
      byCat.get(r.category)!.push(r)
    }

    // Only in-scope categories that clear the sample floor, ordered by SCOPE.
    const categories = SCOPE
      .filter((c) => (byCat.get(c)?.length || 0) >= MIN_SAMPLE)
      .map((c) => ({ category: c, ...score(byCat.get(c)!) }))

    // Headline aggregate over exactly what the page shows (not the raw pool),
    // so it can't be skewed by categories we deliberately exclude.
    const shownRows: Row[] = []
    for (const c of categories) shownRows.push(...byCat.get(c.category)!)
    const overall = shownRows.length >= MIN_SAMPLE ? score(shownRows) : null

    return {
      categories,
      overall,
      totalCalibratable: shownRows.length,
      excludedLadders: ladderIds.size,
      minSample: MIN_SAMPLE,
      method:
        'final_probability (last pre-resolution price) vs resolved_outcome; binary markets only (SCALAR/UNCLEAR excluded); shown for categories with enough genuine forecasting history; calibration error = mean gap between priced probability and observed frequency across deciles',
      generatedAt: new Date().toISOString(),
    }
  } catch (error: any) {
    throw new Error(error?.message || 'Failed to build calibration')
  }
}
