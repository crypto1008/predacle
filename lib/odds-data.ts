// lib/odds-data.ts
// -----------------------------------------------------------------------------
// Shared server-side data layer for "What are the odds of X?" topic pages.
// Both the API route and the page server component import getTopicOdds() so the
// classification/grouping logic lives in exactly one place.
// -----------------------------------------------------------------------------
import { supabaseAdmin } from '@/lib/supabase'
import { getOddsTopic } from '@/lib/odds-topics'

export const THRESHOLD = 4

export type Bucket = 'party' | 'nomination' | 'election' | 'other'

interface MarketRow {
  id: string
  platform: string
  question: string
  probability: number | null
  volume: number | null
  volume_label: string | null
  category: string | null
}

// One platform's price for a candidate within a section.
export interface PlatformPrice {
  id: string
  platform: string
  probability: number
}

// A grouped candidate row: a display name + each platform that prices them.
export interface CandidateRow {
  name: string
  prices: PlatformPrice[]
  topProbability: number   // real-money-preferred best price, for sorting + threshold + display
}

export interface OddsSection {
  rows: CandidateRow[]
  hiddenCount: number      // candidates below THRESHOLD, summarised not listed
}

// Nomination is two separate contests (the D race and the R race), so it gets
// split into per-party sub-lists. `other` catches the rare candidate whose
// party can't be determined from the question text or the known-names map; it
// is normally empty and only rendered if it has rows.
export interface NominationSplit {
  democratic: OddsSection
  republican: OddsSection
  other: OddsSection
}

export interface TopicOdds {
  slug: string
  question: string
  threshold: number
  sections: { party: OddsSection; nomination: NominationSplit; election: OddsSection }
  headline: string | null
  generatedAt: string
}

// Simple structure: one ranked list of contenders (teams, etc.), no sub-sections.
export interface SimpleTopicOdds {
  slug: string
  question: string
  structure: 'simple'
  threshold: number
  contenders: CandidateRow[]
  hiddenCount: number
  realMoneyCount: number
  playOnlyCount: number
  headline: string | null
  generatedAt: string
}

// Classify a market question into a section (party first — it can also contain
// "election"; then nomination; then election-winner). Running/announcing/meta
// questions are 'other' and excluded from the clean sections.
export function classify(qRaw: string): Bucket {
  const q = qRaw.toLowerCase()
  if (
    q.includes('run for president') ||
    q.includes('announce') ||
    q.includes('happen normally') ||
    q.includes('take over the presidency') ||
    q.includes('more important') ||
    q.includes(' or ') ||
    q.includes(', rubio') || q.includes(', vance') || q.includes(', newsom')
  ) return 'other'

  if (/\bthe (democrats|republicans) win\b/.test(q) || /\ba (democrat|republican) win\b/.test(q)) return 'party'

  if (
    q.includes('nomination') || q.includes('nominee') ||
    q.includes('be nominated') || /\bbe the (democratic|republican)\b/.test(q)
  ) return 'nomination'

  if (
    q.includes('win the 2028 us presidential election') ||
    q.includes('win the 2028 presidential election') ||
    q.includes('be elected president') ||
    q.includes('become president') ||
    q.includes('elected president in 2028')
  ) return 'election'

  return 'other'
}

// Extract a display name from a question. Handles:
//   "Will <NAME> win/be ..."   (Polymarket + most Manifold)
//   "<NAME> will be ..."        (some Manifold phrasing)
// Returns null if no confident extraction (caller falls back to ungrouped row).
export function extractName(qRaw: string): string | null {
  const q = qRaw.trim()
  // "Will <NAME> win|be|take|become ..."
  let m = q.match(/^Will\s+(.+?)\s+(?:win|be|become|take|run|officially)\b/i)
  if (m && m[1]) return m[1].trim()
  // "<NAME> will be ..."
  m = q.match(/^(.+?)\s+will\s+be\b/i)
  if (m && m[1]) return m[1].trim()
  return null
}

