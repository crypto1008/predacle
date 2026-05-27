import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: market } = await supabaseAdmin
      .from('markets')
      .select('fingerprint, platform, category, id')
      .eq('id', id)
      .single()

    if (!market) {
      return NextResponse.json({ crossPlatform: [], similar: [] })
    }

    const [crossResult, similarResult] = await Promise.all([
      // Cross-platform: same fingerprint, different platform
      market.fingerprint
        ? supabaseAdmin
            .from('markets')
            .select('id, platform, probability, volume_label, url, question')
            .eq('fingerprint', market.fingerprint)
            .neq('platform', market.platform)
            .eq('status', 'active')
            .limit(6)
        : Promise.resolve({ data: [] }),

      // Similar: same category, different market, top by volume
      market.category
        ? supabaseAdmin
            .from('markets')
            .select('id, platform, question, probability, volume_label, end_date_label, category, url')
            .eq('category', market.category)
            .neq('id', id)
            .eq('status', 'active')
            .order('volume', { ascending: false, nullsFirst: false })
            .limit(6)
        : Promise.resolve({ data: [] }),
    ])

    return NextResponse.json({
      crossPlatform: crossResult.data || [],
      similar:       similarResult.data || [],
    })

  } catch (error: any) {
    return NextResponse.json({ crossPlatform: [], similar: [] })
  }
}