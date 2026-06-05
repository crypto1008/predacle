#!/usr/bin/env node
/*
 * test-matcher.mjs
 * Tests a NEW market-matching ("fingerprint") strategy against your LIVE data.
 * It changes NOTHING — it only reads from your public API and prints what WOULD match.
 *
 * Run:  node test-matcher.mjs
 */

const BASE = 'https://predacle.vercel.app'

/* ----------------------------------------------------------------------------
 * 1. NORMALIZATION (shared)
 * -------------------------------------------------------------------------- */
const TICKERS = [
  ['btc', 'bitcoin'], ['eth', 'ethereum'], ['sol', 'solana'],
  ['doge', 'dogecoin'], ['xrp', 'ripple'], ['ada', 'cardano'],
  ['bnb', 'binance'], ['matic', 'polygon'], ['avax', 'avalanche'],
]

const PRICE_ASSETS = [
  'bitcoin', 'ethereum', 'solana', 'dogecoin', 'ripple',
  'cardano', 'binance', 'polygon', 'avalanche',
]

function normalize(q) {
  let s = ' ' + String(q || '').toLowerCase() + ' '
  for (const [a, b] of TICKERS) s = s.replace(new RegExp(`\\b${a}\\b`, 'g'), b)
  // European thousands "100.000" -> "100000"
  s = s.replace(/(\d)\.(\d{3})\b/g, '$1$2')
  return s
}

/* ----------------------------------------------------------------------------
 * 2. NEW STRUCTURED PRICE MATCHER
 *    key = P:<asset>|<direction>|<threshold>|<deadline-month>
 * -------------------------------------------------------------------------- */
function extractThresholds(s) {
  const vals = []
  const re = /\$?\s?(\d+(?:\.\d+)?)\s?(k|m|b)\b|\$\s?(\d{1,3}(?:,\d{3})+|\d{4,})/gi
  let m
  while ((m = re.exec(s)) !== null) {
    if (m[1] && m[2]) {
      const n = parseFloat(m[1])
      const u = m[2].toLowerCase()
      const mult = u === 'k' ? 1e3 : u === 'm' ? 1e6 : 1e9
      vals.push(Math.round(n * mult))
    } else if (m[3]) {
      vals.push(Math.round(parseFloat(m[3].replace(/,/g, ''))))
    }
  }
  return vals
}

function extractDirection(s) {
  if (/\b(below|under|dip|drop to|fall to|less than|lower than|cheaper)\b/.test(s)) return 'down'
  if (/\b(above|over|reach|hit|exceed|surpass|cross|greater|higher than|at least|more than|top)\b/.test(s)) return 'up'
  return 'up' // "Bitcoin $80K in June?" implies reach/up
}

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

function extractPeriod(s, endDate) {
  // year from text, else from end_date, else 2026
  let year = null
  const ym = s.match(/\b(20\d{2})\b/)
  if (ym) year = parseInt(ym[1])

  // "before <month>" => deadline is the month BEFORE it
  let month = null
  const bm = s.match(/\bbefore\s+([a-z]+)/)
  if (bm && MONTHS[bm[1]] !== undefined) {
    month = MONTHS[bm[1]] - 1
    if (month === 0) { month = 12; if (year) year -= 1 }
  }
  // otherwise first explicit month name
  if (month === null) {
    for (const name in MONTHS) {
      if (new RegExp(`\\b${name}\\b`).test(s)) { month = MONTHS[name]; break }
    }
  }

  if (!year && endDate) year = parseInt(String(endDate).slice(0, 4))
  if (!year) return null

  // no month in text: a bare year means "by year-end" => December
  if (month === null) {
    if (ym) month = 12
    else if (endDate) month = parseInt(String(endDate).slice(5, 7))
    else return null
  }
  return `${year}-${String(month).padStart(2, '0')}`
}

function structuredKey(question, endDate) {
  const s = normalize(question)
  const asset = PRICE_ASSETS.find(a => new RegExp(`\\b${a}\\b`).test(s))
  if (!asset) return null
  const ths = extractThresholds(s)
  if (ths.length !== 1) return null              // 0 = no threshold; 2+ = "X before Y" type
  const period = extractPeriod(s, endDate)
  if (!period) return null
  const dir = extractDirection(s)
  return `P:${asset}|${dir}|${ths[0]}|${period}`
}

/* ----------------------------------------------------------------------------
 * 3. LEGACY KEYWORD MATCHER (exact copy of what's live now) = fallback
 * -------------------------------------------------------------------------- */
