// fingerprints.mjs — diagnose cross-platform matching: why so few pairs?
// 1) how many of the feed's `fingerprint`s span 2+ platforms (current matching power)
// 2) token-overlap (Jaccard) scan: cross-platform pairs the fingerprint MISSED
//    (similar wording, different fingerprint) = matches left on the table
//
// Run:  node fingerprints.mjs

const BASE = 'https://predacle.vercel.app'

const STOP = new Set(('will the a an to of in on at by for and or is be it as with win wins won winner ' +
  'above below over under more less than vs versus end this next year market price after before ' +
  '2024 2025 2026 2027 2028 who what when which whether be').split(/\s+/))

function tokens(q) {
  return [...new Set((q || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(t => t && t.length > 2 && !STOP.has(t)))]
}
function jaccard(a, b) {
  const B = new Set(b); let inter = 0
  for (const x of a) if (B.has(x)) inter++
  return inter / (a.length + b.length - inter || 1)
}

async function fetchAll() {
  const all = []; let page = 1, total = 1
  do {
    const j = await (await fetch(`${BASE}/api/markets?limit=100&page=${page}&cb=${Date.now()}`)).json()
    all.push(...(j.markets || [])); total = j.totalPages || 1
    process.stderr.write(`  page ${page}/${total}\r`); page++
  } while (page <= total && page <= 40)
  process.stderr.write('\n'); return all
}

const m = await fetchAll()
console.log(`total markets: ${m.length}`)

// (1) current fingerprint matching power
const byFp = {}
for (const x of m) (byFp[x.fingerprint] ||= new Set()).add(x.platform)
const fpCross = Object.entries(byFp).filter(([, p]) => p.size >= 2)
console.log(`distinct fingerprints           : ${Object.keys(byFp).length}`)
console.log(`fingerprints on 2+ platforms    : ${fpCross.length}   <- current cross-platform matches`)

// (2) fuzzy token-overlap, bucketed by category for speed + precision
const withTok = m.map(x => ({ ...x, tok: tokens(x.question) }))
const byCat = {}
for (const x of withTok) (byCat[x.category || '_'] ||= []).push(x)

const missed = []
for (const arr of Object.values(byCat)) {
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j]
      if (a.platform === b.platform || a.fingerprint === b.fingerprint) continue
      const sim = jaccard(a.tok, b.tok)
      if (sim >= 0.5) missed.push({ sim, a, b })
    }
}
missed.sort((x, y) => y.sim - x.sim)

console.log(`\npairs MISSED by fingerprint (cross-platform, same category, Jaccard >= 0.5): ${missed.length}`)
console.log(`vs ${fpCross.length} currently matched — i.e. potential pool is much larger.\n`)
console.log('Top examples (judge how many are truly the same event):')
for (const { sim, a, b } of missed.slice(0, 20)) {
  console.log(`  ${(sim * 100).toFixed(0)}%  [${a.platform}] ${a.question.slice(0, 58)}`)
  console.log(`        [${b.platform}] ${b.question.slice(0, 58)}`)
}
