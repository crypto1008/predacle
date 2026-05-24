import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { market_id, platform, url } = await request.json()

    if (!market_id || !platform || !url) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Log click — fire and forget, don't block on errors
    supabaseAdmin.from('referral_clicks').insert({
      market_id,
      platform,
      url,
      user_agent: request.headers.get('user-agent') || '',
      clicked_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {})

    // Return original URL — no ref params until official affiliate codes confirmed
    return NextResponse.json({ url })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}