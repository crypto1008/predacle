import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('get_platform_counts')

    const { data: catData } = await supabaseAdmin
      .from('markets')
      .select('category')
      .eq('status', 'active')
      .not('category', 'is', null)
      .limit(10000)

    const categoryCounts: Record<string, number> = {}
    catData?.forEach((row: any) => {
      if (row.category) {
        categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1
      }
    })

    const categories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ categories, platforms: data || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}