// Normalise a name into a grouping key: lowercase, strip dots, collapse spaces,
// drop common nickname quotes. "J.D. Vance" and "JD Vance" -> "jd vance".
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'""]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Prefer the cleaner display spelling when the same key has variants
// (e.g. choose "JD Vance" over "J.D. Vance" — fewer dots reads cleaner).
function preferName(a: string, b: string): string {
  const dots = (s: string) => (s.match(/\./g) || []).length
  if (dots(a) !== dots(b)) return dots(a) < dots(b) ? a : b
  return a.length <= b.length ? a : b
}

// For party-level markets, "Will a Democrat win" / "Will the Democrats win" are
// the same outcome phrased differently across platforms. Collapse to one clean
// label so they group together and read cleanly ("Democrats" / "Republicans").
function partyName(qRaw: string): string | null {
  const q = qRaw.toLowerCase()
  if (q.includes('democrat')) return 'Democrats'
  if (q.includes('republican')) return 'Republicans'
  return null
}

// The number a candidate is headlined / sorted / thresholded on. Prefer a
// REAL-MONEY price (any non-Manifold platform); fall back to the play-money
// (Manifold) top only when the candidate has no real-money market at all.
// Manifold is non-convertible play-money, so a play-money quote must never
// outrank or float above a real-money one.
function headlineProb(prices: PlatformPrice[]): number {
  const real = prices.filter((p) => p.platform !== 'manifold')
  const pool = real.length ? real : prices
  return Math.max(...pool.map((p) => p.probability))
}

// Group rows into candidates by normalised name (no dedup/threshold/sort yet).
// Ungroupable rows become their own singleton group so nothing is lost.
function groupCandidates(
  rows: { id: string; platform: string; question: string; probability: number }[],
  partyMode = false,
): CandidateRow[] {
  const groups = new Map<string, CandidateRow>()
  let fallbackSeq = 0

  for (const r of rows) {
    // In party mode, resolve to the canonical party label so the two phrasings
    // ("a Democrat" / "the Democrats") merge into a single row.
    const extracted = partyMode ? partyName(r.question) : extractName(r.question)
    const key = extracted ? nameKey(extracted) : `__fallback_${fallbackSeq++}`
    const display = extracted || r.question

    const existing = groups.get(key)
    if (existing) {
      existing.name = preferName(existing.name, display)
      existing.prices.push({ id: r.id, platform: r.platform, probability: r.probability })
      existing.topProbability = Math.max(existing.topProbability, r.probability)
    } else {
      groups.set(key, {
        name: display,
        prices: [{ id: r.id, platform: r.platform, probability: r.probability }],
        topProbability: r.probability,
      })
    }
  }

  return Array.from(groups.values())
}

// Finalise candidates into a display section: dedup prices per platform, set a
// real-money-preferred topProbability (drives sort + threshold + the big shown
// number, so a play-money quote can never outrank a real-money one), sort
// descending, then split shown (>= THRESHOLD) from the hidden long-shot count.
function finalizeSection(cands: CandidateRow[]): OddsSection {
  for (const c of cands) {
    const byPlat = new Map<string, PlatformPrice>()
    for (const p of c.prices.sort((x, y) => y.probability - x.probability)) {
      if (!byPlat.has(p.platform)) byPlat.set(p.platform, p)
    }
    c.prices = Array.from(byPlat.values())
    c.topProbability = headlineProb(c.prices)
  }
  const all = [...cands].sort((a, b) => b.topProbability - a.topProbability)
  const shown = all.filter((c) => c.topProbability >= THRESHOLD)
  return { rows: shown, hiddenCount: all.length - shown.length }
}

function buildSection(
  rows: { id: string; platform: string; question: string; probability: number }[],
  partyMode = false,
): OddsSection {
  return finalizeSection(groupCandidates(rows, partyMode))
}

