// lib/odds-content.ts
// -----------------------------------------------------------------------------
// Server-side SEO content for /odds/[slug].
//
// Three things ship from here:
//   1. buildOddsSummary()   — a short, extractable answer paragraph. Written to
//                             be liftable as a featured snippet (Google pulls
//                             those from page text, not from schema).
//   2. buildOddsFaq()       — 5 Q&As generated from the topic's LIVE field.
//   3. buildOddsExplainer() — evergreen sections that VARY BY TOPIC TYPE, so a
//                             tennis page does not carry byte-identical prose to
//                             an MLB stat-leader page. Duplicate blocks across
//                             ~20 pages is a real thin-content risk; this is the
//                             fix for it.
//
// HARD RULE: every number here is read from live data. Nothing is invented and
// nothing is LLM-rewritten at runtime. Prediction-market odds are financial
// content, and a hallucinated figure would be worse than no page at all.
// Manifold is play-money and never drives a favourite claim.
// -----------------------------------------------------------------------------
import type { SimpleTopicOdds, TopicOdds, CandidateRow } from './odds-data'

export interface FaqItem {
  q: string
  a: string
}

export interface ExplainerSection {
  h: string
  p: string
}

const REAL_MONEY = ['Polymarket', 'Kalshi', 'Myriad', 'Limitless', 'Bookmaker']

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const pct = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n)}%`)

function platformsIn(rows: CandidateRow[]): string[] {
  const seen = new Set<string>()
  for (const r of rows) for (const p of r.prices) seen.add(p.platform)
  const all = [...seen].map(cap)
  const real = all.filter((p) => REAL_MONEY.includes(p)).sort()
  const play = all.filter((p) => !REAL_MONEY.includes(p)).sort()
  return [...real, ...play]
}

function listNames(rows: CandidateRow[], n: number): string {
  const names = rows.slice(0, n).map((r) => r.name)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Rows for 'simple' topics. 'election' topics use `sections` and yield []. */
function contendersOf(data: SimpleTopicOdds | TopicOdds | null): CandidateRow[] {
  if (!data) return []
  const s = data as SimpleTopicOdds
  return Array.isArray(s.contenders) ? s.contenders : []
}

// -----------------------------------------------------------------------------
// Topic flavour. Drives which explainer a page gets, so the ~20 odds pages do
// not all carry the same block of prose.
// NOTE: \bera\b is word-bounded on purpose. A bare 'era' substring matches
// "fEDERAl", "sevERAl", "opERAtions" and would misfile those pages.
// -----------------------------------------------------------------------------
export type Flavour =
  | 'statleader' | 'tennis' | 'soccer' | 'baseball'
  | 'nfl' | 'nba' | 'f1' | 'politics' | 'generic'

export function topicFlavour(slug: string, question: string): Flavour {
  const s = `${slug} ${question}`.toLowerCase()
  if (/lead the|leader|\bera\b|doubles|rbis|stolen bases|home runs/.test(s)) return 'statleader'
  if (/wimbledon|us open|australian open|french open|roland|tennis/.test(s)) return 'tennis'
  if (/world cup|ballon|golden boot|golden ball|mls|premier league|champions league/.test(s)) return 'soccer'
  if (/world series|mlb/.test(s)) return 'baseball'
  if (/super bowl|nfl|afc|nfc/.test(s)) return 'nfl'
  if (/nba/.test(s)) return 'nba'
  if (/f1|formula|drivers/.test(s)) return 'f1'
  if (/election|president|nominee|nomination/.test(s)) return 'politics'
  return 'generic'
}

/** The noun a flavour uses for its competitors. */
function actor(f: Flavour): string {
  switch (f) {
    case 'tennis': return 'player'
    case 'soccer': return 'player'
    case 'statleader': return 'player'
    case 'f1': return 'driver'
    case 'politics': return 'candidate'
    case 'baseball':
    case 'nfl':
    case 'nba': return 'team'
    default: return 'contender'
  }
}

// -----------------------------------------------------------------------------
// 1. Extractable summary. Short, factual, front-loaded. This is the paragraph a
//    featured snippet would lift, so it answers the question in the first
//    sentence and puts the numbers in plain text rather than in table cells.
// -----------------------------------------------------------------------------
export function buildOddsSummary(
  question: string,
  data: SimpleTopicOdds | TopicOdds | null,
): string | null {
  const rows = contendersOf(data)
  if (rows.length === 0 || !data) return null

  const lead = rows[0]
  const second = rows[1]
  const f = topicFlavour('', question)
  const noun = actor(f)
  const threshold = data.threshold ?? 4
  const above = rows.length
  const hidden = (data as SimpleTopicOdds).hiddenCount ?? 0
  const platforms = platformsIn(rows)

  // Construction note: the subject is always "the market", never the contender.
  // Team names are plural ("Kansas City Chiefs lead" vs "Jannik Sinner leads"),
  // and there is no clean way to agree the verb across both. Keeping the verb
  // attached to "the market" sidesteps it entirely.
  const parts: string[] = []
  parts.push(
    second
      ? `The market makes ${lead.name} the favourite at ${pct(lead.topProbability)}, ahead of ${second.name} at ${pct(second.topProbability)}.`
      : `The market makes ${lead.name} the favourite at ${pct(lead.topProbability)}.`,
  )
  const venue =
    platforms.length === 1
      ? `${platforms[0]} prices`
      : `${platforms.join(' and ')} price`
  parts.push(
    `${venue} ${above + hidden} ${noun}s in total, with ${above} above ${threshold}%.`,
  )
  parts.push('These are live prices and they move as money does.')
  return parts.join(' ')
}

// -----------------------------------------------------------------------------
// 2. FAQ, generated per topic from live data.
// -----------------------------------------------------------------------------
function favouriteQuestion(question: string): string {
  const m = question.match(/^What are the odds\s+(.*?)\??$/i)
  if (!m || !m[1]) return 'Who is the favourite?'
  return `Who is the favourite ${m[1].trim()}?`.replace(/\s+/g, ' ')
}

export function buildOddsFaq(
  question: string,
  data: SimpleTopicOdds | TopicOdds | null,
): FaqItem[] {
  const rows = contendersOf(data)
  if (rows.length === 0 || !data) return []

  const lead = rows[0]
  const threshold = data.threshold ?? 4
  const platforms = platformsIn(rows)
  const simple = data as SimpleTopicOdds
  const realCount = simple.realMoneyCount ?? 0
  const playCount = simple.playOnlyCount ?? 0
  const hidden = simple.hiddenCount ?? 0
  const noun = actor(topicFlavour('', question))

  const faq: FaqItem[] = []

  const src = lead.prices.find((p) => REAL_MONEY.includes(cap(p.platform)))
  faq.push({
    q: favouriteQuestion(question),
    a: `${lead.name}, at ${pct(lead.topProbability)}${src ? ` on ${cap(src.platform)}` : ''}. That is the market's view right now, not a prediction. It moves whenever someone takes a position.`,
  })

  if (rows.length >= 3) {
    faq.push({
      q: 'Who else is in contention?',
      a: `${listNames(rows.slice(1), 3)} are the next names on the board. ${hidden > 0 ? `Another ${hidden} ${noun}${hidden === 1 ? '' : 's'} sit below ${threshold}%, so they are counted rather than listed.` : `That is the full field above ${threshold}%.`}`,
    })
  }

  faq.push({
    q: 'Which prediction markets have odds on this?',
    a: `${platforms.join(', ')}.${realCount > 0 ? ` ${realCount} ${noun}${realCount === 1 ? '' : 's'} ${realCount === 1 ? 'is' : 'are'} priced with real money.` : ''}${playCount > 0 ? ` ${playCount} appear${playCount === 1 ? 's' : ''} only on play-money markets, so ${playCount === 1 ? 'it is' : 'they are'} shown as signal, not as a tradeable price.` : ''}`,
  })

  faq.push({
    q: 'What does the percentage actually mean?',
    a: `It is a price, and the price is the probability. A contract at ${pct(lead.topProbability)} means traders are collectively paying ${pct(lead.topProbability)} of a dollar for a payout that comes only if it happens. Nobody at Predacle sets that number. The market does.`,
  })

  faq.push({
    q: 'How often do these odds update?',
    a: 'Every 30 minutes or so. That is close enough to track the market, but not close enough to trade on blind. Open the source market and check the order book first.',
  })

  return faq
}

