#!/usr/bin/env node
/*
 * test-realmoney.mjs
 * Read-only. Maps where REAL-MONEY platforms overlap, so we can see how much
 * genuine real-to-real arbitrage is possible. Changes nothing.
 *
 * Run:  node test-realmoney.mjs
 */

const BASE = 'https://predacle.vercel.app'
const REAL = ['polymarket', 'kalshi', 'limitless', 'myriad', 'azuro']
const isReal = (p) => REAL.includes(p)

/* ---- matcher (same logic as test-matcher.mjs) ---------------------------- */
const TICKERS = [
  ['btc','bitcoin'],['eth','ethereum'],['sol','solana'],['doge','dogecoin'],
  ['xrp','ripple'],['ada','cardano'],['bnb','binance'],['matic','polygon'],['avax','avalanche'],
]
const PRICE_ASSETS = ['bitcoin','ethereum','solana','dogecoin','ripple','cardano','binance','polygon','avalanche']

function normalize(q) {
  let s = ' ' + String(q || '').toLowerCase() + ' '
  for (const [a, b] of TICKERS) s = s.replace(new RegExp(`\\b${a}\\b`, 'g'), b)
  s = s.replace(/(\d)\.(\d{3})\b/g, '$1$2')
  return s
}
function extractThresholds(s) {
  const vals = []
  const re = /\$?\s?(\d+(?:\.\d+)?)\s?(k|m|b)\b|\$\s?(\d{1,3}(?:,\d{3})+|\d{4,})/gi
  let m
  while ((m = re.exec(s)) !== null) {
    if (m[1] && m[2]) {
      const n = parseFloat(m[1]); const u = m[2].toLowerCase()
      vals.push(Math.round(n * (u === 'k' ? 1e3 : u === 'm' ? 1e6 : 1e9)))
    } else if (m[3]) vals.push(Math.round(parseFloat(m[3].replace(/,/g, ''))))
  }
  return vals
}
function extractDirection(s) {
  if (/\b(below|under|dip|drop to|fall to|less than|lower than|cheaper)\b/.test(s)) return 'down'
  if (/\b(above|over|reach|hit|exceed|surpass|cross|greater|higher than|at least|more than|top)\b/.test(s)) return 'up'
  return 'up'
}
const MONTHS = { january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12 }
function extractPeriod(s, endDate) {
  let year = null
  const ym = s.match(/\b(20\d{2})\b/); if (ym) year = parseInt(ym[1])
  let month = null
  const bm = s.match(/\bbefore\s+([a-z]+)/)
  if (bm && MONTHS[bm[1]] !== undefined) { month = MONTHS[bm[1]] - 1; if (month === 0) { month = 12; if (year) year -= 1 } }
  if (month === null) for (const name in MONTHS) { if (new RegExp(`\\b${name}\\b`).test(s)) { month = MONTHS[name]; break } }
  if (!year && endDate) year = parseInt(String(endDate).slice(0, 4))
  if (!year) return null
  if (month === null) { if (ym) month = 12; else if (endDate) month = parseInt(String(endDate).slice(5, 7)); else return null }
  return `${year}-${String(month).padStart(2, '0')}`
}
function structuredKey(q, endDate) {
  const s = normalize(q)
  const asset = PRICE_ASSETS.find(a => new RegExp(`\\b${a}\\b`).test(s))
  if (!asset) return null
  const ths = extractThresholds(s); if (ths.length !== 1) return null
  const period = extractPeriod(s, endDate); if (!period) return null
  return `P:${asset}|${extractDirection(s)}|${ths[0]}|${period}`
}
function legacyKey(q) {
  const stop = new Set(['will','the','a','an','in','on','to','be','by','at','of','for','is','are','was','were','has','have','had','do','does','did','this','that','with','from','and','or','not','it','its','above','below','hit','over','under','than','before','after','end','year','month','week','day','time','still','ever','going','able','likely','expected','predicted','market'])
  return String(q || '').toLowerCase()
    .replace(/\bbtc\b/g,'bitcoin').replace(/\beth\b/g,'ethereum').replace(/\bsol\b/g,'solana').replace(/\bdoge\b/g,'dogecoin').replace(/\bxrp\b/g,'ripple').replace(/\bada\b/g,'cardano').replace(/\bbnb\b/g,'binance').replace(/\bmatic\b/g,'polygon').replace(/\bavax\b/g,'avalanche')
    .replace(/\$(\d+(\.\d+)?)k\b/g,(_,n)=>String(Math.round(parseFloat(n)*1000)))
    .replace(/\$(\d+(\.\d+)?)m\b/g,(_,n)=>String(Math.round(parseFloat(n)*1000000)))
    .replace(/\$(\d+(\.\d+)?)b\b/g,(_,n)=>String(Math.round(parseFloat(n)*1000000000)))
    .replace(/,(\d{3})/g,'$1').replace(/\$/g,'')
    .replace(/\bfederal reserve\b/g,'fed').replace(/\bfomc\b/g,'fed')
    .replace(/\brate hike\b/g,'rate increase').replace(/\brate cut\b/g,'rate decrease').replace(/\braise rates?\b/g,'rate increase').replace(/\bcut rates?\b/g,'rate decrease').replace(/\blower rates?\b/g,'rate decrease')
    .replace(/\bpresidential election\b/g,'president election').replace(/\bus president\b/g,'president').replace(/\bpotus\b/g,'president').replace(/\bwhite house\b/g,'president')
    .replace(/\brepublican\b/g,'gop').replace(/\bdemocrat\b/g,'dem')
    .replace(/\bsuperbowl\b/g,'super bowl').replace(/\bnfl championship\b/g,'super bowl')
    .replace(/\bwinner\b/g,'win').replace(/\bwins\b/g,'win').replace(/\bwinning\b/g,'win')
    .replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2&&!stop.has(w)).sort().join('-')
}
function newKey(q, endDate) { return structuredKey(q, endDate) || ('K:' + legacyKey(q)) }

