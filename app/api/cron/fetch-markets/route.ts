import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchAllMarkets } from '@/lib/fetchers'

export const runtime = 'nodejs'
export const maxDuration = 30

function getFingerprint(question: string): string {
  const stopwords = new Set([
    'will','the','a','an','in','on','to','be','by','at','of','for',
    'is','are','was','were','has','have','had','do','does','did',
    'this','that','with','from','and','or','not','it','its',
    'above','below','hit','over','under','than','before','after',
    'end','year','month','week','day','time','still','ever',
    'going','able','likely','expected','predicted','market',
  ])
  return question
    .toLowerCase()
    .replace(/\bbtc\b/g, 'bitcoin')
    .replace(/\beth\b/g, 'ethereum')
    .replace(/\bsol\b/g, 'solana')
    .replace(/\bdoge\b/g, 'dogecoin')
    .replace(/\bxrp\b/g, 'ripple')
    .replace(/\bada\b/g, 'cardano')
    .replace(/\bbnb\b/g, 'binance')
    .replace(/\bmatic\b/g, 'polygon')
    .replace(/\bavax\b/g, 'avalanche')
    .replace(/\$(\d+(\.\d+)?)k\b/g, (_, n) => String(Math.round(parseFloat(n) * 1000)))
    .replace(/\$(\d+(\.\d+)?)m\b/g, (_, n) => String(Math.round(parseFloat(n) * 1000000)))
    .replace(/\$(\d+(\.\d+)?)b\b/g, (_, n) => String(Math.round(parseFloat(n) * 1000000000)))
    .replace(/,(\d{3})/g, '$1')
    .replace(/\$/g, '')
    .replace(/\bfederal reserve\b/g, 'fed')
    .replace(/\bfomc\b/g, 'fed')
    .replace(/\brate hike\b/g, 'rate increase')
    .replace(/\brate cut\b/g, 'rate decrease')
    .replace(/\braise rates?\b/g, 'rate increase')
    .replace(/\bcut rates?\b/g, 'rate decrease')
    .replace(/\blower rates?\b/g, 'rate decrease')
    .replace(/\bpresidential election\b/g, 'president election')
    .replace(/\bus president\b/g, 'president')
    .replace(/\bpotus\b/g, 'president')
    .replace(/\bwhite house\b/g, 'president')
    .replace(/\brepublican\b/g, 'gop')
    .replace(/\bdemocrat\b/g, 'dem')
    .replace(/\bsuperbowl\b/g, 'super bowl')
    .replace(/\bnfl championship\b/g, 'super bowl')
    .replace(/\bwinner\b/g, 'win')
    .replace(/\bwins\b/g, 'win')
    .replace(/\bwinning\b/g, 'win')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w))
    .sort()
    .join('-')
}

// Detect price-ladder rungs, e.g.
//   "Bitcoin price on Jun 12, 2026? — $63,500 or above"
// The family key is the text before the threshold; the threshold is the dollar
// figure. Rungs sharing a key are one ladder (same underlying + resolution date).
// Handles "or/and above|below|higher|lower|more|less". Other ladder phrasings
// (e.g. ranges) fall through as non-ladders for now and can be added later.
function parseLadder(question: string): { key: string; threshold: number } | null {
  if (!question) return null
  const m = question.match(
    /^(.*?)\s*[—–-]\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(?:or|and)\s+(?:above|below|higher|lower|more|less)\b/i
  )
  if (!m) return null
  const base = m[1].trim()
  const threshold = parseFloat(m[2].replace(/,/g, ''))
  if (!base || !isFinite(threshold)) return null
  return { key: base.toLowerCase().replace(/\s+/g, ' '), threshold }
}