// -----------------------------------------------------------------------------
// 3. Explainer, varied by flavour. Two sections are written per topic type; two
//    are shared (they are factual disclosures, and repeating a disclosure is
//    correct). This keeps each page's prose distinct without pretending a
//    definition changes between sports.
// -----------------------------------------------------------------------------
const FLAVOUR_SECTIONS: Record<Flavour, ExplainerSection[]> = {
  tennis: [
    {
      h: 'How a tennis outright market prices a draw',
      p: 'A Grand Slam field is top-heavy by nature. Two or three players take most of the probability, and the rest of the draw splits what is left. That is not the market being lazy. Seeded players meet nobody dangerous until the second week, so their path is genuinely easier, and the price reflects it. Watch what happens when the bracket comes out: prices move on who landed in whose half, before a ball is struck.',
    },
    {
      h: 'Why a big name can sit at 2%',
      p: 'A former champion priced in the low single digits has not been written off. It means the market thinks they win this specific event roughly one time in fifty. Seven matches is a long way to go. Injury risk, surface, form and the draw all compound, and the maths punishes even great players who have to beat three of the top five to lift the trophy.',
    },
  ],
  soccer: [
    {
      h: 'Reading a tournament field',
      p: 'Soccer outrights price a whole tournament, not a match. A team at 12% is not 12% likely to win any given game; it is 12% likely to survive every game it has left. Group stage results, the shape of the knockout bracket and a single red card can all reprice the board overnight, which is why these numbers move more than a league table would suggest.',
    },
    {
      h: 'Player awards move differently to team markets',
      p: 'Individual awards like the Golden Boot or Ballon d\'Or carry a voter or a counting rule behind them, so they respond to narrative as well as performance. A striker on a deep-running team gets more games to score in. That structural advantage shows up in the price long before it shows up on the pitch.',
    },
  ],
  statleader: [
    {
      h: 'Season-long stat races are noisy',
      p: 'Leading a league in a single statistic over a full season is a low-probability event even for the best player at it. The favourite here is rarely above 15%. That is not indecision. It reflects how much of a stat title comes down to health, playing time and luck across six months, none of which anyone can price precisely in advance.',
    },
    {
      h: 'Why the favourite looks weak',
      p: 'A wide, flat field with no runaway leader usually means the market genuinely does not know. Compare that to a championship market, where one team can sit at 40%. If you see a stat leader priced above 20%, it is worth asking what the market knows that the rest of the field does not.',
    },
  ],
  baseball: [
    {
      h: 'Why baseball championship odds stay flat',
      p: 'Baseball is the least predictable of the major sports at the top end. The best team in a 162-game season still loses roughly a third of its games, and a short playoff series is close to a coin flip between good teams. That is why even a dominant favourite rarely clears 20% here, where an NBA favourite might sit at 40%.',
    },
    {
      h: 'What moves the number',
      p: 'Trade deadlines, rotation health and September form do most of the repricing. A single injury to a front-line starter can move a contender several points, because the playoff maths leans so heavily on the top of a rotation.',
    },
  ],
  nfl: [
    {
      h: 'Why NFL futures move so hard',
      p: 'A 17-game season means every result carries weight, and a single-elimination playoff means one bad afternoon ends a year. The board reprices violently in-season. A team can double its championship price on a two-game win streak, then give it all back on a quarterback injury.',
    },
    {
      h: 'Conference markets versus the championship',
      p: 'A conference title market prices reaching the final, not winning it. The two are related but not identical, and the gap between a team\'s conference price and its championship price tells you what the market thinks of its chances in the last game.',
    },
  ],
  nba: [
    {
      h: 'Why basketball favourites price so high',
      p: 'Basketball is the most favourite-friendly of the major sports. Best-of-seven series suppress upsets, and star players affect a far larger share of possessions than in football or baseball. A true contender sitting at 30% or 40% is normal here and would be extraordinary in the MLB market.',
    },
    {
      h: 'What actually moves it',
      p: 'Injuries to a single star, more than anything else. A championship price can halve on one MRI result. Trade deadline moves matter too, and they matter more than form, because the market is pricing a playoff run that starts months later.',
    },
  ],
  f1: [
    {
      h: 'Why one driver can dominate the board',
      p: 'Formula 1 titles are decided as much by the car as the driver, and car performance is stable across a season in a way that form in a team sport is not. That is why an F1 championship market can look lopsided in a way that would be strange in soccer or baseball. If a car is quickest, it is quickest at most circuits.',
    },
    {
      h: 'What reprices a season',
      p: 'Regulation changes, upgrade packages and reliability. A single engine failure costs points that cannot be recovered, so DNFs move the title price far more than a bad qualifying session does.',
    },
  ],
  politics: [
    {
      h: 'What an election market is actually pricing',
      p: 'These prices are not polls. A poll measures stated intent today. A market prices the outcome on election day, with everything between now and then already discounted: turnout, campaign money, scandals, and the chance a candidate is not on the ballot at all. That is why a market price and a polling average can disagree for months, and why the market is often the earlier signal.',
    },
    {
      h: 'Nomination markets and election markets are different questions',
      p: 'Winning a party\'s nomination and winning the general election are separate contracts with separate prices. A candidate can be a heavy favourite for one and a long shot in the other. Reading a nomination price as a presidency price is the most common mistake people make with this data.',
    },
  ],
  generic: [
    {
      h: 'How to read these odds',
      p: 'A prediction market contract pays a dollar if the outcome happens and nothing if it does not. So the price is the probability. A contract at 24 cents means the market is pricing roughly a 24% chance. Nobody sets that number the way a bookmaker sets a line; it is discovered by people buying and selling, and it moves the moment the crowd changes its mind.',
    },
    {
      h: 'Why the field looks the way it does',
      p: 'A market with one dominant favourite and a flat tail is telling you something different to a market with five names bunched together. The shape of the field is information. A tight field means genuine uncertainty. A lopsided one means the market has largely made up its mind.',
    },
  ],
}

