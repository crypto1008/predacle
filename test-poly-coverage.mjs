// Polymarket coverage probe. Measures how deep the active catalog goes, how
// many markets we'd capture with deeper pagination, timing (30s cron budget),
// and whether the previously-dropped Iran markets become reachable. Compares
// ordering by volume24hr (current) vs cumulative volume (proposed).

const TARGET = {
  '0x593b3cf704fe60bd5a6c590fdd4875b470217cecf26647aa3a758da865e0c32d': 'Iran meeting by Jun 13',
  '0x2c13455a69bb77887fa900ea0e4d81da857c4bbb6a01d4cfc0a5c6637ad05683': 'Iran meeting by Jun 14',
  '0x35c73eb41a0ee54b49358c523a2d3335e9df5ee21bba9e526813a6fbaa0f70b6': 'Iran meeting by Jun 15',
  '0x258031a51215d328eac2db15bdf45abdee1a23d38d66e12462a83c34cf31b5c8': 'Iran meeting by Jul 31',
}

async function page(offset, order) {
  const url = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=200&order=${order}&ascending=false&offset=${offset}`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, cache: 'no-store',
    })
    if (!r.ok) { console.log(`  page offset=${offset} status ${r.status}`); return null }
    const j = await r.json()
    return Array.isArray(j) ? j : j.data || []
  } catch (e) { console.log(`  page offset=${offset} error ${e.message}`); return null }
}

function marketOk(m) {
  if (!m.question || !m.active || m.closed) return false
  if (/^Game \d+:/i.test(m.question)) return false
  if (/\bO\/U\b/i.test(m.question)) return false
  const v = parseFloat(m.volume || m.volumeClob || 0)
  if (v > 0 && v < 50) return false
  return true
}

async function run(order, maxPages) {
  const t0 = Date.now()
  let events = 0, mkts = 0
  const cids = new Set()
  const found = {}
  for (let p = 0; p < maxPages; p++) {
    const list = await page(p * 200, order)
    if (!list || list.length === 0) break
    events += list.length
    for (const ev of list) {
      for (const m of (ev.markets || [])) {
        if (!marketOk(m)) continue
        const cid = m.conditionId || m.id
        if (!cids.has(cid)) { cids.add(cid); mkts++ }
        if (TARGET[cid] && !(cid in found)) found[cid] = p + 1
      }
    }
    if (list.length < 200) break
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\norder=${order}: ${events} events, ${mkts} unique markets, ${secs}s`)
  for (const [cid, label] of Object.entries(TARGET)) {
    console.log(`  ${label}: ${found[cid] ? `found on page ${found[cid]}` : 'NOT in coverage'}`)
  }
}

async function main() {
  console.log('Probing Polymarket coverage (up to 20 pages = 4000 events)...')
  await run('volume24hr', 20)
  await run('volume', 20)
}
main().catch(e => console.error('error:', e.message))
