// test-leaderboard.mjs
// Standalone calibration/accuracy engine for the Phase 13 leaderboard.
// Zero production surface: reads market_resolutions, computes the metrics a
// leaderboard would rank on, and prints them grouped by platform and category.
// Goal: confirm the math is sound on real data (sports has plenty) BEFORE
// wiring any UI — and surface whether "final probability" is too easy a target.
//
// Run from the repo root:  node test-leaderboard.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// --- load env from .env.local (only proper UPPER_SNAKE names; skips PEM lines) ---
const env = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Could not find Supabase URL / key in .env.local. Found keys:', Object.keys(env).filter(k => k.includes('SUPABASE')))
  process.exit(1)
}
const supabase = createClient(url, key)

// --- metrics ---
// Brier score: mean squared error between predicted P(YES) and actual outcome.
// 0 = perfect, 0.25 = always guessing 50/50, 1 = confidently always wrong. Lower better.
function brier(rows) {
  if (!rows.length) return null
  return rows.reduce((a, r) => a + (r.p - r.o) ** 2, 0) / rows.length
}
// Accuracy: how often the favorite (>50%) was the side that actually happened.
function accuracy(rows) {
  if (!rows.length) return null
  return rows.filter(r => (r.p >= 0.5 ? 1 : 0) === r.o).length / rows.length
}
// Calibration curve: bucket predictions into 10% bins; a well-calibrated
// source has predicted% ≈ actual% in each bin.
function calibration(rows) {
  const bins = Array.from({ length: 10 }, () => ({ n: 0, yes: 0, psum: 0 }))
  for (const r of rows) {
    const i = Math.min(9, Math.max(0, Math.floor(r.p * 10)))
    bins[i].n++; bins[i].yes += r.o; bins[i].psum += r.p
  }
  return bins.map((b, i) => ({
    band: `${String(i * 10).padStart(2)}-${i * 10 + 10}%`,
    n: b.n,
    predicted: b.n ? (b.psum / b.n) * 100 : null,
    actual: b.n ? (b.yes / b.n) * 100 : null,
  }))
}

const pct = (x) => x == null ? '  -  ' : (x * 100).toFixed(1).padStart(5)
const f3 = (x) => x == null ? ' -  ' : x.toFixed(3)

function table(label, groups) {
  console.log(`\n=== ${label} ===`)
  console.log('  ' + 'group'.padEnd(16) + 'n'.padStart(6) + 'brier'.padStart(9) + 'accuracy'.padStart(11))
  const sorted = [...groups].sort((a, b) => (a.brier ?? 9) - (b.brier ?? 9))
  for (const g of sorted) {
    console.log('  ' + g.name.padEnd(16) + String(g.rows.length).padStart(6) +
      f3(brier(g.rows)).padStart(9) + (pct(accuracy(g.rows)) + '%').padStart(11))
  }
}

function groupBy(rows, keyFn) {
  const map = new Map()
  for (const r of rows) {
    const k = keyFn(r) || 'uncategorized'
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(r)
  }
  return [...map.entries()].map(([name, rows]) => ({ name, rows }))
}

async function main() {
  const { data, error } = await supabase
    .from('market_resolutions')
    .select('platform, category, resolved_outcome, final_probability')
    .limit(5000)
  if (error) { console.error('query error:', error.message); process.exit(1) }

  // Keep only clean binary outcomes with a usable probability.
  const rows = []
  let skipped = 0
  for (const r of data) {
    const out = String(r.resolved_outcome || '').trim().toLowerCase()
    const p = r.final_probability
    if ((out === 'yes' || out === 'no') && typeof p === 'number' && p >= 0 && p <= 1) {
      rows.push({ platform: r.platform, category: r.category, p, o: out === 'yes' ? 1 : 0 })
    } else skipped++
  }

  const yes = rows.filter(r => r.o === 1).length
  console.log('=== RESOLVED MARKETS LOADED ===')
  console.log(`clean binary resolutions: ${rows.length}  (yes ${yes} / no ${rows.length - yes})`)
  console.log(`skipped (scalar / no prob / bad outcome): ${skipped}`)

  table('BY PLATFORM (on final probability)', groupBy(rows, r => r.platform))
  table('BY CATEGORY (all platforms, final probability)', groupBy(rows, r => r.category))

  console.log('\n=== CALIBRATION CURVE (all rows, final probability) ===')
  console.log('  ' + 'predicted band'.padEnd(16) + 'n'.padStart(6) + 'avg pred'.padStart(10) + 'actual yes'.padStart(12))
  for (const b of calibration(rows)) {
    if (!b.n) continue
    console.log('  ' + b.band.padEnd(16) + String(b.n).padStart(6) + (pct(b.predicted / 100) + '%').padStart(10) + (pct(b.actual / 100) + '%').padStart(12))
  }

  // Methodology check: is final_probability too easy?
  const overall = brier(rows)
  console.log('\n=== READ ===')
  console.log(`overall Brier on final probability: ${f3(overall)}`)
  if (overall != null && overall < 0.05) {
    console.log('⚠  This is suspiciously near-perfect. final_probability is captured just before')
    console.log('   resolution, when markets have already converged to ~certainty — so this measures')
    console.log('   "did the price converge before close" (everything does), not forecasting skill.')
    console.log('   For the real leaderboard, score the probability at a fixed PRE-resolution horizon')
    console.log('   (e.g. 24h before resolved_at, pulled from price_snapshots). That is where skill shows.')
  } else {
    console.log('   (If this is in a realistic 0.10–0.20 range, final probability already carries signal.)')
  }
  console.log('\nEngine works. Numbers above are computed on REAL resolved markets.')
}

main()
