import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function buildAffiliateUrl(url: string, platform: string): string {
  try {
    const u = new URL(url)
    switch (platform) {
      case 'polymarket':
        u.searchParams.set('ref', 'predacle')
        break
      case 'kalshi':
        u.searchParams.set('ref', 'predacle')
        break
      case 'myriad':
        u.searchParams.set('ref', 'predacle')
        break
      case 'manifold':
        u.searchParams.set('ref', 'predacle')
        break
      case 'limitless':
        u.searchParams.set('ref', 'predacle')
        break
      case 'azuro':
        break
    }
    return u.toString()
  } catch {
    return url
  }
}

export async function POST(request: NextRequest) {
  try {
    const { market_id, platform, url } = await request.json()

    if (!market_id || !platform || !url) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const userAgent = request.headers.get('user-agent') || ''

    await supabaseAdmin
      .from('referral_clicks')
      .insert({
        market_id,
        platform,
        url,
        user_agent: userAgent,
        clicked_at: new Date().toISOString(),
      })

    const affiliateUrl = buildAffiliateUrl(url, platform)
    return NextResponse.json({ url: affiliateUrl })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}