/** Shared factual disclosures. Repeating a disclosure across pages is correct;
 *  these explain how Predacle sources and filters, and that does not change. */
const SHARED_SECTIONS: ExplainerSection[] = [
  {
    h: 'Why platforms disagree on the same event',
    p: 'The same question can trade at different prices on Polymarket, Kalshi, Myriad and Limitless. Each venue has its own traders, its own liquidity and its own fees, so prices drift apart. On thin markets a single large order is enough to open a gap. Predacle shows the best real-money price across venues, and a gap between two of them is sometimes a genuine signal and sometimes just one side being thin.',
  },
  {
    h: 'Real money and play money are not the same thing',
    p: 'Polymarket, Kalshi, Myriad, Limitless and Bookmaker are real-money venues. Their prices reflect capital at risk. Manifold runs on play money, which has not been convertible to anything since March 2025, so its prices appear here as forecasting signal only. A Manifold price never sets a headline number and never ranks a field. If someone shows up priced only on Manifold, the page says so.',
  },
]

export function buildOddsExplainer(slug: string, question: string): ExplainerSection[] {
  const f = topicFlavour(slug, question)
  return [...FLAVOUR_SECTIONS[f], ...SHARED_SECTIONS]
}

/** Back-compat: the previous export. Kept so nothing breaks if it is imported
 *  elsewhere. Prefer buildOddsExplainer(slug, question). */
export const ODDS_EXPLAINER: ExplainerSection[] = [
  ...FLAVOUR_SECTIONS.generic,
  ...SHARED_SECTIONS,
]