/* ---- fetch all ----------------------------------------------------------- */
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

/* ---- reports ------------------------------------------------------------- */
;(async () => {
  console.error('Fetching all active markets...')
  const markets = await fetchAll()

  // (A) coverage map: platform -> category counts
  console.log('\n===== (A) COVERAGE MAP (where overlap is even possible) =====')
  const cov = {}
  for (const m of markets) {
    const p = m.platform || '?', c = m.category || 'uncategorized'
    ;(cov[p] ||= {})[c] = (cov[p][c] || 0) + 1
  }
  for (const p of Object.keys(cov).sort()) {
    const tag = isReal(p) ? 'REAL' : 'play'
    const parts = Object.entries(cov[p]).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`)
    console.log(`${p.padEnd(11)}[${tag}]  ${parts.join(', ')}`)
  }

  // (B) structure: how many clean threshold (P:) vs messy (K:) per platform
  console.log('\n===== (B) MARKET STRUCTURE per platform (P=clean threshold, K=other) =====')
  const struct = {}
  for (const m of markets) {
    const p = m.platform || '?'
    const isP = newKey(m.question, m.end_date).startsWith('P:')
    ;(struct[p] ||= { P: 0, K: 0 })[isP ? 'P' : 'K']++
  }
  for (const p of Object.keys(struct).sort()) {
    console.log(`${p.padEnd(11)} clean-threshold: ${String(struct[p].P).padStart(4)}   other: ${struct[p].K}`)
  }

  // (C) cross-platform groups, split by money type
  const groups = {}
  for (const m of markets) {
    const k = newKey(m.question, m.end_date)
    if (!k || k === 'K:') continue
    ;(groups[k] ||= []).push(m)
  }
  const realReal = [], realPlay = []
  for (const [k, arr] of Object.entries(groups)) {
    const plats = [...new Set(arr.map(m => m.platform))]
    if (plats.length < 2) continue
    if (plats.filter(isReal).length >= 2) realReal.push([k, arr, plats])
    else realPlay.push([k, arr, plats])
  }

  console.log('\n===== (C) CROSS-PLATFORM GROUPS =====')
  console.log(`REAL-to-REAL groups (the prize): ${realReal.length}`)
  console.log(`Groups involving play money     : ${realPlay.length}\n`)

  if (realReal.length) {
    console.log('--- REAL-to-REAL detail ---')
    for (const [k, arr] of realReal) {
      console.log(`[${k}]   platforms: ${[...new Set(arr.map(m => m.platform))].join(', ')}`)
      for (const m of arr) {
        const pct = (m.probability != null) ? String(Math.round(m.probability * 100)).padStart(3) + '%' : '  ?'
        console.log(`   ${(m.platform || '').padEnd(11)} ${pct}  ${String(m.question).slice(0, 70)}`)
      }
      console.log('')
    }
  } else {
    console.log('(none under current matching — the reports above explain why)')
  }
})()
