import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchAllMarkets } from '@/lib/fetchers'

export const runtime = 'nodejs'
export const maxDuration = 30

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
    console.error('Fatal fetch error:', fetchError?.message)
    return NextResponse.json({
      error: 'Fetch failed',
      detail: fetchError?.message || String(fetchError),
      step: 'fetch',
    }, { status: 500 })
  }

  if (markets.length === 0) {
    return NextResponse.json({
      success: false,
      message: 'No markets fetched',
      errors,
    })
  }

  // Sanitize all numeric fields before saving to database
  const sanitized = markets.map((m: any) => ({
    ...m,
    probability:
      m.probability !== null && m.probability !== undefined
        ? Math.min(0.9999, Math.max(0, parseFloat(String(m.probability)) || 0))
        : null,
    volume:
      m.volume !== null && m.volume !== undefined
        ? Math.min(999999999999, Math.max(0, parseFloat(String(m.volume)) || 0))
        : null,
    traders:
      m.traders !== null && m.traders !== undefined
        ? Math.round(Math.abs(parseInt(String(m.traders)) || 0))
        : null,
  }))

  try {
    const { error: upsertError } = await supabaseAdmin
      .from('markets')
      .upsert(sanitized, { onConflict: 'id' })

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      return NextResponse.json({
        error: 'Database save failed',
        detail: upsertError.message,
        step: 'upsert',
        marketsCount: markets.length,
      }, { status: 500 })
    }
  } catch (dbError: any) {
    console.error('Database error:', dbError?.message)
    return NextResponse.json({
      error: 'Database error',
      detail: dbError?.message || String(dbError),
      step: 'database',
    }, { status: 500 })
  }

  const platformCounts = markets.reduce(
    (acc: Record<string, number>, m: any) => {
      acc[m.platform] = (acc[m.platform] || 0) + 1
      return acc
    },
    {}
  )

  return NextResponse.json({
    success: true,
    marketsCount: markets.length,
    platforms: platformCounts,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  })
}