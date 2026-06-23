import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data, error } = await supabaseAdmin
      .from('markets')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    // For closed/resolved markets, attach the verified outcome (if we have one)
    // so the page can render a clear "resolved" state instead of stale live odds.
    let resolution = null
    if (data.status === 'closed' || data.status === 'resolved') {
      const { data: r } = await supabaseAdmin
        .from('market_resolutions')
        .select('resolved_outcome, final_probability, final_probability_at, resolved_at, resolution_source')
        .eq('id', id)
        .maybeSingle()
      resolution = r || null
    }

    return NextResponse.json({ ...data, resolution })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
