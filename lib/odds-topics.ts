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
      'Two teams make it to the 2026 FIFA World Cup final. This page aggregates the live \u201Creach the final\u201D markets across platforms, so you can see which nations the money favours to play on the tournament\u2019s last day \u2014 updated continuously.',
    description:
      'Live odds to reach the 2026 World Cup final from prediction markets \u2014 every contender\u2019s probability of making the final, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
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
      'Live odds to reach the 2026 World Cup semifinal from prediction markets \u2014 every contender\u2019s probability of making the final four, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      any: ['reach the semifinals at the 2026 fifa world cup'],
      exclude: ['eliminated', 'goals', 'scored', 'attend', 'boycott', 'outside of', 'host'],
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
      'Live odds to reach the 2026 World Cup quarterfinal from prediction markets \u2014 every contender\u2019s probability of making the last eight, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      any: ['reach the quarterfinals at the 2026 fifa world cup'],
      exclude: ['eliminated', 'goals', 'scored', 'attend', 'boycott', 'outside of', 'host'],
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

  // ---------------------------------------------------------------------------
  // Cluster B (2026 non-soccer simple lists). Anchors built from REAL pulled
  // titles (STEP 0), simulated through the filter+extractor before shipping.
  // ---------------------------------------------------------------------------
  '2026-world-series': {
    slug: '2026-world-series',
    question: 'What are the odds to win the 2026 World Series?',
    structure: 'simple',
    intro:
      'One team lifts the 2026 World Series. This page aggregates the live championship markets across platforms, so you can see which teams the money favours \u2014 updated continuously.',
    description:
      'Live 2026 World Series odds from prediction markets \u2014 every team\u2019s championship probability, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      any: ['2026 world series'],
      exclude: ['poker', ' vs ', ' vs. ', 'mvp', 'pennant', 'home run', 'manager', 'attendance'],
    },
    keywords: ['2026 world series odds', 'world series winner odds 2026', 'mlb championship odds 2026', 'who will win the world series 2026'],
  },

  '2026-mls-cup': {
    slug: '2026-mls-cup',
    question: 'What are the odds to win the 2026 MLS Cup?',
    structure: 'simple',
    intro:
      'One club lifts the 2026 MLS Cup. This page aggregates the live championship markets across platforms, so you can see which clubs the money favours \u2014 updated continuously.',
    description:
      'Live 2026 MLS Cup odds from prediction markets \u2014 every club\u2019s championship probability, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      any: ['2026 mls cup'],
      exclude: [' vs ', 'mvp', 'supporters', 'golden boot', 'attendance'],
    },
    keywords: ['2026 mls cup odds', 'mls cup winner odds 2026', 'mls champion odds 2026', 'who will win mls cup 2026'],
  },

  '2026-ballon-dor': {
    slug: '2026-ballon-dor',
    question: 'What are the odds to win the 2026 Ballon d\u2019Or?',
    structure: 'simple',
    intro:
      'The Ballon d\u2019Or goes to the year\u2019s best footballer. This page aggregates the live 2026 award markets across platforms, so you can see which players the money favours \u2014 updated continuously.',
    description:
      'Live 2026 Ballon d\u2019Or odds from prediction markets \u2014 every player\u2019s probability to win, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      // 'who wins' drops the Myriad aggregator market that would mis-extract to "Who".
      any: ['ballon d'],
      exclude: ['who wins', 'who will win', ' vs ', 'women', 'kopa', 'yashin'],
    },
    keywords: ['2026 ballon dor odds', 'ballon d\u2019or favourite 2026', 'ballon dor winner odds 2026', 'who will win ballon dor 2026'],
  },

  '2026-mens-wimbledon': {
    slug: '2026-mens-wimbledon',
    question: 'What are the odds to win the 2026 Men\u2019s Wimbledon?',
    structure: 'simple',
    intro:
      'One player wins the 2026 Wimbledon men\u2019s singles. This page aggregates the live title markets across platforms, so you can see which players the money favours \u2014 updated continuously.',
    description:
      'Live 2026 Men\u2019s Wimbledon odds from prediction markets \u2014 every player\u2019s title probability, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      // Anchor includes "2026 " so it cannot be a substring of "women\u2019s" (which
      // contains "men\u2019s"); the leading year+space breaks the overlap.
      any: ['2026 men\u2019s wimbledon'],
      exclude: ['doubles', 'mixed', 'wheelchair', 'junior'],
    },
    keywords: ['2026 mens wimbledon odds', 'wimbledon mens singles odds 2026', 'wimbledon champion odds 2026', 'who will win wimbledon 2026 men'],
  },

  '2026-womens-wimbledon': {
    slug: '2026-womens-wimbledon',
    question: 'What are the odds to win the 2026 Women\u2019s Wimbledon?',
    structure: 'simple',
    intro:
      'One player wins the 2026 Wimbledon women\u2019s singles. This page aggregates the live title markets across platforms, so you can see which players the money favours \u2014 updated continuously.',
    description:
      'Live 2026 Women\u2019s Wimbledon odds from prediction markets \u2014 every player\u2019s title probability, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      any: ['2026 women\u2019s wimbledon'],
      exclude: ['doubles', 'mixed', 'wheelchair', 'junior'],
    },
    keywords: ['2026 womens wimbledon odds', 'wimbledon womens singles odds 2026', 'wimbledon ladies champion odds 2026', 'who will win wimbledon 2026 women'],
  },

  // ---------------------------------------------------------------------------
  // Cluster B re-pull additions. Anchors built from REAL pulled titles and
  // simulated through the live extractor (incl. the be-the-champion verb fix).
  // ---------------------------------------------------------------------------
  '2026-f1-drivers-championship': {
    slug: '2026-f1-drivers-championship',
    question: 'What are the odds to win the 2026 F1 Drivers\u2019 Championship?',
    structure: 'simple',
    intro:
      'One driver takes the 2026 Formula 1 Drivers\u2019 Championship. This page aggregates the live title markets across platforms, so you can see which drivers the money favours \u2014 updated continuously.',
    description:
      'Live 2026 F1 Drivers\u2019 Championship odds from prediction markets \u2014 every driver\u2019s title probability, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      // 'f1 drivers' catches both the Polymarket "be the 2026 F1 Drivers'
      // Champion" markets and the Myriad "F1 Drivers Championship" market,
      // without touching the F1 Constructors markets.
      any: ['f1 drivers'],
      exclude: ['constructor', 'who wins'],
    },
    keywords: ['2026 f1 drivers championship odds', 'f1 drivers title odds 2026', 'formula 1 drivers champion odds 2026', 'who will win f1 2026'],
  },

  '2026-brazil-presidential-election': {
    slug: '2026-brazil-presidential-election',
    question: 'What are the odds to win the 2026 Brazilian presidential election?',
    structure: 'simple',
    intro:
      'Brazil elects its president in 2026. This page aggregates the live real-money candidate markets across platforms, so you can see who the money favours \u2014 updated continuously.',
    description:
      'Live 2026 Brazilian presidential election odds from prediction markets \u2014 every candidate\u2019s win probability, aggregated across Polymarket and more, updated continuously on Predacle.',
    match: {
      // The literal win-market phrasing is surgical: it excludes the heavy
      // World Cup soccer noise and the "finish in second place in the first
      // round" markets that q=brazil returns. 'lula win' drops the Manifold
      // play-money "Lula" market, which otherwise shows as a duplicate row
      // beside the real-money "Luiz Inacio Lula da Silva" (short vs full name
      // do not group); the Polymarket "Lula da Silva win" is not caught by it.
      any: ['win the 2026 brazilian presidential election'],
      exclude: ['lula win', 'fifa', 'world cup'],
    },
    keywords: ['2026 brazil election odds', 'brazilian presidential election odds 2026', 'lula odds 2026', 'who will win brazil election 2026'],
  },
}

export function getOddsTopic(slug: string): OddsTopic | null {
  return (ODDS_TOPICS as Record<string, OddsTopic>)[slug] || null
}

export const ODDS_TOPIC_SLUGS: string[] = Object.keys(ODDS_TOPICS)
