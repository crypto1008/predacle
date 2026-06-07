#!/usr/bin/env node
/*
 * test-h2h.mjs (live-book edition) — one-shot scan + print.
 * Logic lives in scan.mjs. Needs scan.mjs + books.mjs in the same folder.
 * Run:  node test-h2h.mjs
 */
import { scanOnce, THRESHOLD } from './scan.mjs'

const pct = (x) => (x * 100).toFixed(1)

console.error('Fetching all active markets...')
const { summary, matchups } = await scanOnce({ quiet: false })

console.log('\n===================== SUMMARY =====================')
console.log(`Head-to-head markets parsed : ${summary.h2hCount}`)
console.log(`Distinct matchups (pairs)   : ${summary.pairs}`)
console.log(`Matchups on 2+ platforms    : ${summary.cross}`)
console.log(`Matchups on 2+ REAL-money   : ${summary.realReal}`)
console.log('===================================================\n')

if (!matchups.length) { console.log('(no real-to-real matchups right now)\n'); process.exit(0) }
console.log(`===== REAL-to-REAL MATCHUPS (live order-book asks, fees in, threshold ${(THRESHOLD * 100).toFixed(0)}%) =====\n`)

for (const m of matchups) {
  console.log(`${m.n1} vs ${m.n2}   [${m.platforms.join(', ')}]`)
  for (const e of m.displayEntries)
    console.log(`   ${e.platform.padEnd(11)} feed≈${(e.prob * 100).toFixed(0)}%  ${e.q.slice(0, 50)}`)
  for (const n of m.notes) console.log(`   · ${n}`)
  const side = (n) => {
    const opts = m.sides[n].map(o => `${pct(o.ask)}% ${o.platform}(${o.label})`).join('  |  ')
    console.log(`   ${n} asks: ${opts || '(none)'}`)
  }
  side(m.n1); side(m.n2)
  if (m.status === 'unpriceable') {
    console.log(`   -> ${m.verdict}\n`)
  } else {
    console.log(`   -> buy ${m.n1} @${pct(m.best1.cost)}% (${m.best1.platform}) + ${m.n2} @${pct(m.best2.cost)}% (${m.best2.platform})  =>  ${m.verdict}\n`)
  }
}
