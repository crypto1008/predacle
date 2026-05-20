import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchAllMarkets } from '@/lib/fetchers'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const start = Date.now()
    console.log('Cron: starting market fetch...')

    const { markets, errors } = await fetchAllMarkets()
    console.log(`Cron: fetched ${markets.length} markets`)
    console.log('Cron: errors:', JSON.stringify(errors))

    if (markets.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No markets fetched',
        errors,
      })
    }

    console.log('Cron: upserting to Supabase...')
    const { error: upsertError } = await supabaseAdmin
      .from('markets')
      .upsert(markets, { onConflict: 'id' })

    if (upsertError) {
      console.error('Cron: upsert error:', upsertError)
      throw upsertError
    }

    const duration = Date.now() - start
    console.log(`Cron: done in ${duration}ms`)

    return NextResponse.json({
      success: true,
      marketsCount: markets.length,
      duration: `${duration}ms`,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      platforms: Object.fromEntries(
        ['polymarket', 'manifold', 'kalshi', 'myriad'].map((p) => [
          p,
          markets.filter((m) => m.platform === p).length,
        ])
      ),
    })
  } catch (error: any) {
    console.error('Cron: fatal error:', error?.message || error)
    return NextResponse.json(
      {
        error: 'Cron job failed',
        detail: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}