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

// Probability floor: below this, a candidate is a long-shot/novelty entry and is
// summarised as a count rather than listed, to keep the page signal-rich.
const THRESHOLD = 4

type Bucket = 'party' | 'nomination' | 'election' | 'other'

// Classify a market question into a section. Order matters: party first (it can
// also contain "election"), then nomination, then election-winner. Anything that
// is about running/announcing/meta is 'other' (excluded from the clean sections).
function classify(qRaw: string): Bucket {
  const q = qRaw.toLowerCase()

  // Exclude non-"odds of winning" questions outright.
  if (
    q.includes('run for president') ||
    q.includes('announce') ||
    q.includes('happen normally') ||
    q.includes('take over the presidency') ||
    q.includes('more important') ||
    q.includes(' or ') ||           // multi-name combo markets
    q.includes(', rubio') || q.includes(', vance') || q.includes(', newsom')
  ) {
    return 'other'
  }

  // Party-level.
  if (
    /\bthe (democrats|republicans) win\b/.test(q) ||
    /\ba (democrat|republican) win\b/.test(q)
  ) {
    return 'party'
  }

  // Nomination.
  if (
    q.includes('nomination') ||
    q.includes('nominee') ||
    q.includes('be nominated') ||
    /\bbe the (democratic|republican)\b/.test(q)
  ) {
    return 'nomination'
  }

  // Election winner.
  if (
    q.includes('win the 2028 us presidential election') ||
    q.includes('win the 2028 presidential election') ||
    q.includes('be elected president') ||
    q.includes('become president') ||
    q.includes('elected president in 2028')
  ) {
    return 'election'
  }

  return 'other'
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
    const orFilter = topic.match.any.map((t) => `question.ilike.%${t}%`).join(',')

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
      if (excludes.some((e) => q.includes(e))) return false
      return m.probability != null
    })

    type Item = { id: string; platform: string; question: string; probability: number; volumeLabel: string | null; bucket: Bucket }
    const items: Item[] = rows.map((m) => ({
      id: m.id,
      platform: m.platform,
      question: m.question,
      probability: Math.round((m.probability as number) * 100),
      volumeLabel: m.volume_label,
      bucket: classify(m.question),
    }))

    if (debug === '1') {
      const byBucket: Record<string, number> = {}
      for (const it of items) byBucket[it.bucket] = (byBucket[it.bucket] || 0) + 1
      return NextResponse.json({
        slug,
        matchedCount: items.length,
        byBucket,
        threshold: THRESHOLD,
        sample: items
          .sort((a, b) => b.probability - a.probability)
          .map((i) => ({ q: i.question, bucket: i.bucket, prob: i.probability, platform: i.platform })),
      })
    }

    // Build clean sections. Within each, show >= THRESHOLD sorted desc; count the rest.
    function section(bucket: Bucket) {
      const all = items.filter((i) => i.bucket === bucket).sort((a, b) => b.probability - a.probability)
      const shown = all.filter((i) => i.probability >= THRESHOLD)
      return { shown, hiddenCount: all.length - shown.length }
    }

    const party = section('party')
    const nomination = section('nomination')
    const election = section('election')

    return NextResponse.json({
      slug,
      question: topic.question,
      threshold: THRESHOLD,
      sections: {
        party: party.shown,
        nomination: nomination.shown,
        election: election.shown,
      },
      hidden: {
        party: party.hiddenCount,
        nomination: nomination.hiddenCount,
        election: election.hiddenCount,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
