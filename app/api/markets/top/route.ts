import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const platforms = ['polymarket', 'kalshi', 'myriad', 'manifold', 'limitless', 'azuro']

    const results = await Promise.all(
      platforms.map(async (platform) => {
        // First try: markets with valid probability.
        // `.is('ladder_key', null)` excludes price-ladder rungs (e.g. Kalshi
        // "Bitcoin price ... $63,500 or above") so the homepage shows real
        // event markets instead of near-duplicate rungs.
        const { data: withProb } = await supabaseAdmin
          .from('markets')
          .select('*')
          .eq('status', 'active')
          .eq('platform', platform)
          .is('ladder_key', null)
          .not('probability', 'is', null)
          .gt('probability', 0)
          .lt('probability', 1)
          .or(`end_date.is.null,end_date.gte.${today}`)
          .order('fetched_at', { ascending: false })
          .limit(4)

        if (withProb && withProb.length >= 2) return withProb

        // Fallback: any recent markets from this platform (still no ladders).
        const { data: anyMarkets } = await supabaseAdmin
          .from('markets')
          .select('*')
          .eq('status', 'active')
          .eq('platform', platform)
          .is('ladder_key', null)
          .or(`end_date.is.null,end_date.gte.${today}`)
          .order('fetched_at', { ascending: false })
          .limit(4)

        return anyMarkets || []
      })
    )

    const markets = results
      .flatMap(r => r)
      .sort(() => Math.random() - 0.5)
      .slice(0, 24)

    return NextResponse.json({ markets })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
