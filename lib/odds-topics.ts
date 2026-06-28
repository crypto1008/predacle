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
  /**
   * Page structure. 'election' uses party/nomination/election sections (bespoke).
   * 'simple' renders one ranked list of contenders (teams, candidates, etc.).
   * Defaults to 'election' when omitted for backwards-compatibility.
   */
  structure?: 'election' | 'simple'
  match: {
    any: string[]            // include if question contains ANY of these
    exclude?: string[]       // drop if question contains ANY of these
    category?: string        // optional category filter
  }
  keywords: string[]
}

export const ODDS_TOPICS: Record<string, OddsTopic> = {
  '2026-world-cup-top-goalscorer': {
    slug: '2026-world-cup-top-goalscorer',
    question: 'What are the odds to be the 2026 World Cup top goalscorer?',
    structure: 'simple',
    intro:
      'The Golden Boot goes to the top scorer of the 2026 FIFA World Cup. This page pulls together the live player markets across platforms, so you can see which players the money favours to finish as the tournament\u2019s leading goalscorer — updated continuously.',
    description:
      'Live 2026 World Cup Golden Boot odds from prediction markets — every contender\u2019s probability to finish as top goalscorer, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      any: ['top goalscorer', 'top scorer', 'golden boot'],
      exclude: [' vs ', ' vs. ', 'group ', 'assist', 'clean sheet', 'golden glove'],
    },
    keywords: ['world cup golden boot odds', '2026 world cup top scorer odds', 'world cup top goalscorer 2026', 'golden boot favourite 2026'],
  },

  '2026-world-cup-reach-final': {
    slug: '2026-world-cup-reach-final',
    question: 'What are the odds to reach the 2026 World Cup final?',
    structure: 'simple',
    intro:
      'Two teams make it to the 2026 FIFA World Cup final. This page aggregates the live \u201Creach the final\u201D markets across platforms, so you can see which nations the money favours to play on the tournament\\u2019s last day \u2014 updated continuously.',
    description:
      'Live odds to reach the 2026 World Cup final from prediction markets \u2014 every contender\\u2019s probability of making the final, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      any: ['2026 fifa world cup final', '2026 world cup final'],
      exclude: ['semifinal', 'semi-final', 'semi final', 'quarterfinal', 'quarter-final', 'quarter final', 'goals', 'scored', 'attend', 'boycott', 'outside of'],
    },
    keywords: ['odds to reach 2026 world cup final', '2026 world cup finalists odds', 'which teams reach world cup final 2026', 'world cup 2026 final odds'],
  },

  '2026-world-cup-reach-semifinal': {
    slug: '2026-world-cup-reach-semifinal',
    question: 'What are the odds to reach the 2026 World Cup semifinal?',
    structure: 'simple',
    intro:
      'Four teams reach the 2026 FIFA World Cup semifinals. This page aggregates the live \u201Creach the semifinal\u201D markets across platforms, so you can see which nations the money favours to make the final four \u2014 updated continuously.',
    description:
      'Live odds to reach the 2026 World Cup semifinal from prediction markets \u2014 every contender\\u2019s probability of making the final four, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      any: ['2026 fifa world cup semifinal', '2026 world cup semifinal', '2026 fifa world cup semi-final', '2026 world cup semi-final', '2026 fifa world cup semi final', '2026 world cup semi final'],
      exclude: ['quarterfinal', 'quarter-final', 'quarter final', 'goals', 'scored', 'attend', 'boycott', 'outside of'],
    },
    keywords: ['odds to reach 2026 world cup semifinal', '2026 world cup semifinalists odds', 'world cup 2026 final four odds', 'which teams reach world cup semifinal 2026'],
  },

  '2026-world-cup-reach-quarterfinal': {
    slug: '2026-world-cup-reach-quarterfinal',
    question: 'What are the odds to reach the 2026 World Cup quarterfinal?',
    structure: 'simple',
    intro:
      'Eight teams reach the 2026 FIFA World Cup quarterfinals. This page aggregates the live \u201Creach the quarterfinal\u201D markets across platforms, so you can see which nations the money favours to make the last eight \u2014 updated continuously.',
    description:
      'Live odds to reach the 2026 World Cup quarterfinal from prediction markets \u2014 every contender\\u2019s probability of making the last eight, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      any: ['2026 fifa world cup quarterfinal', '2026 world cup quarterfinal', '2026 fifa world cup quarter-final', '2026 world cup quarter-final', '2026 fifa world cup quarter final', '2026 world cup quarter final'],
      exclude: ['semifinal', 'semi-final', 'semi final', 'goals', 'scored', 'attend', 'boycott', 'outside of'],
    },
    keywords: ['odds to reach 2026 world cup quarterfinal', '2026 world cup quarterfinalists odds', 'world cup 2026 last eight odds', 'which teams reach world cup quarterfinal 2026'],
  },

  '2028-us-presidential-election': {
    slug: '2028-us-presidential-election',
    question: 'What are the odds for the 2028 US Presidential Election?',
    structure: 'election',
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