// Detect a nomination market's party from its question text. Returns null when
// the text names both or neither party, so the caller can resolve via vote /
// known-names fallback rather than guessing.
function detectParty(qRaw: string): 'D' | 'R' | null {
  const q = qRaw.toLowerCase()
  const dem = /\bdemocrat(ic|s)?\b/.test(q)
  const rep = /\brepublican(s)?\b/.test(q)
  if (dem && !rep) return 'D'
  if (rep && !dem) return 'R'
  return null
}

// Fallback party for well-known 2028 figures, used only when a candidate's
// markets never name a party in their text. Keyed by nameKey() output.
const KNOWN_PARTY: Record<string, 'D' | 'R'> = {
  'jd vance': 'R', 'marco rubio': 'R', 'tucker carlson': 'R', 'donald trump': 'R',
  'donald trump jr': 'R', 'ron desantis': 'R', 'vivek ramaswamy': 'R', 'nikki haley': 'R',
  'glenn youngkin': 'R', 'ted cruz': 'R', 'josh hawley': 'R', 'greg abbott': 'R',
  'gavin newsom': 'D', 'alexandria ocasio-cortez': 'D', 'jon ossoff': 'D', 'kamala harris': 'D',
  'pete buttigieg': 'D', 'josh shapiro': 'D', 'gretchen whitmer': 'D', 'wes moore': 'D',
  'cory booker': 'D', 'andy beshear': 'D', 'raphael warnock': 'D', 'jb pritzker': 'D',
  'amy klobuchar': 'D', 'bernie sanders': 'D', 'hakeem jeffries': 'D', 'mark kelly': 'D',
  'michelle obama': 'D', 'ro khanna': 'D',
}

// Resolve a single nomination market's party: prefer the party named in the
// question text; fall back to the known-names map keyed on the extracted name;
// else null (genuinely unknown — lands in the 'other' catch-list).
function rowParty(question: string): 'D' | 'R' | null {
  const p = detectParty(question)
  if (p) return p
  const ex = extractName(question)
  if (ex) {
    const known = KNOWN_PARTY[nameKey(ex)]
    if (known) return known
  }
  return null
}

// Split nomination markets into the Democratic race and the Republican race.
// Nomination markets are party-scoped contests, so we partition the rows by
// party FIRST and group within each race. A candidate who genuinely appears in
// both races (e.g. a novelty market priced in each) correctly shows in both,
// and no candidate is ever stranded by a cross-party merge. 'other' only
// catches rows with no party signal and an unknown name.
function buildNominationSplit(
  rows: { id: string; platform: string; question: string; probability: number }[],
): NominationSplit {
  const demRows: typeof rows = []
  const repRows: typeof rows = []
  const othRows: typeof rows = []
  for (const r of rows) {
    const p = rowParty(r.question)
    if (p === 'D') demRows.push(r)
    else if (p === 'R') repRows.push(r)
    else othRows.push(r)
  }

  return {
    democratic: buildSection(demRows),
    republican: buildSection(repRows),
    other: buildSection(othRows),
  }
}

