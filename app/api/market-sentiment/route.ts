import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FRESH_MS = 24 * 60 * 60 * 1000   // only surface sentiment generated in the last 24h

// Returns the "why it moved" sentiment + recent headlines for one market.
// Powers the market-detail panel; empty payload when the market isn't a recent mover.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ sentiment: null, news: [] })

  const { data: sent } = await supabaseAdmin
    .from('market_sentiment')
    .select('market_id, stance, score, why, drivers, move_24h, headline_count, generated_at')
    .eq('market_id', id)
    .maybeSingle()

  const fresh = sent && (Date.now() - new Date(sent.generated_at).getTime()) < FRESH_MS
  if (!fresh) return NextResponse.json({ sentiment: null, news: [] })

  const { data: news } = await supabaseAdmin
    .from('market_news')
    .select('title, source, url, published_at')
    .eq('market_id', id)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(6)

  return NextResponse.json({ sentiment: sent, news: news || [] })
}
