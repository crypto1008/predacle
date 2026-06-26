// lib/odds-topics.ts
// -----------------------------------------------------------------------------
// Curated "What are the odds of X?" topics. Each topic synthesises MANY related
// markets into one aggregated answer that no single market page provides.
//
// Correctness rule (same discipline as lib/platforms.ts): topics are CURATED,
// not auto-generated. Each has an explicit match rule — include terms (OR'd) and
// exclude terms (to drop false positives) — so a page can't silently fill with
// irrelevant markets. Before trusting a topic, verify which markets it pulls via
// the ?debug=1 mode on /api/odds/[slug].
//
// `match.any`     : market.question must contain at least one of these (ilike).
// `match.exclude` : drop the market if its question contains any of these.
// `match.category`: optional category restriction (extra safety).
// -----------------------------------------------------------------------------

export interface OddsTopic {
  slug: string
  /** Question-shaped H1 / title. */
  question: string
  /** Short intro framing the topic. */
  intro: string
  /** SEO description. */
  description: string
  match: {
    any: string[]            // include if question contains ANY of these
    exclude?: string[]       // drop if question contains ANY of these
    category?: string        // optional category filter
  }
  keywords: string[]
}

export const ODDS_TOPICS: Record<string, OddsTopic> = {
  '2028-us-presidential-election': {
    slug: '2028-us-presidential-election',
    question: 'What are the odds for the 2028 US Presidential Election?',
    intro:
      'Prediction markets are already pricing the 2028 race. This page pulls together the live markets — party, nominee and candidate questions — so you can see where the money currently sits across platforms, updated continuously.',
    description:
      'Live 2028 US Presidential Election odds from prediction markets — party, nominee and candidate probabilities aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      any: ['2028 presidential', '2028 election', 'win the 2028', '2028 democratic nominee', '2028 republican nominee', 'president in 2028', '2028 us president'],
      exclude: ['2024', '2026 ', 'senate', 'house seat', 'governor', 'mayor'],
    },
    keywords: ['2028 election odds', '2028 presidential election prediction', 'who will win 2028', '2028 election betting odds'],
  },
}

export function getOddsTopic(slug: string): OddsTopic | null {
  return (ODDS_TOPICS as Record<string, OddsTopic>)[slug] || null
}

export const ODDS_TOPIC_SLUGS: string[] = Object.keys(ODDS_TOPICS)