export async function getTopicOdds(slug: string): Promise<TopicOdds | null> {
  const topic = getOddsTopic(slug)
  if (!topic) return null

  const orFilter = topic.match.any.map((t) => `question.ilike.%${t}%`).join(',')
  let query = supabaseAdmin
    .from('markets')
    .select('id, platform, question, probability, volume, volume_label, category')
    .eq('status', 'active')
    .or(orFilter)
    .order('volume', { ascending: false, nullsFirst: false })
    .limit(200)
  if (topic.match.category) query = query.eq('category', topic.match.category)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const excludes = (topic.match.exclude || []).map((e) => e.toLowerCase())
  const rows = (data as MarketRow[] || [])
    .filter((m) => m.probability != null)
    .filter((m) => {
      const q = (m.question || '').toLowerCase()
      return !excludes.some((e) => q.includes(e))
    })
    .map((m) => ({
      id: m.id,
      platform: m.platform,
      question: m.question,
      probability: Math.round((m.probability as number) * 100),
      bucket: classify(m.question),
    }))

  const party = buildSection(rows.filter((r) => r.bucket === 'party'), true)
  const nomination = buildNominationSplit(rows.filter((r) => r.bucket === 'nomination'))
  const election = buildSection(rows.filter((r) => r.bucket === 'election'))

  // Build a fresh, data-derived headline (no hardcoded numbers).
  // For the "leading individual candidate" claim, prefer a real-money price:
  // each candidate's headline figure is their best NON-Manifold price if they
  // have one (Manifold is play-money). Candidates with only play-money prices
  // are skipped for the lead claim so we never headline a play-money number.
  function realMoneyTop(c: CandidateRow): number | null {
    const real = c.prices.filter((p) => p.platform !== 'manifold')
    if (!real.length) return null
    return Math.max(...real.map((p) => p.probability))
  }
  let leadCandidate: { name: string; prob: number } | null = null
  for (const c of election.rows) {
    const rp = realMoneyTop(c)
    if (rp == null) continue
    if (!leadCandidate || rp > leadCandidate.prob) leadCandidate = { name: c.name, prob: rp }
  }

  let headline: string | null = null
  const dem = party.rows.find((r) => /democrat/i.test(r.name))
  const rep = party.rows.find((r) => /republican/i.test(r.name))
  if (dem && rep) {
    const demP = realMoneyTop(dem) ?? dem.topProbability
    const repP = realMoneyTop(rep) ?? rep.topProbability
    const lead = demP >= repP ? 'Democrats' : 'Republicans'
    const leadP = Math.max(demP, repP)
    headline = `Prediction markets currently give the ${lead} about ${leadP}% to win the 2028 US Presidential Election`
    if (leadCandidate) headline += `, with ${leadCandidate.name} the leading individual candidate at around ${leadCandidate.prob}%.`
    else headline += '.'
  } else if (leadCandidate) {
    headline = `Prediction markets currently make ${leadCandidate.name} the favorite to win the 2028 US Presidential Election at around ${leadCandidate.prob}%.`
  }

  return {
    slug,
    question: topic.question,
    threshold: THRESHOLD,
    sections: { party, nomination, election },
    headline,
    generatedAt: new Date().toISOString(),
  }
}

