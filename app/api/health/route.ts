import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from('markets')
      .select('fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)

    const { count } = await supabaseAdmin
      .from('markets')
      .select('*', { count: 'exact', head: true })

    const lastFetch = data?.[0]?.fetched_at || null
    const minutesAgo = lastFetch
      ? Math.round((Date.now() - new Date(lastFetch).getTime()) / 60_000)
      : null

    return NextResponse.json({
      status: 'ok',
      lastFetch,
      minutesAgo,
      marketsCount: count || 0,
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}