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
  topProbability: number   // max across platforms, for sorting + threshold
}

export interface OddsSection {
  rows: CandidateRow[]
  hiddenCount: number      // candidates below THRESHOLD, summarised not listed
}

export interface TopicOdds {
  slug: string
  question: string
  threshold: number
  sections: { party: OddsSection; nomination: OddsSection; election: OddsSection }
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

function buildSection(
  rows: { id: string; platform: string; question: string; probability: number }[],
  partyMode = false,
): OddsSection {
  // Group by normalised candidate name; ungroupable rows become their own group.
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

  const all = Array.from(groups.values()).sort((a, b) => b.topProbability - a.topProbability)
  // Dedup prices within a candidate (same platform twice -> keep highest).
  for (const c of all) {
    const byPlat = new Map<string, PlatformPrice>()
    for (const p of c.prices.sort((x, y) => y.probability - x.probability)) {
      if (!byPlat.has(p.platform)) byPlat.set(p.platform, p)
    }
    c.prices = Array.from(byPlat.values())
  }

  const shown = all.filter((c) => c.topProbability >= THRESHOLD)
  return { rows: shown, hiddenCount: all.length - shown.length }
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
  const nomination = buildSection(rows.filter((r) => r.bucket === 'nomination'))
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
