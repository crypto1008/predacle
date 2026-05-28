import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q     = searchParams.get('q')?.trim() || ''
    const limit = Math.min(6, parseInt(searchParams.get('limit') || '6'))

    if (q.length < 2) {
      return NextResponse.json({ markets: [] })
    }

    const { data } = await supabaseAdmin
      .from('markets')
      .select('id, platform, question, probability, volume_label, category')
      .eq('status', 'active')
      .ilike('question', `%${q}%`)
      .order('volume', { ascending: false, nullsFirst: false })
      .limit(limit)

    return NextResponse.json({ markets: data || [] })
  } catch (error: any) {
    return NextResponse.json({ markets: [] })
  }
}