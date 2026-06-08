import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { matchMarkets, isReal } from '@/lib/match'

export const runtime     = 'nodejs'
export const maxDuration = 30

const FRESH_MS = 6 * 60 * 60 * 1000 // serve a cached brief for 6 hours

const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold', limitless: 'Limitless', azuro: 'Bookmaker',
}

async function fetchActiveMarkets() {
  const cols = 'id, platform, question, probability, url, category, volume, volume_label, end_date'
  const PAGE = 1000
  const all: any[] = []
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('markets')
      .select(cols)
      .eq('status', 'active')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
  }
  return all
}

// Light version of the opportunity engine: just the strongest clean
// real-money divergences. (Full scoring lives in /api/arbitrage; the brief
// only needs the headline gaps, so we derive them inline to avoid a self-call.)
function topDivergences(data: any[]) {
  const { realClusters } = matchMarkets(data)
  const repByPlatform = (g: any[]) => {
    const b: Record<string, any> = {}
    for (const m of g) { const v = m.volume || 0; if (!b[m.platform] || v > (b[m.platform].volume || 0)) b[m.platform] = m }
    return b
  }
  return (realClusters as any[][])
    .map((g) => {
      const reps = Object.values(repByPlatform(g)) as any[]
      const priced = reps.filter((m) => m.probability != null)
      if (priced.length < 2) return null
      const probs = priced.map((m) => m.probability as number)
      const maxP = Math.max(...probs)
      const minP = Math.min(...probs)
      const high = priced.find((m) => m.probability === maxP)
      const low = priced.find((m) => m.probability === minP)
      const realMoney = reps.filter((m) => isReal(m.platform)).length >= 2
      const suspect = reps.some((m) => m.probability != null && (m.probability <= 0.005 || m.probability >= 0.995))
      return {
        id: g[0].id,
        question: g[0].question,
        gapPercent: Math.round((maxP - minP) * 100),
        high: high?.platform as string,
        low: low?.platform as string,
        realMoney,
        suspect,
      }
    })
    .filter((d): d is NonNullable<typeof d> => !!d && d.realMoney && !d.suspect && d.gapPercent >= 6)
    .sort((a, b) => b.gapPercent - a.gapPercent)
    .slice(0, 3)
}

export async function GET(_req: NextRequest) {
  try {
    // Serve a fresh cached brief if we have one
    try {
      const { data: cached } = await supabaseAdmin
        .from('market_brief')
        .select('payload, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (cached && Date.now() - new Date(cached.created_at).getTime() < FRESH_MS) {
        return NextResponse.json({ ...(cached.payload as any), cached: true })
      }
    } catch {}

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || apiKey === 'placeholder') {
      return NextResponse.json({ generatedAt: null, lede: null, items: [] })
    }

    const data = await fetchActiveMarkets()
    if (!data.length) return NextResponse.json({ generatedAt: null, lede: null, items: [] })

    const divs = topDivergences(data).slice(0, 2)
    const usedIds = new Set(divs.map((d) => d.id))
    const topVol = [...data]
      .filter((m) => m.probability != null && m.volume && !usedIds.has(m.id) && isReal(m.platform))
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .slice(0, 2)

    // Build the candidate situations the editor will write about
    const candidates: any[] = []
    divs.forEach((d, i) => candidates.push({
      cid: `d${i}`, kind: 'divergence', id: d.id, question: d.question,
      meta: `${d.gapPercent}pt gap · ${PLATFORM_LABELS[d.high] || d.high} vs ${PLATFORM_LABELS[d.low] || d.low}`,
      fact: `A ${d.gapPercent}-point cross-platform price gap on the same outcome between ${PLATFORM_LABELS[d.high] || d.high} and ${PLATFORM_LABELS[d.low] || d.low}.`,
    }))
    topVol.forEach((m, i) => candidates.push({
      cid: `v${i}`, kind: 'volume', id: m.id, question: m.question,
      meta: `${m.volume_label || 'High volume'} · ${PLATFORM_LABELS[m.platform] || m.platform}`,
      fact: `One of the highest-volume active markets right now (${m.volume_label || 'high volume'} on ${PLATFORM_LABELS[m.platform] || m.platform}), trading at ${Math.round((m.probability || 0) * 100)}% implied.`,
    }))

    if (!candidates.length) {
      return NextResponse.json({ generatedAt: new Date().toISOString(), lede: null, items: [] })
    }

    const list = candidates.map((c, i) => `${i + 1}. [${c.cid}] ${c.question} — ${c.fact}`).join('\n')
    const prompt = `You are the editor of a prediction-market daily brief. Below are the most notable live market situations. Write a tight, honest brief. No hype, no financial advice, no invented facts — use ONLY what is given.

Situations:
${list}

Return ONLY this JSON:
{"lede":"one sentence, max 22 words, summarizing the current landscape across these situations","items":[{"cid":"d0","line":"one plain, specific sentence, max 18 words, on why this one is worth a look"}]}
Include exactly one item for every situation above, matching its cid exactly.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.3, responseMimeType: 'application/json' },
        }),
      }
    )
    if (!res.ok) {
      console.error('Gemini brief error:', await res.text())
      return NextResponse.json({ generatedAt: null, lede: null, items: [] })
    }

    const gem   = await res.json()
    const parts = gem.candidates?.[0]?.content?.parts || []
    const text  = parts.filter((p: any) => !p.thought).map((p: any) => p.text || '').join('').trim()
    let parsed: any = {}
    try { parsed = JSON.parse(text) } catch { const mm = text.match(/\{[\s\S]*\}/); parsed = mm ? JSON.parse(mm[0]) : {} }

    const lineById: Record<string, string> = {}
    for (const it of (parsed.items || [])) if (it && it.cid) lineById[it.cid] = String(it.line || '').trim()

    const items = candidates
      .map((c) => ({ kind: c.kind, headline: c.question, meta: c.meta, line: lineById[c.cid] || '', href: `/markets/${c.id}` }))
      .filter((it) => it.line)

    const payload = { generatedAt: new Date().toISOString(), lede: String(parsed.lede || '').trim() || null, items }

    try { await supabaseAdmin.from('market_brief').insert({ payload }) } catch {}

    return NextResponse.json(payload)
  } catch (error: any) {
    console.error('market-brief error:', error.message)
    // Soft-fail so the homepage just hides the brief rather than erroring
    return NextResponse.json({ generatedAt: null, lede: null, items: [] }, { status: 200 })
  }
}
