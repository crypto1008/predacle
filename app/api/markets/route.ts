import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const limit = rateLimitMap.get(ip)
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60_000 })
    return true
  }
  if (limit.count >= 60) return false
  limit.count++
  return true
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform')
  const status = searchParams.get('status') || 'active'
  const sort = searchParams.get('sort') || 'probability_desc'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  try {
    let query = supabaseAdmin
      .from('markets')
      .select('*', { count: 'exact' })
      .eq('status', status)

    if (platform && platform !== 'all') {
      query = query.eq('platform', platform)
    }

    if (sort === 'probability_desc') {
      query = query.order('probability', { ascending: false, nullsFirst: false })
    } else if (sort === 'probability_asc') {
      query = query.order('probability', { ascending: true, nullsFirst: false })
    } else if (sort === 'volume') {
      query = query.order('volume', { ascending: false, nullsFirst: false })
    } else {
      query = query.order('fetched_at', { ascending: false })
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)
    if (error) throw error

    return NextResponse.json({
      markets: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error('Markets API error:', error)
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 })
  }
}