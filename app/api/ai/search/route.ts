import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime     = 'nodejs'
export const maxDuration = 30

const COLS = 'id, platform, question, probability, volume, volume_label, end_date, end_date_label, traders, category, url, status, created_at, image_url'

const CATEGORIES = new Set(['crypto', 'sports', 'politics', 'economics', 'tech', 'science', 'entertainment'])
const PLATFORMS  = new Set(['polymarket', 'kalshi', 'myriad', 'manifold', 'limitless', 'azuro'])
const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold', limitless: 'Limitless', azuro: 'Bookmaker',
}
const CATEGORY_LABELS: Record<string, string> = {
  crypto: 'Crypto', sports: 'Sports', politics: 'Politics', economics: 'Economics',
  tech: 'Tech', science: 'Science', entertainment: 'Entertainment',
}
const SORT_LABELS: Record<string, string> = {
  volume: 'Most liquid', closing: 'Closing soon',
  probability_asc: 'Longest odds', probability_desc: 'Most likely', newest: 'Newest',
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const sanitizeKw = (k: any) => String(k || '').replace(/[(),%]/g, ' ').trim()

interface Filters {
  keywords: string[]
  category: string | null
  platform: string | null
  minProbability: number | null
  maxProbability: number | null
  endsWithinDays: number | null
  sort: string | null
}

async function parseWithGemini(q: string, apiKey: string): Promise<Filters | null> {
  const prompt = `Convert this prediction-market search into JSON filters. Return ONLY a JSON object, nothing else.

Keys (set ONLY the ones the query clearly implies; otherwise null):
- "keywords": array of 1-4 topical words to match in the question (e.g. ["bitcoin"], ["election","trump"]). Use [] if the query is purely about attributes (e.g. "cheap markets closing soon").
- "category": one of crypto, sports, politics, economics, tech, science, entertainment — or null.
- "platform": one of polymarket, kalshi, myriad, manifold, limitless, azuro — or null.
- "minProbability": 0-1 or null. Phrases like "likely", "favorite", "probable" -> ~0.7.
- "maxProbability": 0-1 or null. Phrases like "cheap", "longshot", "unlikely", "underdog" -> ~0.15.
- "endsWithinDays": integer or null. "closing soon"/"this week" -> 7, "this month" -> 30, "today" -> 1.
- "sort": one of volume (biggest/liquid/most active), closing (ending soon), probability_asc (longest odds), probability_desc (most likely), newest (new) — or null.

Query: "${q}"`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0, responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) { console.error('Gemini search error:', await res.text()); return null }
  const data  = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const text  = parts.filter((p: any) => !p.thought).map((p: any) => p.text || '').join('').trim()
  if (!text) return null
  let parsed: any
  try { parsed = JSON.parse(text) } catch { const mm = text.match(/\{[\s\S]*\}/); if (!mm) return null; parsed = JSON.parse(mm[0]) }

  return {
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(sanitizeKw).filter(Boolean).slice(0, 4) : [],
    category: CATEGORIES.has(parsed.category) ? parsed.category : null,
    platform: PLATFORMS.has(parsed.platform) ? parsed.platform : null,
    minProbability: typeof parsed.minProbability === 'number' ? clamp01(parsed.minProbability) : null,
    maxProbability: typeof parsed.maxProbability === 'number' ? clamp01(parsed.maxProbability) : null,
    endsWithinDays: typeof parsed.endsWithinDays === 'number' && parsed.endsWithinDays > 0 ? Math.round(parsed.endsWithinDays) : null,
    sort: ['volume', 'closing', 'probability_asc', 'probability_desc', 'newest'].includes(parsed.sort) ? parsed.sort : null,
  }
}

// Fallback when Gemini is unavailable: plain keyword search, no smart filters.
function keywordFallback(q: string): Filters {
  const keywords = q.toLowerCase().replace(/[(),%]/g, ' ').split(/\s+/).filter((w) => w.length > 2).slice(0, 4)
  return { keywords, category: null, platform: null, minProbability: null, maxProbability: null, endsWithinDays: null, sort: null }
}

function buildChips(f: Filters): string[] {
  const chips: string[] = []
  if (f.keywords.length) chips.push(`"${f.keywords.join(' ')}"`)
  if (f.category) chips.push(CATEGORY_LABELS[f.category] || f.category)
  if (f.platform) chips.push(PLATFORM_LABELS[f.platform] || f.platform)
  if (f.minProbability != null) chips.push(`≥ ${Math.round(f.minProbability * 100)}%`)
  if (f.maxProbability != null) chips.push(`≤ ${Math.round(f.maxProbability * 100)}%`)
  if (f.endsWithinDays != null) chips.push(`closing ≤ ${f.endsWithinDays}d`)
  if (f.sort) chips.push(SORT_LABELS[f.sort] || f.sort)
  return chips
}

export async function GET(request: NextRequest) {
  try {
    const q = (new URL(request.url).searchParams.get('q') || '').trim()
    if (q.length < 2) return NextResponse.json({ query: q, chips: [], filters: null, markets: [], aiUsed: false })

    const apiKey = process.env.GEMINI_API_KEY
    let f: Filters | null = null
    let aiUsed = false
    if (apiKey && apiKey !== 'placeholder') {
      try { f = await parseWithGemini(q, apiKey); if (f) aiUsed = true } catch (e: any) { console.error('search parse threw:', e?.message) }
    }
    if (!f) f = keywordFallback(q)

    let query = supabaseAdmin.from('markets').select(COLS).eq('status', 'active')

    if (f.category) query = query.eq('category', f.category)
    if (f.platform) query = query.eq('platform', f.platform)
    if (f.minProbability != null) query = query.gte('probability', f.minProbability)
    if (f.maxProbability != null) query = query.lte('probability', f.maxProbability)
    if (f.endsWithinDays != null) {
      query = query
        .gte('end_date', new Date().toISOString())
        .lte('end_date', new Date(Date.now() + f.endsWithinDays * 86400000).toISOString())
    }
    if (f.keywords.length) query = query.or(f.keywords.map((k) => `question.ilike.%${k}%`).join(','))

    switch (f.sort) {
      case 'closing':
        query = query.gte('end_date', new Date().toISOString()).order('end_date', { ascending: true, nullsFirst: false })
        break
      case 'probability_asc':
        query = query.order('probability', { ascending: true, nullsFirst: false })
        break
      case 'probability_desc':
        query = query.order('probability', { ascending: false, nullsFirst: false })
        break
      case 'newest':
        query = query.order('created_at', { ascending: false, nullsFirst: false })
        break
      default:
        query = query.order('volume', { ascending: false, nullsFirst: false })
    }

    const { data, error } = await query.limit(24)
    if (error) throw error

    return NextResponse.json({ query: q, chips: buildChips(f), filters: f, markets: data || [], aiUsed })
  } catch (error: any) {
    console.error('ai-search error:', error.message)
    return NextResponse.json({ query: '', chips: [], filters: null, markets: [], aiUsed: false }, { status: 200 })
  }
}