function legacyKey(question) {
  const stopwords = new Set([
    'will','the','a','an','in','on','to','be','by','at','of','for',
    'is','are','was','were','has','have','had','do','does','did',
    'this','that','with','from','and','or','not','it','its',
    'above','below','hit','over','under','than','before','after',
    'end','year','month','week','day','time','still','ever',
    'going','able','likely','expected','predicted','market',
  ])
  return String(question || '')
    .toLowerCase()
    .replace(/\bbtc\b/g, 'bitcoin').replace(/\beth\b/g, 'ethereum')
    .replace(/\bsol\b/g, 'solana').replace(/\bdoge\b/g, 'dogecoin')
    .replace(/\bxrp\b/g, 'ripple').replace(/\bada\b/g, 'cardano')
    .replace(/\bbnb\b/g, 'binance').replace(/\bmatic\b/g, 'polygon')
    .replace(/\bavax\b/g, 'avalanche')
    .replace(/\$(\d+(\.\d+)?)k\b/g, (_, n) => String(Math.round(parseFloat(n) * 1000)))
    .replace(/\$(\d+(\.\d+)?)m\b/g, (_, n) => String(Math.round(parseFloat(n) * 1000000)))
    .replace(/\$(\d+(\.\d+)?)b\b/g, (_, n) => String(Math.round(parseFloat(n) * 1000000000)))
    .replace(/,(\d{3})/g, '$1').replace(/\$/g, '')
    .replace(/\bfederal reserve\b/g, 'fed').replace(/\bfomc\b/g, 'fed')
    .replace(/\brate hike\b/g, 'rate increase').replace(/\brate cut\b/g, 'rate decrease')
    .replace(/\braise rates?\b/g, 'rate increase').replace(/\bcut rates?\b/g, 'rate decrease')
    .replace(/\blower rates?\b/g, 'rate decrease')
    .replace(/\bpresidential election\b/g, 'president election')
    .replace(/\bus president\b/g, 'president').replace(/\bpotus\b/g, 'president')
    .replace(/\bwhite house\b/g, 'president')
    .replace(/\brepublican\b/g, 'gop').replace(/\bdemocrat\b/g, 'dem')
    .replace(/\bsuperbowl\b/g, 'super bowl').replace(/\bnfl championship\b/g, 'super bowl')
    .replace(/\bwinner\b/g, 'win').replace(/\bwins\b/g, 'win').replace(/\bwinning\b/g, 'win')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w))
    .sort()
    .join('-')
}

// NEW = structured if possible, else legacy
function newKey(question, endDate) {
  return structuredKey(question, endDate) || ('K:' + legacyKey(question))
}

/* ----------------------------------------------------------------------------
 * 4. FETCH ALL ACTIVE MARKETS
 * -------------------------------------------------------------------------- */
async function fetchAll() {
  const all = []
  let page = 1, totalPages = 1
  do {
    const url = `${BASE}/api/markets?limit=100&page=${page}&cb=${Date.now()}`
    const res = await fetch(url)
    const json = await res.json()
    const rows = json.markets || []
    all.push(...rows)
    totalPages = json.totalPages || 1
    process.stderr.write(`  fetched page ${page}/${totalPages} (${all.length} markets)\r`)
    page++
  } while (page <= totalPages && page <= 40)
  process.stderr.write('\n')
  return all
}

/* ----------------------------------------------------------------------------
 * 5. GROUP + REPORT
 * -------------------------------------------------------------------------- */
function group(markets, keyFn) {
  const g = {}
  for (const m of markets) {
    const k = keyFn(m.question, m.end_date)
    if (!k || k === 'K:') continue
    ;(g[k] ||= []).push(m)
  }
  // keep only cross-platform groups
  const out = {}
  for (const [k, arr] of Object.entries(g)) {
    if (new Set(arr.map(m => m.platform)).size >= 2) out[k] = arr
  }
  return out
}

function gapPct(arr) {
  const ps = arr.map(m => m.probability).filter(p => p !== null && p !== undefined)
  if (ps.length < 2) return 0
  return Math.round((Math.max(...ps) - Math.min(...ps)) * 100)
}

;(async () => {
  console.error('Fetching all active markets...')
  const markets = await fetchAll()

  const oldGroups = group(markets, (q) => 'K:' + legacyKey(q))
  const newGroups = group(markets, newKey)

  const newPrice = Object.entries(newGroups).filter(([k]) => k.startsWith('P:'))
  const newKw    = Object.entries(newGroups).filter(([k]) => k.startsWith('K:'))

  console.log('\n===================== SUMMARY =====================')
  console.log(`Scanned ${markets.length} active markets`)
  console.log(`OLD matcher : ${Object.keys(oldGroups).length} cross-platform groups`)
  console.log(`NEW matcher : ${Object.keys(newGroups).length} cross-platform groups`)
  console.log(`              -> ${newPrice.length} from NEW price matching`)
  console.log(`              -> ${newKw.length} from keyword fallback`)
  console.log('===================================================\n')

  console.log('===== NEW PRICE-MATCH GROUPS (sorted by price gap) =====')
  console.log('(eyeball these: are the questions in each block really the SAME bet?)\n')
  newPrice
    .map(([k, arr]) => ({ k, arr, gap: gapPct(arr) }))
    .sort((a, b) => b.gap - a.gap)
    .forEach(({ k, arr, gap }) => {
      console.log(`[${k}]   gap ${gap}%`)
      for (const m of arr) {
        const pct = (m.probability !== null && m.probability !== undefined)
          ? String(Math.round(m.probability * 100)).padStart(3) + '%' : '  ?'
        console.log(`   ${(m.platform || '').padEnd(11)} ${pct}  ${String(m.question).slice(0, 72)}`)
      }
      console.log('')
    })

  console.log('===== KEYWORD-FALLBACK GROUPS (same as today, for reference) =====\n')
  newKw.forEach(([k, arr]) => {
    console.log(`[${k.slice(0, 60)}]   gap ${gapPct(arr)}%`)
    for (const m of arr) {
      console.log(`   ${(m.platform || '').padEnd(11)} ${String(m.question).slice(0, 72)}`)
    }
    console.log('')
  })
})()
