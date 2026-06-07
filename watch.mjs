#!/usr/bin/env node
/*
 * watch.mjs — poll the scanner on an interval; alert ONLY when an arb candidate
 * appears (or its edge improves). macOS desktop notification + optional Telegram.
 * Needs scan.mjs + books.mjs in the same folder.
 *
 * Run:        node watch.mjs
 * Faster:     INTERVAL_SEC=30 node watch.mjs
 * Threshold:  THRESHOLD=0.02 node watch.mjs          (2% net edge required)
 * Telegram:   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy node watch.mjs
 */
import { scanOnce } from './scan.mjs'
import { execFile } from 'node:child_process'

const INTERVAL = Number(process.env.INTERVAL_SEC ?? 60) * 1000
const REALERT_DELTA = 0.005        // re-alert if a known candidate's edge jumps >= 0.5pt
const seen = new Map()             // pair -> last alerted edge
const pct = (x) => (x * 100).toFixed(2)

function notifyMac(title, msg) {
  execFile('osascript', ['-e',
    `display notification ${JSON.stringify(msg)} with title ${JSON.stringify(title)} sound name "Glass"`],
    () => {}) // best-effort; ignore errors / non-mac
}
async function notifyTelegram(text) {
  const tok = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID
  if (!tok || !chat) return
  try {
    await fetch(`https://api.telegram.org/bot${tok}/sendMessage`,
      { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text }) })
  } catch { /* if telegram is DNS-blocked too, route via books.mjs technique */ }
}

async function cycle() {
  const ts = new Date().toLocaleTimeString()
  let r
  try { r = await scanOnce({ quiet: true }) }
  catch (e) { console.log(`[${ts}] scan error: ${e.message}`); return }

  const cands = r.matchups.filter(m => m.status === 'candidate')
  console.log(`[${ts}] pairs=${r.summary.pairs} cross=${r.summary.cross} realReal=${r.summary.realReal} candidates=${cands.length}`)

  for (const m of cands) {
    const prev = seen.get(m.pair)
    const isNew = prev == null
    const improved = prev != null && (m.edge - prev) >= REALERT_DELTA
    if (isNew || improved) {
      const line = `${m.n1} vs ${m.n2}: buy ${m.n1} @${pct(m.best1.cost)}% (${m.best1.platform}) + ${m.n2} @${pct(m.best2.cost)}% (${m.best2.platform}) => net +${pct(m.edge)}%`
      console.log(`  *** ARB *** ${line}`)
      notifyMac('Arb candidate', `${m.n1} vs ${m.n2}  +${pct(m.edge)}%`)
      notifyTelegram(`ARB ${line}`)
    }
    seen.set(m.pair, m.edge)
  }
  // drop pairs that are no longer candidates so they re-alert if they come back
  for (const pair of [...seen.keys()]) if (!cands.find(m => m.pair === pair)) seen.delete(pair)
}

console.log(`watching every ${INTERVAL / 1000}s (threshold ${(Number(process.env.THRESHOLD ?? 0.01) * 100).toFixed(0)}%) — Ctrl-C to stop`)
await cycle()
setInterval(cycle, INTERVAL)
