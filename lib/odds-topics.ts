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
      'The Golden Boot goes to the top scorer of the 2026 FIFA World Cup. This page pulls together the live player markets across platforms, so you can see which players the money favours to finish as the tournament’s leading goalscorer — updated continuously.',
    description:
      'Live 2026 World Cup Golden Boot odds from prediction markets — every contender’s probability to finish as top goalscorer, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
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
      'Two teams make it to the 2026 FIFA World Cup final. This page aggregates the live \u201Creach the final\u201D markets across platforms, so you can see which nations the money favours to play on the tournament’s last day — updated continuously.',
    description:
      'Live odds to reach the 2026 World Cup final from prediction markets — every contender’s probability of making the final, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
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
      'Four teams reach the 2026 FIFA World Cup semifinals. This page aggregates the live \u201Creach the semifinal\u201D markets across platforms, so you can see which nations the money favours to make the final four — updated continuously.',
    description:
      'Live odds to reach the 2026 World Cup semifinal from prediction markets — every contender’s probability of making the final four, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
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
      'Eight teams reach the 2026 FIFA World Cup quarterfinals. This page aggregates the live \u201Creach the quarterfinal\u201D markets across platforms, so you can see which nations the money favours to make the last eight — updated continuously.',
    description:
      'Live odds to reach the 2026 World Cup quarterfinal from prediction markets — every contender’s probability of making the last eight, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
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
      'One team lifts the 2026 World Series. This page aggregates the live championship markets across platforms, so you can see which teams the money favours — updated continuously.',
    description:
      'Live 2026 World Series odds from prediction markets — every team’s championship probability, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
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
      'One club lifts the 2026 MLS Cup. This page aggregates the live championship markets across platforms, so you can see which clubs the money favours — updated continuously.',
    description:
      'Live 2026 MLS Cup odds from prediction markets — every club’s championship probability, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      any: ['2026 mls cup'],
      exclude: [' vs ', 'mvp', 'supporters', 'golden boot', 'attendance'],
    },
    keywords: ['2026 mls cup odds', 'mls cup winner odds 2026', 'mls champion odds 2026', 'who will win mls cup 2026'],
  },

  '2026-ballon-dor': {
    slug: '2026-ballon-dor',
    question: 'What are the odds to win the 2026 Ballon d’Or?',
    structure: 'simple',
    intro:
      'The Ballon d’Or goes to the year’s best footballer. This page aggregates the live 2026 award markets across platforms, so you can see which players the money favours — updated continuously.',
    description:
      'Live 2026 Ballon d’Or odds from prediction markets — every player’s probability to win, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      // 'who wins' drops the Myriad aggregator market that would mis-extract to "Who".
      any: ['ballon d'],
      exclude: ['who wins', 'who will win', ' vs ', 'women', 'kopa', 'yashin'],
    },
    keywords: ['2026 ballon dor odds', 'ballon d’or favourite 2026', 'ballon dor winner odds 2026', 'who will win ballon dor 2026'],
  },

  '2026-mens-wimbledon': {
    slug: '2026-mens-wimbledon',
    question: 'What are the odds to win the 2026 Men’s Wimbledon?',
    structure: 'simple',
    intro:
      'One player wins the 2026 Wimbledon men’s singles. This page aggregates the live title markets across platforms, so you can see which players the money favours — updated continuously.',
    description:
      'Live 2026 Men’s Wimbledon odds from prediction markets — every player’s title probability, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      // Anchor includes "2026 " so it cannot be a substring of "women’s" (which
      // contains "men’s"); the leading year+space breaks the overlap.
      any: ['2026 men’s wimbledon'],
      exclude: ['doubles', 'mixed', 'wheelchair', 'junior'],
    },
    keywords: ['2026 mens wimbledon odds', 'wimbledon mens singles odds 2026', 'wimbledon champion odds 2026', 'who will win wimbledon 2026 men'],
  },

  '2026-womens-wimbledon': {
    slug: '2026-womens-wimbledon',
    question: 'What are the odds to win the 2026 Women’s Wimbledon?',
    structure: 'simple',
    intro:
      'One player wins the 2026 Wimbledon women’s singles. This page aggregates the live title markets across platforms, so you can see which players the money favours — updated continuously.',
    description:
      'Live 2026 Women’s Wimbledon odds from prediction markets — every player’s title probability, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      any: ['2026 women’s wimbledon'],
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
    question: 'What are the odds to win the 2026 F1 Drivers’ Championship?',
    structure: 'simple',
    intro:
      'One driver takes the 2026 Formula 1 Drivers’ Championship. This page aggregates the live title markets across platforms, so you can see which drivers the money favours — updated continuously.',
    description:
      'Live 2026 F1 Drivers’ Championship odds from prediction markets — every driver’s title probability, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
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
      'Brazil elects its president in 2026. This page aggregates the live real-money candidate markets across platforms, so you can see who the money favours — updated continuously.',
    description:
      'Live 2026 Brazilian presidential election odds from prediction markets — every candidate’s win probability, aggregated across Polymarket and more, updated continuously on Predacle.',
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

  // ---------------------------------------------------------------------------
  // Cluster C (2027 single-winner fields). Identified via the 2027 pull;
  // simulated through the live extractor (accent + verb fixes already shipped).
  // ---------------------------------------------------------------------------
  '2027-nba-finals': {
    slug: '2027-nba-finals',
    question: 'What are the odds to win the 2027 NBA Finals?',
    structure: 'simple',
    intro:
      'One team lifts the 2027 NBA championship. This page aggregates the live title markets across platforms, so you can see which teams the money favours — updated continuously.',
    description:
      'Live 2027 NBA Finals odds from prediction markets — every team’s championship probability, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      // '2027 nba finals' isolates the title markets from the 2026-Finals prop
      // noise (MVP, riot, halftime, single-game props). 'reach' guards against
      // any make-the-finals markets that are a different question than winning.
      any: ['2027 nba finals'],
      exclude: ['mvp', 'riot', 'halftime', 'game ', 'reach', 'drafted'],
    },
    keywords: ['2027 nba finals odds', 'nba championship odds 2027', 'nba title odds 2027', 'who will win the nba finals 2027'],
  },

  // ---------------------------------------------------------------------------
  // MLB 2026 regular-season stat leaders. Discovered via /api/odds-discover.
  // Only Doubles + ERA cleared the contest-shape gate (>=3 contenders above 4%,
  // no runaway favorite). RBIs/Runs/Stolen-bases shelved as thin/lopsided.
  // Uses the 'lead(s) the' extractor delimiter added in this same commit.
  // Full-phrase anchors + cross-stat excludes keep the two pages from bleeding
  // into each other (all share 'lead the mlb in'). One known extractor edge:
  // 'Gavin Williams' (ERA) rejects, but it sits at 0% (below threshold) so the
  // rendered field is unaffected.
  // ---------------------------------------------------------------------------
  '2026-mlb-doubles-leader': {
    slug: '2026-mlb-doubles-leader',
    question: 'What are the odds to lead the MLB in doubles in 2026?',
    structure: 'simple',
    intro:
      'One hitter leads Major League Baseball in doubles across the 2026 regular season. This page aggregates the live leader markets across platforms, so you can see which players the money favours \u2014 updated continuously.',
    description:
      'Live 2026 MLB doubles leader odds from prediction markets \u2014 every contender\u2019s probability of leading the majors in doubles, aggregated across Polymarket and more, updated continuously on Predacle.',
    match: {
      // Full-phrase anchor isolates the doubles race; excludes name the other
      // four stat categories so they can never cross-contaminate this field.
      any: ['lead the mlb in doubles'],
      exclude: ['rbis', 'era', 'runs', 'stolen bases', 'who wins', 'who will win'],
    },
    keywords: ['2026 mlb doubles leader odds', 'mlb doubles leader 2026', 'who will lead mlb in doubles 2026', 'mlb doubles odds 2026'],
  },
  '2026-mlb-era-leader': {
    slug: '2026-mlb-era-leader',
    question: 'What are the odds to lead the MLB in ERA in 2026?',
    structure: 'simple',
    intro:
      'One pitcher leads Major League Baseball in ERA across the 2026 regular season. This page aggregates the live leader markets across platforms, so you can see which arms the money favours \u2014 updated continuously.',
    description:
      'Live 2026 MLB ERA leader odds from prediction markets \u2014 every contender\u2019s probability of posting the lowest ERA in the majors, aggregated across Polymarket and more, updated continuously on Predacle.',
    match: {
      // Full-phrase anchor isolates the ERA race; excludes the other four stats.
      any: ['lead the mlb in era'],
      exclude: ['rbis', 'doubles', 'runs', 'stolen bases', 'who wins', 'who will win'],
    },
    keywords: ['2026 mlb era leader odds', 'mlb era leader 2026', 'who will lead mlb in era 2026', 'lowest era mlb 2026'],
  },

  '2027-french-presidential-election': {
    slug: '2027-french-presidential-election',
    question: 'What are the odds to win the 2027 French presidential election?',
    structure: 'simple',
    intro:
      'France elects its president in 2027. This page aggregates the live real-money candidate markets across platforms, so you can see who the money favours — updated continuously.',
    description:
      'Live 2027 French presidential election odds from prediction markets — every candidate’s win probability, aggregated across Polymarket and more, updated continuously on Predacle.',
    match: {
      // Win-market anchor only: the "be candidate to" markets (which would show
      // Bardella at his ~77% candidacy price instead of his ~26% win price) and
      // the "election called by <date>" markets do not contain this substring.
      any: ['win the 2027 french presidential election'],
      exclude: ['fifa', 'world cup', 'candidate'],
    },
    keywords: ['2027 french election odds', 'french presidential election odds 2027', 'france 2027 election odds', 'who will win the french election 2027'],
  },

  // ---------------------------------------------------------------------------
  // Cluster D (2027 NFL single-winner fields). Identified via the "win the 2027"
  // pull; all 64 markets real-money (Polymarket). Ships WITH the \p{N} digit fix
  // so digit team names (49ers) survive name validation. Simulated through the
  // live extractor: AFC 10 / NFC 10 / Super Bowl 9 shown at the 4% threshold.
  // ---------------------------------------------------------------------------
  '2027-super-bowl': {
    slug: '2027-super-bowl',
    question: 'What are the odds to win the 2027 Super Bowl?',
    structure: 'simple',
    intro:
      'One team lifts the Lombardi Trophy to end the 2026 NFL season. This page aggregates the live championship markets across platforms, so you can see which team the money favours — updated continuously.',
    description:
      'Live 2027 Super Bowl odds from prediction markets — every NFL team’s championship probability, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      // Polymarket phrases the Super Bowl winner as "win the 2027 NFL league
      // championship" (all 32 teams). The AFC/NFC conference fields use a
      // different substring so they don't collide; 'who wins' guards an
      // aggregator market mis-extracting to "Who".
      any: ['2027 nfl league championship'],
      exclude: ['who wins', 'who will win', 'mvp', 'reach'],
    },
    keywords: ['2027 super bowl odds', 'super bowl 2027 odds', 'nfl championship odds 2027', 'who will win the super bowl 2027'],
  },

  '2027-nfl-afc-championship': {
    slug: '2027-nfl-afc-championship',
    question: 'What are the odds to win the 2027 NFL AFC Championship?',
    structure: 'simple',
    intro:
      'One AFC team wins the conference and reaches the Super Bowl. This page aggregates the live 2027 AFC Championship markets across platforms, so you can see which team the money favours — updated continuously.',
    description:
      'Live 2027 NFL AFC Championship odds from prediction markets — every AFC team’s probability of winning the conference, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      // 'afc championship' substring isolates the 16 AFC-conference markets from
      // the NFC and league-championship fields (separate pages).
      any: ['2027 nfl afc championship'],
      exclude: ['who wins', 'who will win', 'mvp', 'reach'],
    },
    keywords: ['2027 afc championship odds', 'nfl afc championship odds 2027', 'afc champion odds 2027', 'who will win the afc 2027'],
  },

  '2027-nfl-nfc-championship': {
    slug: '2027-nfl-nfc-championship',
    question: 'What are the odds to win the 2027 NFL NFC Championship?',
    structure: 'simple',
    intro:
      'One NFC team wins the conference and reaches the Super Bowl. This page aggregates the live 2027 NFC Championship markets across platforms, so you can see which team the money favours — updated continuously.',
    description:
      'Live 2027 NFL NFC Championship odds from prediction markets — every NFC team’s probability of winning the conference, aggregated across Polymarket, Kalshi and more, updated continuously on Predacle.',
    match: {
      // 'nfc championship' substring isolates the 16 NFC-conference markets.
      // Depends on the \\p{N} digit fix so 'San Francisco 49ers' (8%) survives.
      any: ['2027 nfl nfc championship'],
      exclude: ['who wins', 'who will win', 'mvp', 'reach'],
    },
    keywords: ['2027 nfc championship odds', 'nfl nfc championship odds 2027', 'nfc champion odds 2027', 'who will win the nfc 2027'],
  },

  '2026-world-cup-golden-ball': {
    slug: '2026-world-cup-golden-ball',
    question: 'What are the odds to win the 2026 World Cup Golden Ball?',
    structure: 'simple',
    intro:
      'The Golden Ball goes to the best player of the 2026 FIFA World Cup. This page aggregates the live award markets across platforms, so you can see which players the money favours — updated continuously.',
    description:
      'Live 2026 World Cup Golden Ball odds from prediction markets — every contender’s probability of being named the tournament’s best player, aggregated across Polymarket and more, updated continuously on Predacle.',
    match: {
      // Full-phrase anchor isolates the best-player award from the Golden Boot
      // (top scorer) and the main winner/reach pages. Phrased "win the Golden
      // Ball at the 2026 FIFA World Cup"; the 'win the' verb captures the player
      // name. Accent player names rely on the accent fix already shipped.
      any: ['golden ball at the 2026 fifa world cup'],
      exclude: ['who wins', 'who will win'],
    },
    keywords: ['2026 world cup golden ball odds', 'world cup golden ball odds', 'world cup best player odds 2026', 'who will win the golden ball 2026'],
  },
}

export function getOddsTopic(slug: string): OddsTopic | null {
  return (ODDS_TOPICS as Record<string, OddsTopic>)[slug] || null
}

export const ODDS_TOPIC_SLUGS: string[] = Object.keys(ODDS_TOPICS)
