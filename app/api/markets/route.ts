import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page     = Math.max(1, parseInt(searchParams.get('page')     || '1'))
    const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const platform = searchParams.get('platform')
    const category = searchParams.get('category')
    const search   = searchParams.get('q')
    const sort     = searchParams.get('sort') || 'fetched_at'
    const minProb  = searchParams.get('min_prob')
    const offset   = (page - 1) * limit

    let query = supabaseAdmin
      .from('markets')
      .select('*', { count: 'exact' })
      .eq('status', 'active')

    if (platform) query = query.eq('platform', platform)
    if (category) query = query.eq('category', category)
    if (search)   query = query.ilike('question', `%${search}%`)
    if (minProb)  query = query.gte('probability', parseFloat(minProb))

    if (sort === 'probability') {
      query = query.order('probability', { ascending: false, nullsFirst: false })
    } else if (sort === 'volume') {
      query = query.order('volume', { ascending: false, nullsFirst: false })
    } else if (sort === 'end_date') {
      query = query
        .not('end_date', 'is', null)
        .order('end_date', { ascending: true })
    } else if (sort === 'newest') {
      query = query.order('created_at', { ascending: false })
    } else {
      query = query.order('fetched_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      markets:    data || [],
      total:      count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch markets', detail: error.message },
      { status: 500 }
    )
  }
}