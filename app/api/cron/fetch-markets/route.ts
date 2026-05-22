import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchAllMarkets } from '@/lib/fetchers'

export const runtime = 'nodejs'
export const maxDuration = 30

function getFingerprint(question: string): string {
  const stopwords = new Set([
    'will','the','a','an','in','on','to','be','by','at','of','for',
    'is','are','was','were','has','have','had','do','does','did',
    'this','that','with','from','and','or','not','it','its','above',
    'below','reach','hit','over','under','than','before','after',
    'end','year','month','week','day','time','still','ever','first',
    'last','more','than','most','least','between','during','until',
  ])
  return question
    .toLowerCase()
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
    errors = result.errors
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

  // Sanitize and add fingerprints
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

  return NextResponse.json({
    success: true,
    marketsCount: markets.length,
    platforms: platformCounts,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  })
}