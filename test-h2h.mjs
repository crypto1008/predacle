#!/usr/bin/env node
/*
 * test-h2h.mjs
 * Read-only. Finds head-to-head matchups (tennis, MMA, person-vs-person) that
 * appear on 2+ platforms, aligns the two sides, and computes the real
 * cross-platform YES/NO arbitrage. Changes nothing.
 *
 * Run:  node test-h2h.mjs
 */

const BASE = 'https://predacle.vercel.app'
const REAL = ['polymarket', 'kalshi', 'limitless', 'myriad', 'azuro']
const isReal = (p) => REAL.includes(p)

// Markets that contain "vs" but are NOT match-winner bets -> skip
const PROP_RE = /(set handicap|set \d+ winner|odd\/even|first inning|run scored|team to score|to score first|completed match|handicap|over\/under|total (points|runs)|spread)/i

// Tokens on the right side that mark the end of the name
const RIGHT_STOP = new Set([
  'professional','mma','fight','match','winner','win','won','scheduled',
  'semifinal','semifinals','final','finals','quarterfinal','game','completed',
  'set','handicap','the','for','at','on','vs','round','bout','title','to',
])

const clean = (t) => t.toLowerCase().replace(/[^a-z]/g, '')

function lastNameToken(part) {
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

async function fetchAll() {
  const all = []; let page = 1, totalPages = 1
  do {
    const res = await fetch(`${BASE}/api/markets?limit=100&page=${page}&cb=${Date.now()}`)
    const json = await res.json()
    all.push(...(json.markets || [])); totalPages = json.totalPages || 1
    process.stderr.write(`  page ${page}/${totalPages} (${all.length})\r`); page++
  } while (page <= totalPages && page <= 40)
  process.stderr.write('\n'); return all
}

;(async () => {
  console.error('Fetching all active markets...')
  const markets = await fetchAll()

  const groups = {}
  let h2hCount = 0
  for (const m of markets) {
    const h = parseH2H(m.question)
    if (!h) continue
    h2hCount++
    const p = m.probability
    if (p == null) continue
    const g = (groups[h.pair] ||= { byName: {}, platforms: new Set(), entries: [] })
    g.platforms.add(m.platform)

    const costs = {}
    if (h.subject && (h.subject === h.a || h.subject === h.b)) {
      costs[h.subject] = p                 // "Will X win" -> direct cost of X
    } else {
      costs[h.a] = p                       // "A vs B" -> assume prob = P(first-named)
      costs[h.b] = 1 - p
    }
    for (const [name, c] of Object.entries(costs)) {
      (g.byName[name] ||= []).push({ platform: m.platform, cost: c })
    }
    g.entries.push({ platform: m.platform, costs, q: m.question, assumed: !h.subject })
  }

  // keep pairs that span 2+ platforms
  const cross = Object.entries(groups).filter(([, g]) => g.platforms.size >= 2)
  const realReal = cross.filter(([, g]) => [...g.platforms].filter(isReal).length >= 2)

  console.log('\n===================== SUMMARY =====================')
  console.log(`Head-to-head markets parsed : ${h2hCount}`)
  console.log(`Distinct matchups (pairs)   : ${Object.keys(groups).length}`)
  console.log(`Matchups on 2+ platforms    : ${cross.length}`)
  console.log(`Matchups on 2+ REAL-money   : ${realReal.length}   <-- the prize`)
  console.log('===================================================\n')

  const best = (arr) => arr.reduce((m, x) => (x.cost < m.cost ? x : m))

  function show(list, title) {
    if (!list.length) { console.log(`(${title}: none)\n`); return }
    console.log(`===== ${title} =====\n`)
    // compute edge for sorting
    const withEdge = list.map(([pair, g]) => {
      const [n1, n2] = pair.split('|')
      let edge = null, b1 = null, b2 = null
      if (g.byName[n1] && g.byName[n2]) {
        b1 = best(g.byName[n1]); b2 = best(g.byName[n2])
        edge = 1 - (b1.cost + b2.cost)
      }
      return { pair, g, edge, b1, b2, n1, n2 }
    }).sort((a, b) => (b.edge ?? -9) - (a.edge ?? -9))

    for (const { pair, g, edge, b1, b2, n1, n2 } of withEdge) {
      const plats = [...g.platforms].join(', ')
      console.log(`${n1} vs ${n2}   [${plats}]`)
      for (const e of g.entries) {
        const parts = Object.entries(e.costs).map(([n, c]) => `${n} ${(c * 100).toFixed(0)}%`).join(' / ')
        const flag = e.assumed ? '  (assumes prob = first-named)' : ''
        console.log(`   ${e.platform.padEnd(11)} ${parts.padEnd(28)} ${e.q.slice(0, 52)}${flag}`)
      }
      if (edge != null) {
        const cross = b1.platform !== b2.platform
        const tag = (edge > 0 && cross) ? `ARB EDGE ${(edge * 100).toFixed(1)}% (cross-platform)`
          : (edge > 0) ? `${(edge * 100).toFixed(1)}% but same platform (vig, not executable)`
          : 'no edge'
        console.log(`   -> cheapest ${n1}: ${(b1.cost * 100).toFixed(0)}% (${b1.platform}); cheapest ${n2}: ${(b2.cost * 100).toFixed(0)}% (${b2.platform})  =>  ${tag}`)
      }
      console.log('')
    }
  }

  show(realReal, 'REAL-to-REAL MATCHUPS (the prize)')

  const realPlay = cross.filter((x) => !realReal.includes(x))
  console.log(`(${realPlay.length} more matchups involve play money — not shown)\n`)
})()
