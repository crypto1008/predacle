// lib/odds-content.ts
// -----------------------------------------------------------------------------
// Server-side SEO content for /odds/[slug] pages.
//
// WHY: the odds pages render ~60 words of prose around a live table. Google has
// almost nothing to rank. This module supplies (a) an evergreen explainer that is
// genuinely the same on every page (a glossary, not padding), and (b) a per-topic
// FAQ generated from that topic's REAL field data, so each page carries unique,
// accurate, self-updating content no competitor can copy.
//
// Everything here is pure data/strings — rendered as SERVER JSX in page.tsx,
// below <OddsClient>, so it lands in the SSR HTML. OddsClient is 'use client'
// and is deliberately NOT touched.
//
// Correctness rules honoured (same as odds-data.ts):
//   * headline figures are best REAL-MONEY prices; Manifold is signal only
//   * never claim a favourite from a play-money price
//   * never invent a number — every figure below is read from the live data
// -----------------------------------------------------------------------------
import type { SimpleTopicOdds, TopicOdds, CandidateRow } from './odds-data'

export interface FaqItem {
  q: string
  a: string
}

const REAL_MONEY = ['Polymarket', 'Kalshi', 'Myriad', 'Limitless', 'Bookmaker']

/** Distinct platform labels present in a contender list, real-money first. */
function platformsIn(rows: CandidateRow[]): string[] {
  const seen = new Set<string>()
  for (const r of rows) for (const p of r.prices) seen.add(p.platform)
  const label = (p: string) => p.charAt(0).toUpperCase() + p.slice(1)
  const all = [...seen].map(label)
  const real = all.filter((p) => REAL_MONEY.includes(p))
  const play = all.filter((p) => !REAL_MONEY.includes(p))
  return [...real.sort(), ...play.sort()]
}

