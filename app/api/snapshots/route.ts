import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Probability history for one market, oldest-first, nulls dropped.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('price_snapshots')
    .select('captured_at, probability')
    .eq('market_id', id)
    .not('probability', 'is', null)
    .order('captured_at', { ascending: true })
    .limit(300)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const points = (data || []).map((r: any) => ({ t: r.captured_at, p: Number(r.probability) }))
  return NextResponse.json({ points })
}
