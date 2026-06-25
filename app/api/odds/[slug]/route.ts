import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOddsTopic } from '@/lib/odds-topics'

export const dynamic = 'force-dynamic'

interface MarketRow {
  id: string
  platform: string
  question: string
  probability: number | null
  volume: number | null
  volume_label: string | null
  category: string | null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const debug = new URL(request.url).searchParams.get('debug')
  const topic = getOddsTopic(slug)
  if (!topic) return NextResponse.json({ error: 'Unknown topic' }, { status: 404 })

  try {
    // Build an OR of ilike patterns for the include terms.
    const orFilter = topic.match.any
      .map((t) => `question.ilike.%${t}%`)
      .join(',')

    let query = supabaseAdmin
      .from('markets')
      .select('id, platform, question, probability, volume, volume_label, category')
      .eq('status', 'active')
      .or(orFilter)
      .order('volume', { ascending: false, nullsFirst: false })
      .limit(200)

    if (topic.match.category) query = query.eq('category', topic.match.category)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const excludes = (topic.match.exclude || []).map((e) => e.toLowerCase())
    const rows: MarketRow[] = (data as MarketRow[] || []).filter((m) => {
      const q = (m.question || '').toLowerCase()
      if (excludes.some((e) => q.includes(e))) return false   // drop false positives
      return true
    })

    // Debug: show exactly what got matched so a human can verify the rule.
    if (debug === '1') {
      return NextResponse.json({
        slug,
        matchRule: topic.match,
        matchedCount: rows.length,
        markets: rows.map((m) => ({
          q: m.question,
          platform: m.platform,
          prob: m.probability != null ? Math.round(m.probability * 100) : null,
          vol: m.volume_label,
        })),
      })
    }

    // Group by platform for display; sort each platform's markets by probability desc.
    const markets = rows
      .filter((m) => m.probability != null)
      .map((m) => ({
        id: m.id,
        platform: m.platform,
        question: m.question,
        probability: Math.round((m.probability as number) * 100),
        volumeLabel: m.volume_label,
      }))
      .sort((a, b) => b.probability - a.probability)

    return NextResponse.json({
      slug,
      question: topic.question,
      marketCount: markets.length,
      markets: markets.slice(0, 40),
      generatedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