// Extract a contender name for 'simple' topics, e.g.
// "Will Brazil win the 2026 World Cup?" -> "Brazil".
// "Will the Kansas City Chiefs win the Super Bowl?" -> "Kansas City Chiefs".
export function extractContender(qRaw: string): string | null {
  let q = qRaw.trim()
  // Strip a leading "Will " and a trailing "?".
  q = q.replace(/^will\s+/i, '').replace(/\?+\s*$/, '')
  // Subject is everything up to the first qualifying verb phrase:
  //   "... win ..."            (team-winner markets)
  //   "... reach ..."          (stage-progression markets: reach the final/semi/quarter)
  //   "... be the top ..."     (top goalscorer / golden boot markets)
  // Bare "be" is deliberately NOT a delimiter — it would match prop markets
  // ("... be eliminated", "... be a finalist") and mis-extract a contender.
  const m = q.match(/^(.*?)\s+(?:to\s+)?(?:win(?:s)?|reach(?:es)?|be the top)\b/i)
  if (!m) return null
  let name = m[1].replace(/^the\s+/i, '').trim()

  if (!name || name.length < 2 || name.length > 32) return null

  // Reject anything that still contains question/category words — these signal a
  // category or negative market ("a South American country", "France will not",
  // "the champion be a first time winner"), not a single contender.
  // NOTE: ' and ' is intentionally NOT banned so multi-word countries survive
  // ("Bosnia and Herzegovina", "Trinidad and Tobago"). ' or ' stays banned (it
  // reliably marks either/category markets). ' both' guards the one junk vector
  // un-banning 'and' opens: multi-team conjunctions ("France and Spain both reach").
  const lower = name.toLowerCase()
  const banned = [
    ' will', 'will ', ' not', ' be ', ' a ', ' an ', 'country', 'champion',
    'first time', 'first-time', 'south american', 'european', 'next', 'team',
    'nation', 'continent', 'host', 'group', 'either', ' or ', ' both', 'player',
  ]
  if (banned.some((b) => lower.includes(b))) return null

  // A contender name should be Title Case words only (letters, spaces, accents, punct).
  if (!/^[A-Z][A-Za-zÀ-ÿ.'\- ]*$/.test(name)) return null

  return name
}

// Build a single ranked list of contenders for 'simple' topics.
export async function getSimpleTopicOdds(slug: string): Promise<SimpleTopicOdds | null> {
  const topic = getOddsTopic(slug)
  if (!topic) return null

  const orFilter = topic.match.any.map((t) => `question.ilike.%${t}%`).join(',')
  let query = supabaseAdmin
    .from('markets')
    .select('id, platform, question, probability, volume, volume_label, category')
    .eq('status', 'active')
    .or(orFilter)
    .order('volume', { ascending: false, nullsFirst: false })
    .limit(200)
  if (topic.match.category) query = query.eq('category', topic.match.category)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const excludes = (topic.match.exclude || []).map((e) => e.toLowerCase())
  const rows = (data as MarketRow[] || [])
    .filter((m) => m.probability != null)
    .filter((m) => {
      const q = (m.question || '').toLowerCase()
      return !excludes.some((e) => q.includes(e))
    })
    .map((m) => ({
      id: m.id,
      platform: m.platform,
      question: m.question,
      probability: Math.round((m.probability as number) * 100),
    }))

  // Group by contender name, dedup across platforms (same engine shape as buildSection).
  // Rows we can't parse into a clean team name are DROPPED (not shown as junk).
  const groups = new Map<string, CandidateRow>()
  for (const r of rows) {
    const extracted = extractContender(r.question)
    if (!extracted) continue                 // not a single-team winner market -> drop
    const key = nameKey(extracted)
    let g = groups.get(key)
    if (!g) {
      g = { name: extracted, prices: [], topProbability: 0 }
      groups.set(key, g)
    }
    g.prices.push({ id: r.id, platform: r.platform, probability: r.probability })
    if (r.probability > g.topProbability) g.topProbability = r.probability
  }

  const all = [...groups.values()]
  for (const g of all) {
    g.prices.sort((a, b) => b.probability - a.probability)
    g.topProbability = headlineProb(g.prices)
  }
  all.sort((a, b) => b.topProbability - a.topProbability)
  const shown = all.filter((g) => g.topProbability >= THRESHOLD)
  const hiddenCount = all.length - shown.length

  // Decision-critical: how much of this is real-money vs play-money-only?
  const hasReal = (c: CandidateRow) => c.prices.some((p) => p.platform !== 'manifold')
  const realMoneyCount = shown.filter(hasReal).length
  const playOnlyCount = shown.length - realMoneyCount

  // Real-money-preferring headline.
  function realMoneyTop(c: CandidateRow): number | null {
    const real = c.prices.filter((p) => p.platform !== 'manifold')
    if (!real.length) return null
    return Math.max(...real.map((p) => p.probability))
  }
  let lead: { name: string; prob: number } | null = null
  for (const c of shown) {
    const rp = realMoneyTop(c)
    if (rp == null) continue
    if (!lead || rp > lead.prob) lead = { name: c.name, prob: rp }
  }
  const headline = lead
    ? `Prediction markets currently make ${lead.name} the favourite at around ${lead.prob}%.`
    : null

  return {
    slug,
    question: topic.question,
    structure: 'simple',
    threshold: THRESHOLD,
    contenders: shown,
    hiddenCount,
    realMoneyCount,
    playOnlyCount,
    headline,
    generatedAt: new Date().toISOString(),
  }
}
