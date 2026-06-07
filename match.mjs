// match.mjs — cross-platform market matcher (v2).
// Bucket by EXACT discriminators (threshold + date), then within a bucket two markets
// match only if: not a prop, their "Will X ..." SUBJECT agrees (when both have one),
// dates are close, and weighted topic similarity (rare tokens weighted higher) clears a bar.
//
// Library:  import { matchMarkets } from './match.mjs'
// CLI:      node match.mjs

export const BASE = 'https://predacle.vercel.app'
export const REAL = ['polymarket', 'kalshi', 'limitless', 'myriad', 'azuro']
const isReal = (p) => REAL.includes(p)

// prop / non-match-winner markets to exclude from same-market matching
const PROP_RE = /(set handicap|set \d+ winner|odd\/even|first inning|run scored|team to score|to score first|completed match|handicap|over\/under|total (points|runs)|spread|moneyline|strikeouts?|home runs?)/i

const UNIT = { k:1e3, thousand:1e3, m:1e6, million:1e6, b:1e9, bn:1e9, billion:1e9, t:1e12, tn:1e12, trillion:1e12 }
const toVal = (n, u) => { let v = parseFloat(String(n).replace(/,/g, '')); const x = u && UNIT[u.toLowerCase()]; return x ? v * x : v }

export function extractThreshold(q) {
  const s = (q || '').toLowerCase()
  let m = s.match(/\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:-|–|—|to)\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(trillion|billion|million|thousand|tn|bn|[tbmk])?\b/)
  if (m) { const lo = toVal(m[1], m[3]), hi = toVal(m[2], m[3]); if (!(lo >= 1900 && lo <= 2100 && !m[3])) return `range:${lo}:${hi}` }
  m = s.match(/(above|over|greater than|more than|at least|exceeds?|>=|≥|below|under|less than|fewer than|at most|<=|≤|exactly|hits?|reach(?:es)?)\s*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(trillion|billion|million|thousand|tn|bn|[tbmk]|%)?\b/)
  if (m) { const pct = m[3] === '%'; const v = pct ? parseFloat(m[2]) / 100 : toVal(m[2], m[3])
    if (!pct && !m[3] && v >= 1900 && v <= 2100) return ''
    const cmp = /below|under|less|fewer|at most|<=|≤/.test(m[1]) ? 'lt' : /exactly/.test(m[1]) ? 'eq' : 'gt'
    return `${cmp}:${v}` }
  m = s.match(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(trillion|billion|million|thousand|tn|bn|[tbmk])?\b/)
  if (m) return `val:${toVal(m[1], m[2])}`
  return ''
}

const BASE_STOP = 'will the a an to of in on at by for and or is be it as with who what when which whether this next year end market price close closing cap before after between game games match'.split(/\s+/)
const MONTHS = 'january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec'.split(/\s+/)
const EXTRA = 'above over below under than more less fewer least most exactly trillion billion million thousand reach reaches hit hits exceed exceeds win wins won winner lose loses lost q1 q2 q3 q4'.split(/\s+/)
const STOP = new Set([...BASE_STOP, ...MONTHS, ...EXTRA])
const toks = (s) => [...new Set((s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !STOP.has(t) && !/^\d/.test(t)))]
export const topicTokens = toks

// subject of a "Will X <verb> ..." market — the thing the market is about
const SUBJ_VERBS = 'win wins won winning be become becomes became reach reaches reached exceed exceeds hit hits pass passes passed surpass get gets got make makes made lose loses lost see sees saw beat beats defeat defeats finish finishes'.split(/\s+/)
const SUBJ_RE = new RegExp(`\\bwill\\s+(?:the\\s+)?(.+?)\\s+(?:${SUBJ_VERBS.join('|')})\\b`, 'i')
export function extractSubject(q) {
  const m = (q || '').match(SUBJ_RE)
  return m ? toks(m[1]) : []
}
const share = (a, b) => a.some(t => b.includes(t))

function unionFind(n, edge) {
  const p = Array.from({ length: n }, (_, i) => i)
  const find = (x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x] } return x }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (edge(i, j)) p[find(i)] = find(j)
  const g = {}; for (let i = 0; i < n; i++) (g[find(i)] ||= []).push(i)
  return Object.values(g)
}

