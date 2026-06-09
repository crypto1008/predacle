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

  const sanitized = markets.map((m: any) => ({
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
  }))

  try {
    const { error: upsertError } = await supabaseAdmin
      .from('markets')
      .upsert(sanitized, { onConflict: 'id' })

    if (upsertError) {
      return NextResponse.json({
        error: 'Database save failed',
        detail: upsertError.message,
        step: 'upsert',
        marketsCount: markets.length,
      }, { status: 500 })
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
        .map((m: any) => ({ market_id: m.id, probability: m.probability, captured_at: at }))

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
