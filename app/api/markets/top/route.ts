import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabaseAdmin
      .from('markets')
      .select('*')
      .eq('status', 'active')
      .not('probability', 'is', null)
      .gt('probability', 0.01)
      .lt('probability', 0.99)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('fetched_at', { ascending: false })
      .limit(20)

    if (error) throw error
    return NextResponse.json({ markets: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}