export function matchMarkets(markets, { topicSim = 0.5, nearTolDays = 0, farTolDays = 3, horizonCutDays = 14, now = Date.now() } = {}) {
  // dedupe by platform + question + end_date (date-aware so recurring markets aren't over-merged)
  const seen = new Set(); const ded = []; let dupes = 0
  for (const m of markets) {
    const k = m.platform + '|' + (m.question || '').toLowerCase().replace(/\s+/g, ' ').trim() + '|' + (m.end_date || '').slice(0, 10)
    if (seen.has(k)) { dupes++; continue }
    seen.add(k); ded.push(m)
  }
  // drop prop markets
  let props = 0
  const kept = ded.filter(m => { if (PROP_RE.test(m.question || '')) { props++; return false } return true })

  const ann = kept.map(m => ({ ...m, _th: extractThreshold(m.question), _date: (m.end_date || '').slice(0, 10), _tok: toks(m.question), _subj: extractSubject(m.question) }))

  const N = ann.length, df = {}
  for (const a of ann) for (const t of a._tok) df[t] = (df[t] || 0) + 1
  const idf = (t) => Math.log((N + 1) / ((df[t] || 0) + 1)) + 1
  const wsim = (A, B) => { const sA = new Set(A), sB = new Set(B); let inter = 0, uni = 0
    for (const t of sA) { uni += idf(t); if (sB.has(t)) inter += idf(t) }
    for (const t of sB) if (!sA.has(t)) uni += idf(t)
    return uni ? inter / uni : 0 }

  const buckets = {}; for (const a of ann) (buckets[a._th] ||= []).push(a)
  const DAY = 864e5
  const clusters = []
  for (const arr of Object.values(buckets)) {
    const groups = unionFind(arr.length, (i, j) => {
      const a = arr[i], b = arr[j]
      if (a._date && b._date) {
        const da = Date.parse(a._date), db = Date.parse(b._date)
        if (Number.isFinite(da) && Number.isFinite(db)) {
          const horizon = (Math.min(da, db) - now) / DAY              // days until the sooner event
          const tol = (horizon < horizonCutDays ? nearTolDays : farTolDays) * DAY
          if (Math.abs(da - db) > tol) return false                  // near-term: exact; far: a few days slack
        }
      }
      if (a._subj.length && b._subj.length && !share(a._subj, b._subj)) return false   // subjects disagree -> different market
      return wsim(a._tok, b._tok) >= topicSim
    })
    for (const g of groups) clusters.push(g.map(i => arr[i]))
  }

  const platformsOf = (g) => [...new Set(g.map(x => x.platform))]
  const crossClusters = clusters.filter(g => platformsOf(g).length >= 2)
  const realClusters = crossClusters.filter(g => platformsOf(g).filter(isReal).length >= 2)
  return { clusters, crossClusters, realClusters,
    stats: { total: markets.length, dupesRemoved: dupes, propsRemoved: props, afterClean: ann.length,
             clusters: clusters.length, crossPlatform: crossClusters.length, crossRealMoney: realClusters.length } }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fetchAll = async () => { const all = []; let page = 1, total = 1
    do { const j = await (await fetch(`${BASE}/api/markets?limit=100&page=${page}&cb=${Date.now()}`)).json()
      all.push(...(j.markets || [])); total = j.totalPages || 1; process.stderr.write(`  page ${page}/${total}\r`); page++ }
    while (page <= total && page <= 40); process.stderr.write('\n'); return all }
  const markets = await fetchAll()
  const { stats, crossClusters, realClusters } = matchMarkets(markets, { topicSim: Number(process.env.TOPIC_SIM ?? 0.5), nearTolDays: Number(process.env.NEAR_TOL ?? 0), farTolDays: Number(process.env.FAR_TOL ?? 3) })
  const repByPlatform = (g) => { const b = {}; for (const m of g) { const v = m.volume || 0; if (!b[m.platform] || v > (b[m.platform].volume || 0)) b[m.platform] = m } return b }
  const reps = (g) => Object.values(repByPlatform(g))
  const spread = (g) => { const ps = reps(g).map(x => x.probability).filter(x => x != null); return ps.length > 1 ? Math.max(...ps) - Math.min(...ps) : 0 }
  const suspect = (g) => reps(g).some(m => m.probability === 0 || m.probability === 1)
  console.log('\n================= MATCH SUMMARY =================')
  console.log(`markets (raw)             : ${stats.total}`)
  console.log(`dupes removed             : ${stats.dupesRemoved}    props removed: ${stats.propsRemoved}`)
  console.log(`clusters total            : ${stats.clusters}`)
  console.log(`cross-platform clusters   : ${stats.crossPlatform}   (old fingerprint method: 3)`)
  console.log(`  real-money 2+           : ${stats.crossRealMoney}`)
  console.log('================================================\n')
  const show = (list, title, n) => {
    const sorted = [...list].sort((a, b) => spread(b) - spread(a))
    console.log(`===== ${title} — ranked by price spread (showing ${Math.min(n, sorted.length)} of ${sorted.length}) =====`)
    for (const g of sorted.slice(0, n)) {
      const flag = suspect(g) ? '  \u26a0 suspect price (0/100% = feed bug)' : ''
      console.log(`\u2022 spread ${(spread(g) * 100).toFixed(0)}pt  [${[...new Set(g.map(x => x.platform))].join(', ')}]  th=${g[0]._th || 'binary'}  date=${g[0]._date || '?'}${flag}`)
      const rep = repByPlatform(g)
      for (const p of Object.keys(rep)) {
        const m = rep[p]; const extra = g.filter(x => x.platform === p).length - 1
        console.log(`    ${p.padEnd(11)} ${(m.probability * 100).toFixed(0).padStart(3)}%  ${m.question.slice(0, 54)}${extra > 0 ? `  (+${extra} more)` : ''}`)
      }
    }
    console.log('')
  }
  show(realClusters, 'REAL-MONEY CROSS-PLATFORM CLUSTERS', 25)
  show(crossClusters, 'ALL CROSS-PLATFORM CLUSTERS', 20)
}
