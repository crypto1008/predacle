import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Use SQL GROUP BY for accurate counts across all markets
    const { data: catData, error } = await supabaseAdmin
      .rpc('get_category_counts')

    const { data: platData } = await supabaseAdmin
      .rpc('get_platform_counts')

    const { count: total } = await supabaseAdmin
      .from('markets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    return NextResponse.json({
      categories: catData || [],
      platforms: platData || [],
      totalMarkets: total || 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}