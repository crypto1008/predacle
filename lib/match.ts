// lib/match.ts — cross-platform market matcher (server port of match.mjs).
// Buckets by exact discriminators (threshold + horizon-aware date), then clusters
// within a bucket by subject agreement + weighted topic similarity. Replaces the
// brittle exact-fingerprint grouping.

export const REAL = ['polymarket', 'kalshi', 'limitless', 'myriad', 'azuro']
export const isReal = (p: string) => REAL.includes(p)

export interface MatchInput {
  id?: string
  platform: string
  question: string
  probability: number | null
  end_date?: string | null
  volume?: number | null
  [k: string]: any
}

const UNIT: Record<string, number> = {
  k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, tn: 1e12, trillion: 1e12,
}
const toVal = (n: string, u?: string) => {
  const v = parseFloat(String(n).replace(/,/g, ''))
  const x = u ? UNIT[u.toLowerCase()] : undefined
  return x ? v * x : v
}

export function extractThreshold(q: string): string {
  const s = (q || '').toLowerCase()
  let m = s.match(/\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:-|–|—|to)\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(trillion|billion|million|thousand|tn|bn|[tbmk])?\b/)
  if (m) { const lo = toVal(m[1], m[3]), hi = toVal(m[2], m[3]); if (!(lo >= 1900 && lo <= 2100 && !m[3])) return `range:${lo}:${hi}` }
  m = s.match(/(above|over|greater than|more than|at least|exceeds?|>=|≥|below|under|less than|fewer than|at most|<=|≤|exactly|hits?|reach(?:es)?)\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(trillion|billion|million|thousand|tn|bn|[tbmk]|%)?\b/)
  if (m) {
    const pct = m[3] === '%'
    const v = pct ? parseFloat(m[2]) / 100 : toVal(m[2], m[3])
    if (!pct && !m[3] && v >= 1900 && v <= 2100) return ''
    const cmp = /below|under|less|fewer|at most|<=|≤/.test(m[1]) ? 'lt' : /exactly/.test(m[1]) ? 'eq' : 'gt'
    return `${cmp}:${v}`
  }
  m = s.match(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(trillion|billion|million|thousand|tn|bn|[tbmk])?\b/)
  if (m) return `val:${toVal(m[1], m[2])}`
  return ''
}

const BASE_STOP = 'will the a an to of in on at by for and or is be it as with who what when which whether this next year end market price close closing cap before after between game games match'.split(/\s+/)
const MONTHS = 'january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec'.split(/\s+/)
const EXTRA = 'above over below under than more less fewer least most exactly trillion billion million thousand reach reaches hit hits exceed exceeds win wins won winner lose loses lost q1 q2 q3 q4'.split(/\s+/)
const STOP = new Set([...BASE_STOP, ...MONTHS, ...EXTRA])
export const topicTokens = (s: string): string[] =>
  [...new Set((s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !STOP.has(t) && !/^\d/.test(t)))]

const SUBJ_VERBS = 'win wins won winning be become becomes became reach reaches reached exceed exceeds hit hits pass passes passed surpass get gets got make makes made lose loses lost see sees saw beat beats defeat defeats finish finishes'.split(/\s+/)
const SUBJ_RE = new RegExp(`\\bwill\\s+(?:the\\s+)?(.+?)\\s+(?:${SUBJ_VERBS.join('|')})\\b`, 'i')
export const extractSubject = (q: string): string[] => {
  const m = (q || '').match(SUBJ_RE)
  return m ? topicTokens(m[1]) : []
}
const share = (a: string[], b: string[]) => a.some(t => b.includes(t))

function unionFind(n: number, edge: (i: number, j: number) => boolean): number[][] {
  const p = Array.from({ length: n }, (_, i) => i)
  const find = (x: number): number => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x] } return x }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (edge(i, j)) p[find(i)] = find(j)
  const g: Record<number, number[]> = {}
  for (let i = 0; i < n; i++) (g[find(i)] ||= []).push(i)
  return Object.values(g)
}

export interface MatchOptions { topicSim?: number; nearTolDays?: number; farTolDays?: number; horizonCutDays?: number; now?: number }

export function matchMarkets(markets: MatchInput[], opts: MatchOptions = {}) {
  const { topicSim = 0.5, nearTolDays = 0, farTolDays = 3, horizonCutDays = 14, now = Date.now() } = opts

  const seen = new Set<string>()
  const ded: MatchInput[] = []
  let dupes = 0
  for (const m of markets) {
    const k = m.platform + '|' + (m.question || '').toLowerCase().replace(/\s+/g, ' ').trim() + '|' + (m.end_date || '').slice(0, 10)
    if (seen.has(k)) { dupes++; continue }
    seen.add(k); ded.push(m)
  }

  const ann = ded.map(m => ({ ...m, _th: extractThreshold(m.question), _date: (m.end_date || '').slice(0, 10), _tok: topicTokens(m.question), _subj: extractSubject(m.question) })) as any[]

  const N = ann.length
  const df: Record<string, number> = {}
  for (const a of ann) for (const t of a._tok) df[t] = (df[t] || 0) + 1
  const idf = (t: string) => Math.log((N + 1) / ((df[t] || 0) + 1)) + 1
  const wsim = (A: string[], B: string[]) => {
    const sA = new Set(A), sB = new Set(B); let inter = 0, uni = 0
    for (const t of sA) { uni += idf(t); if (sB.has(t)) inter += idf(t) }
    for (const t of sB) if (!sA.has(t)) uni += idf(t)
    return uni ? inter / uni : 0
  }

  const buckets: Record<string, any[]> = {}
  for (const a of ann) (buckets[a._th] ||= []).push(a)
  const DAY = 864e5
  const clusters: any[][] = []
  for (const arr of Object.values(buckets)) {
    const groups = unionFind(arr.length, (i, j) => {
      const a = arr[i], b = arr[j]
      if (a._date && b._date) {
        const da = Date.parse(a._date), db = Date.parse(b._date)
        if (Number.isFinite(da) && Number.isFinite(db)) {
          const horizon = (Math.min(da, db) - now) / DAY
          const tol = (horizon < horizonCutDays ? nearTolDays : farTolDays) * DAY
          if (Math.abs(da - db) > tol) return false
        }
      }
      if (a._subj.length && b._subj.length && !share(a._subj, b._subj)) return false
      return wsim(a._tok, b._tok) >= topicSim
    })
    for (const g of groups) clusters.push(g.map(i => arr[i]))
  }

  const platformsOf = (g: any[]) => [...new Set(g.map(x => x.platform))]
  const crossClusters = clusters.filter(g => platformsOf(g).length >= 2)
  const realClusters = crossClusters.filter(g => platformsOf(g).filter(isReal).length >= 2)
  return {
    clusters, crossClusters, realClusters,
    stats: { total: markets.length, dupesRemoved: dupes, afterClean: ann.length, clusters: clusters.length, crossPlatform: crossClusters.length, crossRealMoney: realClusters.length },
  }
}