function pct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${Math.round(n)}%`
}

function listNames(rows: CandidateRow[], n: number): string {
  const names = rows.slice(0, n).map((r) => r.name)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Turn the topic question into a "who is the favourite ..." question.
 * Registry questions come in two shapes:
 *   "What are the odds to win the 2026 Men's US Open?"      -> "... to win ..."
 *   "What are the odds for the 2028 US Presidential Election?" -> "... for ..."
 * Strip the leading stem, keep whatever preposition follows, and fall back to a
 * generic phrasing if the question does not match the expected shape (never
 * emit a mangled sentence onto a live page).
 */
function favouriteQuestion(question: string): string {
  const m = question.match(/^What are the odds\s+(.*?)\??$/i)
  if (!m || !m[1]) return 'Who is the favourite?'
  return `Who is the favourite ${m[1].trim()}?`.replace(/\s+/g, ' ')
}

/**
 * Build a per-topic FAQ from live data. Returns [] when data is missing, so the
 * page degrades to no-FAQ rather than emitting empty or invented answers.
 */
export function buildOddsFaq(
  question: string,
  data: SimpleTopicOdds | TopicOdds | null,
): FaqItem[] {
  if (!data) return []
  // 'election' structure (TopicOdds) has `sections`, not `contenders`, so rows
  // comes back empty and we return [] — that page gets the explainer but no FAQ.
  // Deliberate: safe degradation over bolting on a second code path. ~20 of ~21
  // topics are 'simple'. Election pages can get bespoke treatment later.
  const simple = data as SimpleTopicOdds
  const rows: CandidateRow[] = Array.isArray(simple.contenders) ? simple.contenders : []
  if (rows.length === 0) return []

  const lead = rows[0]
  const threshold = data.threshold ?? 4
  const platforms = platformsIn(rows)
  const realCount = simple.realMoneyCount ?? 0
  const playCount = simple.playOnlyCount ?? 0
  const hidden = simple.hiddenCount ?? 0

  const faq: FaqItem[] = []

  // NOTE: we deliberately do NOT re-ask the page's own H1 question here. The
  // headline above the table already answers it, and duplicative Q&As are a
  // known FAQPage rich-result problem. The FAQ adds, it does not echo.

  // 2. Who is favourite (only from a real-money price).
  if (lead) {
    const src = lead.prices.find((p) => REAL_MONEY.includes(p.platform.charAt(0).toUpperCase() + p.platform.slice(1)))
    const where = src ? ` on ${src.platform.charAt(0).toUpperCase() + src.platform.slice(1)}` : ''
    faq.push({
      q: favouriteQuestion(question),
      a: `${lead.name} is the current favourite at around ${pct(lead.topProbability)}${where}. Prices move continuously as traders take positions, so this can change.`,
    })
  }

  // 3. Who else is in contention.
  if (rows.length >= 3) {
    faq.push({
      q: 'Who else is in contention?',
      a: `Besides ${lead.name}, the market is pricing ${listNames(rows.slice(1), 3)} as the next most likely${rows.length > 4 ? `, with ${rows.length} contenders priced above ${threshold}% in total` : ''}. ${hidden > 0 ? `A further ${hidden} long-shot${hidden === 1 ? '' : 's'} price below ${threshold}% and are summarised as a count rather than listed.` : ''}`.trim(),
    })
  }

  // 4. Which platforms — the cross-platform value prop.
  if (platforms.length > 0) {
    faq.push({
      q: 'Which prediction markets have odds on this?',
      a: `These odds are aggregated from ${platforms.join(', ')}. ${realCount > 0 ? `${realCount} contender${realCount === 1 ? '' : 's'} ${realCount === 1 ? 'is' : 'are'} priced on real-money markets.` : ''} ${playCount > 0 ? `${playCount} appear${playCount === 1 ? 's' : ''} only on play-money markets and ${playCount === 1 ? 'is' : 'are'} shown as forecasting signal, not as a price you can trade.` : ''}`.trim(),
    })
  }

  // 5. How to read the number.
  faq.push({
    q: 'What does the percentage actually mean?',
    a: `Each number is the market's implied probability of that outcome. A contract trading at ${pct(lead?.topProbability ?? 24)} means traders collectively price roughly a ${pct(lead?.topProbability ?? 24)} chance of it happening. It is a live price set by people risking money, not a forecast from Predacle.`,
  })

  // 6. Freshness.
  faq.push({
    q: 'How often do these odds update?',
    a: 'Market data refreshes roughly every 30 minutes, so the probabilities on this page track the live markets closely. Always open the source market before trading — order books move faster than any aggregator.',
  })

  return faq
}

/** Evergreen explainer sections. Identical on every odds page by design: this is
 *  a glossary, not filler. Written once, server-rendered everywhere. */
export const ODDS_EXPLAINER: { h: string; p: string }[] = [
  {
    h: 'How to read prediction market odds',
    p: 'A prediction market contract pays out $1 if an outcome happens and nothing if it does not. So its price is its probability: a contract trading at 24 cents means the market prices roughly a 24% chance. Unlike a bookmaker\u2019s line, nobody sets these numbers \u2014 they are discovered by traders buying and selling, and they move the moment the crowd changes its mind.',
  },
  {
    h: 'Why platforms disagree on the same event',
    p: 'The same question can trade at different prices on Polymarket, Kalshi, Myriad and Limitless. Each venue has its own traders, its own liquidity and its own fees, so prices drift apart \u2014 particularly on thin markets where a single large order moves the price. Predacle shows the best real-money price across platforms, and a gap between venues is sometimes a genuine signal and sometimes just thin liquidity on one side.',
  },
  {
    h: 'Why some contenders are hidden',
    p: 'Fields like this often carry dozens of long-shots priced under a few percent. Listing every one buries the contest, so contenders below the threshold are summarised as a count instead. Nothing is excluded from the underlying data \u2014 only from the visible table.',
  },
  {
    h: 'Real money versus play money',
    p: 'Polymarket, Kalshi, Myriad, Limitless and Bookmaker are real-money venues: their prices reflect capital at risk. Manifold uses play-money (Mana, which has not been convertible since March 2025), so its prices are shown as forecasting signal only and are never used as a headline probability or to rank a field. When a contender appears only on Manifold, that is stated explicitly.',
  },
]
