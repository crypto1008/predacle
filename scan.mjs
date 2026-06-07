// scan.mjs — shared scanning core. Exports scanOnce(). Used by test-h2h.mjs and watch.mjs.
import { kalshiAsks, polymarketAsks } from './books.mjs'

export const BASE = 'https://predacle.vercel.app'
export const REAL = ['polymarket', 'kalshi', 'limitless', 'myriad', 'azuro']
export const isReal = (p) => REAL.includes(p)
export const THRESHOLD = Number(process.env.THRESHOLD ?? 0.01) // net-edge buffer (asks already include fees)

const FEE = { kalshi: (p) => Math.ceil(0.07 * p * (1 - p) * 100) / 100, polymarket: () => 0 }
const feeOf = (plat, p) => (FEE[plat] ? FEE[plat](p) : 0)

const PROP_RE = /(set handicap|set \d+ winner|odd\/even|first inning|run scored|team to score|to score first|completed match|handicap|over\/under|total (points|runs)|spread)/i
const RIGHT_STOP = new Set([
  'professional','mma','fight','match','winner','win','won','scheduled',
  'semifinal','semifinals','final','finals','quarterfinal','game','completed',
  'set','handicap','the','for','at','on','vs','round','bout','title','to',
])
const clean = (t) => t.toLowerCase().replace(/[^a-z]/g, '')
const lastNameToken = (part) => {
  const toks = part.trim().split(/\s+/).map(clean).filter(Boolean)
  return toks.length ? toks[toks.length - 1] : null
}
function rightSurname(part) {
  const names = []
  for (const raw of part.trim().split(/\s+/)) {
    const t = clean(raw)
    if (!t) { if (names.length) break; else continue }
    if (RIGHT_STOP.has(t) || /\d/.test(raw)) break
    names.push(t)
  }
  return names.length ? names[names.length - 1] : null
}
function parseH2H(q) {
  if (!q || PROP_RE.test(q)) return null
  const s = q.toLowerCase().replace(/\bvs\.?\b/g, ' vs ').replace(/\s+/g, ' ')
  const idx = s.indexOf(' vs ')
  if (idx < 0) return null
  const a = lastNameToken(s.slice(0, idx))
  const b = rightSurname(s.slice(idx + 4))
  if (!a || !b || a === b || a.length < 3 || b.length < 3) return null
  let subject = null
  const wm = s.match(/\bwill\s+(.+?)\s+win\b/)
  if (wm) subject = lastNameToken(wm[1])
  return { a, b, subject, pair: [a, b].sort().join('|') }
}

async function fetchAll(quiet) {
  const all = []; let page = 1, totalPages = 1
  do {
    const res = await fetch(`${BASE}/api/markets?limit=100&page=${page}&cb=${Date.now()}`)
    const json = await res.json()
    all.push(...(json.markets || [])); totalPages = json.totalPages || 1
    if (!quiet) process.stderr.write(`  page ${page}/${totalPages} (${all.length})\r`); page++
  } while (page <= totalPages && page <= 40)
  if (!quiet) process.stderr.write('\n'); return all
}

async function liveAsks(g, n1, n2) {
  const sides = { [n1]: [], [n2]: [] }
  const notes = []
  for (const e of g.entries) {
    if (!isReal(e.platform)) continue
    try {
      if (e.platform === 'kalshi') {
        const k = await kalshiAsks(e.id)
        if (k.note) notes.push(`kalshi "${e.subject || e.a}" market: ${k.note}`)
        const subj = (e.subject === n1 || e.subject === n2) ? e.subject : e.a
        const opp = subj === n1 ? n2 : n1
        if (k.askYes != null) sides[subj].push({ platform: 'kalshi', label: `${subj} YES`, ask: k.askYes })
        if (k.askNo  != null) sides[opp].push({ platform: 'kalshi', label: `${subj} NO→${opp}`, ask: k.askNo })
      } else if (e.platform === 'polymarket') {
        const p = await polymarketAsks(e.id)
        if (p.closed) notes.push('polymarket: market CLOSED (resolved)')
        else if (p.acceptingOrders === false) notes.push('polymarket: not accepting orders (halted/resolved)')
        for (const [outcome, info] of Object.entries(p.outcomes)) {
          if (info.note) notes.push(`polymarket "${outcome}": ${info.note}${info.winner ? ' [WINNER]' : ''}`)
          if (info.ask == null) continue
          const oc = clean(outcome)
          let side = oc.includes(n1) ? n1 : oc.includes(n2) ? n2 : null
          if (!side) side = /^yes$/i.test(outcome) ? e.a : /^no$/i.test(outcome) ? e.b : null
          if (side === n1 || side === n2) sides[side].push({ platform: 'polymarket', label: outcome, ask: info.ask })
        }
      }
    } catch (err) { notes.push(`${e.platform} (${e.id}): ${err.message}`) }
  }
  return { sides, notes }
}

const bestLeg = (list) => list
  .map(x => ({ ...x, cost: x.ask + feeOf(x.platform, x.ask) }))
  .reduce((m, x) => (!m || x.cost < m.cost ? x : m), null)

// Returns { summary, matchups } where each matchup is fully scored.
export async function scanOnce({ quiet = false } = {}) {
  const markets = await fetchAll(quiet)
  const groups = {}
  let h2hCount = 0
  for (const m of markets) {
    const h = parseH2H(m.question)
    if (!h) continue
    h2hCount++
    const g = (groups[h.pair] ||= { platforms: new Set(), entries: [] })
    g.platforms.add(m.platform)
    g.entries.push({ platform: m.platform, id: m.id, a: h.a, b: h.b, subject: h.subject, q: m.question, prob: m.probability })
  }
  const cross = Object.entries(groups).filter(([, g]) => g.platforms.size >= 2)
  const realReal = cross.filter(([, g]) => [...g.platforms].filter(isReal).length >= 2)
  const summary = { h2hCount, pairs: Object.keys(groups).length, cross: cross.length, realReal: realReal.length }

  const matchups = []
  for (const [pair, g] of realReal) {
    const [n1, n2] = pair.split('|')
    const displayEntries = g.entries.filter(x => isReal(x.platform)).map(e => ({ platform: e.platform, prob: e.prob, q: e.q }))
    const { sides, notes } = await liveAsks(g, n1, n2)
    const best1 = bestLeg(sides[n1]), best2 = bestLeg(sides[n2])
    let edge = null, isCross = false, status = 'unpriceable', verdict = "can't price both sides (likely resolved/closed)"
    if (best1 && best2) {
      edge = 1 - (best1.cost + best2.cost)
      isCross = best1.platform !== best2.platform
      if (edge >= THRESHOLD && isCross) { status = 'candidate'; verdict = `ARB CANDIDATE net +${(edge * 100).toFixed(2)}% (${best1.platform}+${best2.platform})` }
      else if (edge > 0) { status = 'no-edge'; verdict = `+${(edge * 100).toFixed(2)}% — below ${(THRESHOLD * 100).toFixed(0)}% or same-venue` }
      else { status = 'no-edge'; verdict = `no edge (${(edge * 100).toFixed(2)}%)` }
    }
    matchups.push({ pair, n1, n2, platforms: [...g.platforms], displayEntries, sides, notes, best1, best2, edge, isCross, status, verdict })
  }
  return { summary, matchups }
}
