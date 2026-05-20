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
    const { markets, errors } = await fetchAllMarkets()

    if (markets.length === 0) {
      return NextResponse.json({ success: false, message: 'No markets fetched', errors })
    }

    const { error } = await supabaseAdmin
      .from('markets')
      .upsert(markets, { onConflict: 'id' })

    if (error) throw error

    return NextResponse.json({
      success: true,
      marketsCount: markets.length,
      duration: `${Date.now() - start}ms`,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Cron error:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}