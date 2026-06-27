import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// One-off discovery tool: scans active markets and surfaces recurring multi-word
// phrases (candidate "topics") per category, ranked by how many distinct markets
// share the phrase and — critically — how many of those have REAL-MONEY prices.
// This replaces guessing topics with evidence from the actual DB.
//
//   /api/odds-discover            -> all categories
//   /api/odds-discover?cat=sports -> one category
//   /api/odds-discover?min=6      -> only phrases in >= 6 markets (default 5)

interface Row {
  platform: string
  question: string
  probability: number | null
  category: string | null
}

const STOP = new Set([
  'will', 'the', 'a', 'an', 'be', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or',
  'is', 'are', 'by', 'win', 'wins', 'won', 'this', 'that', 'with', 'as', 'it', 'his',
  'her', 'their', 'have', 'has', 'than', 'next', 'who', 'what', 'which', 'when',
])

function normalize(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Generate 3- and 4-word phrases (shingles) from a question, skipping pure-stopword ones.
function phrases(q: string): string[] {
  const words = normalize(q).split(' ').filter(Boolean)
  const out: string[] = []
  for (const n of [3, 4]) {
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n)
      // Require at least one "contentful" (non-stopword, length>2) token.
      if (gram.some((w) => !STOP.has(w) && w.length > 2)) out.push(gram.join(' '))
    }
  }
  return out
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const catFilter = url.searchParams.get('cat')
  const minCount = Math.max(3, parseInt(url.searchParams.get('min') || '5'))

  try {
    let q = supabaseAdmin
      .from('markets')
      .select('platform, question, probability, category')
      .eq('status', 'active')
      .limit(8000)
    if (catFilter) q = q.eq('category', catFilter)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rows = (data as Row[]) || []

    // Per category -> per phrase -> { markets, realMoney }
    const byCat = new Map<string, Map<string, { total: number; real: number }>>()
    for (const r of rows) {
      const cat = r.category || 'uncategorized'
      if (!byCat.has(cat)) byCat.set(cat, new Map())
      const pm = byCat.get(cat)!
      const isReal = r.platform !== 'manifold' && r.probability != null
      // Dedup phrases within a single question so one market counts once per phrase.
      const seen = new Set(phrases(r.question))
      for (const p of seen) {
        const e = pm.get(p) || { total: 0, real: 0 }
        e.total += 1
        if (isReal) e.real += 1
        pm.set(p, e)
      }
    }

    // Rank phrases per category: must clear minCount AND have real-money depth.
    const result: Record<string, { phrase: string; markets: number; realMoney: number }[]> = {}
    for (const [cat, pm] of byCat) {
      const ranked = [...pm.entries()]
        .map(([phrase, e]) => ({ phrase, markets: e.total, realMoney: e.real }))
        .filter((x) => x.markets >= minCount && x.realMoney >= 3) // real-money depth required
        .sort((a, b) => b.realMoney - a.realMoney || b.markets - a.markets)
        .slice(0, 12)
      if (ranked.length) result[cat] = ranked
    }

    return NextResponse.json({
      scanned: rows.length,
      minCount,
      note: 'Phrases ranked by real-money market count. High realMoney = a topic worth building.',
      categories: result,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
