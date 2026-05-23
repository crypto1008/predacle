import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const platforms = ['polymarket', 'kalshi', 'myriad', 'manifold', 'limitless', 'azuro']

    const results = await Promise.all(
      platforms.map(platform =>
        supabaseAdmin
          .from('markets')
          .select('*')
          .eq('status', 'active')
          .eq('platform', platform)
          .not('probability', 'is', null)
          .gt('probability', 0.01)
          .lt('probability', 0.99)
          .or(`end_date.is.null,end_date.gte.${today}`)
          .order('fetched_at', { ascending: false })
          .limit(5)
      )
    )

    const markets = results
      .flatMap(r => r.data || [])
      .sort(() => Math.random() - 0.5)
      .slice(0, 20)

    return NextResponse.json({ markets })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}