// Format B: trailing-threshold ladders, e.g. "Will average gas prices be above $3.00?"
// (a direction word, then "$X" at the very end). The >=3 family-size gate in the
// handler ensures a lone "above $X" market is NOT mistaken for a ladder rung.
function parseLadderB(question: string): { key: string; threshold: number } | null {
  if (!question) return null
  const q = question.trim()
  // A direction word immediately followed by a number (optionally $ and a
  // (LOW)/(HIGH) marker): "above $3.00", "above 31259.99", "hit (HIGH) $95".
  // The number is the threshold; the family key is the whole question with that
  // number blanked to "X", so siblings differing only in threshold group together
  // while subject/date/time are preserved.
  const m = q.match(/\b(?:above|below|over|under|exceeds?|reaches?|hits?)\b\s*\(?(?:low|high)?\)?\s*\$?\s*([\d][\d,]*(?:\.\d+)?)/i)
  if (!m) return null
  const numStr = m[1]
  const threshold = parseFloat(numStr.replace(/,/g, ''))
  if (!isFinite(threshold)) return null
  const key = q.toLowerCase().replace(/\s+/g, ' ').trim().replace(numStr, 'X')
  return { key, threshold }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let markets: any[] = []
  let errors: Record<string, string> = {}

  try {
    const result = await fetchAllMarkets()
    markets = result.markets
    errors  = result.errors
    console.log(`Fetched ${markets.length} markets`)
  } catch (fetchError: any) {
    return NextResponse.json({
      error: 'Fetch failed',
      detail: fetchError?.message,
      step: 'fetch',
    }, { status: 500 })
  }

  if (markets.length === 0) {
    return NextResponse.json({ success: false, message: 'No markets fetched', errors })
  }

  // Two-pass ladder keying: a market becomes a ladder rung only if >=3 markets
  // in this fetch share its base key (a real family). Singleton "above $X"
  // markets keep ladder_key=null so they stay in the main browse feed.
  const candidates = markets.map((m: any) => parseLadder(m.question || '') || parseLadderB(m.question || ''))
  const ladderKeyCounts = new Map<string, number>()
  for (const c of candidates) if (c) ladderKeyCounts.set(c.key, (ladderKeyCounts.get(c.key) || 0) + 1)
  const LADDER_MIN_RUNGS = 3

  const sanitized = markets.map((m: any, i: number) => {
    const cand = candidates[i]
    const ladder = (cand && (ladderKeyCounts.get(cand.key) || 0) >= LADDER_MIN_RUNGS) ? cand : null
    return {
      ...m,
      probability: m.probability !== null && m.probability !== undefined
        ? Math.min(0.9999, Math.max(0, parseFloat(String(m.probability)) || 0))
        : null,
      volume: m.volume !== null && m.volume !== undefined
        ? Math.min(999999999999, Math.max(0, parseFloat(String(m.volume)) || 0))
        : null,
      traders: m.traders !== null && m.traders !== undefined
        ? Math.round(Math.abs(parseInt(String(m.traders)) || 0))
        : null,
      fingerprint: getFingerprint(m.question || ''),
      ladder_key: ladder ? ladder.key : null,
      ladder_threshold: ladder ? ladder.threshold : null,
    }
  })

  try {
    for (let i = 0; i < sanitized.length; i += 500) {
      const { error: upsertError } = await supabaseAdmin
        .from('markets')
        .upsert(sanitized.slice(i, i + 500), { onConflict: 'id' })

      if (upsertError) {
        return NextResponse.json({
          error: 'Database save failed',
          detail: upsertError.message,
          step: 'upsert',
          marketsCount: markets.length,
        }, { status: 500 })
      }
    }
  } catch (dbError: any) {
    return NextResponse.json({
      error: 'Database error',
      detail: dbError?.message,
      step: 'database',
    }, { status: 500 })
  }

  const platformCounts = markets.reduce((acc: Record<string, number>, m: any) => {
    acc[m.platform] = (acc[m.platform] || 0) + 1
    return acc
  }, {})

  const today = new Date().toISOString().split('T')[0]

  // Close markets where end_date has passed (all platforms except Azuro)
  await supabaseAdmin
    .from('markets')
    .update({ status: 'closed' })
    .lt('end_date', today)
    .not('end_date', 'is', null)
    .eq('status', 'active')
    .neq('platform', 'azuro')

  // Close Azuro markets where game date has passed — end_date IS the game start time.
  // With future-only fetcher, past games stop being re-fetched and get cleaned here.
  await supabaseAdmin
    .from('markets')
    .update({ status: 'closed' })
    .eq('platform', 'azuro')
    .eq('status', 'active')
    .lt('end_date', today)

  // Close Limitless short-term markets not refreshed in last 3 hours
  await supabaseAdmin
    .from('markets')
    .update({ status: 'closed' })
    .eq('platform', 'limitless')
    .lt('fetched_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
    .eq('status', 'active')

  // Close any active market not refreshed in the last 12 hours. When a market
  // resolves or is delisted it drops out of the platform's active feed and
  // stops being re-fetched, so a stale fetched_at reliably means "no longer
  // live". Any market that reappears in a later fetch is set back to 'active'
  // by the upsert above, so this self-corrects.
  await supabaseAdmin
    .from('markets')
    .update({ status: 'closed' })
    .eq('status', 'active')
    .lt('fetched_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
    .or(`end_date.lt.${today},end_date.is.null`)

  // ---- Price-history snapshots (Phase 11) --------------------------------
  // Capture every active market's probability roughly every 6 hours so we can
  // later show movers, 24h change, and sparklines. This runs every cron tick
  // but only writes when ~6h have passed since the last snapshot, so it's ~4
  // captures/day per market. It is strictly secondary to the refresh above:
  // any failure here is logged and swallowed so it can never break the sync.
  let snapshotted = 0
  try {
    let due = true
    try {
      const { data: last } = await supabaseAdmin
        .from('price_snapshots')
        .select('captured_at')
        .order('captured_at', { ascending: false })
        .limit(1)
        .single()
      // 5.5h threshold keeps ~6h spacing while tolerating cron timing jitter.
      if (last && Date.now() - new Date(last.captured_at).getTime() < 5.5 * 60 * 60 * 1000) {
        due = false
      }
    } catch {}

    if (due) {
      const at = new Date().toISOString()
      const rows = sanitized
        .filter((m: any) => m.probability != null)
        .map((m: any) => ({ market_id: m.id, probability: m.probability, volume: m.volume ?? null, captured_at: at }))

      // Insert in chunks to keep each request small.
      for (let i = 0; i < rows.length; i += 1000) {
        const { error } = await supabaseAdmin.from('price_snapshots').insert(rows.slice(i, i + 1000))
        if (error) { console.error('snapshot insert error:', error.message); break }
      }
      snapshotted = rows.length

      // Retention: drop snapshots older than 30 days.
      await supabaseAdmin
        .from('price_snapshots')
        .delete()
        .lt('captured_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    }
  } catch (snapErr: any) {
    console.error('price snapshot step failed:', snapErr?.message)
  }
  // ------------------------------------------------------------------------

  return NextResponse.json({
    success: true,
    marketsCount: markets.length,
    snapshotted,
    platforms: platformCounts,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  })
}
