import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('markets')
      .select('*')
      .eq('status', 'active')
      .not('probability', 'is', null)
      .gt('probability', 0)
      .lt('probability', 1)
      .order('fetched_at', { ascending: false })
      .limit(20)

    if (error) throw error

    return NextResponse.json({ markets: data || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch top markets' },
      { status: 500 }
    )
  }
}