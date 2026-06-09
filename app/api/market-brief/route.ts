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
// Platforms with trustworthy volume figures (Myriad inflates, Manifold is play
// money, Limitless/Azuro are niche) — used to pick "high volume" highlights and
// to prefer a clean leg to headline/link a divergence to.
const TRUSTED = new Set(['polymarket', 'kalshi', 'limitless'])
const TRUSTED_VOL = new Set(['polymarket', 'kalshi'])

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

// Strongest clean real-money divergences for the brief. Both legs of the gap
// must be real money and non-suspect; we headline/link to the highest-volume
// trusted real leg (never the play-money member that happened to sort first).
// Myriad-driven gaps are down-weighted: cleaner pairs rank first, and at most
// one Myriad-involving gap is allowed, so the brief doesn't lean on a single
// lower-trust source twice.
function topDivergences(data: any[]) {
  const { realClusters } = matchMarkets(data)
  const repByPlatform = (g: any[]) => {
    const b: Record<string, any> = {}
    for (const m of g) { const v = m.volume || 0; if (!b[m.platform] || v > (b[m.platform].volume || 0)) b[m.platform] = m }
    return b
  }
  const qualifying = (realClusters as any[][])
    .map((g) => {
      const reps = Object.values(repByPlatform(g)) as any[]
      const priced = reps.filter((m) => m.probability != null)
      if (priced.length < 2) return null
      const probs = priced.map((m) => m.probability as number)
      const maxP = Math.max(...probs)
      const minP = Math.min(...probs)
      const high = priced.find((m) => m.probability === maxP)
      const low = priced.find((m) => m.probability === minP)
      // The gap itself must be between two real-money, non-extreme legs.
      if (!high || !low || !isReal(high.platform) || !isReal(low.platform)) return null
      if (high.probability >= 0.98 || low.probability <= 0.02) return null
      const gapPercent = Math.round((maxP - minP) * 100)
      if (gapPercent < 8) return null
      // Headline + link the cleanest real leg: trusted platform first, then volume.
      const primary = [...priced.filter((m) => isReal(m.platform))].sort((a, b) => {
        const ta = TRUSTED.has(a.platform) ? 1 : 0
        const tb = TRUSTED.has(b.platform) ? 1 : 0
        if (tb !== ta) return tb - ta
        return (b.volume || 0) - (a.volume || 0)
      })[0]
      return {
        linkId: primary.id,
        question: primary.question,
        gapPercent,
        high: high.platform as string,
        low: low.platform as string,
        myriad: high.platform === 'myriad' || low.platform === 'myriad',
      }
    })
    .filter((d): d is NonNullable<typeof d> => !!d)
    // Cleaner (non-Myriad) pairs first, then by gap size.
    .sort((a, b) => (a.myriad === b.myriad ? b.gapPercent - a.gapPercent : (a.myriad ? 1 : -1)))

  // Take up to 2, allowing at most one Myriad-involving gap.
  const out: typeof qualifying = []
  let myriadUsed = 0
  for (const d of qualifying) {
    if (d.myriad && myriadUsed >= 1) continue
    if (d.myriad) myriadUsed++
    out.push(d)
    if (out.length >= 2) break
  }
  return out
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

    const divs = topDivergences(data)
    const usedIds = new Set(divs.map((d) => d.linkId))

    // High-volume highlights: trusted platforms only, live 5%-95% band (no dead
    // longshots / near-certain markets), de-duped by question so we don't show
    // two slices of the same event.
    const seen = new Set<string>()
    const topVol: any[] = []
    for (const m of [...data]
      .filter((m) =>
        m.probability != null && m.volume && !usedIds.has(m.id) &&
        TRUSTED_VOL.has(m.platform) && m.probability >= 0.05 && m.probability <= 0.95)
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))) {
      const key = (m.question || '').toLowerCase().slice(0, 30)
      if (seen.has(key)) continue
      seen.add(key)
      topVol.push(m)
      if (topVol.length >= 2) break
    }

    const candidates: any[] = []
    divs.forEach((d, i) => candidates.push({
      cid: `d${i}`, kind: 'divergence', id: d.linkId, question: d.question,
      meta: `${d.gapPercent}pt gap · ${PLATFORM_LABELS[d.high] || d.high} vs ${PLATFORM_LABELS[d.low] || d.low}`,
      fact: `Price divergence: ${PLATFORM_LABELS[d.high] || d.high} prices "yes" about ${d.gapPercent} points higher than ${PLATFORM_LABELS[d.low] || d.low} on the same outcome.`,
    }))
    topVol.forEach((m, i) => candidates.push({
      cid: `v${i}`, kind: 'volume', id: m.id, question: m.question,
      meta: `${m.volume_label || 'High volume'} · ${PLATFORM_LABELS[m.platform] || m.platform}`,
      fact: `A heavily-traded market on ${PLATFORM_LABELS[m.platform] || m.platform} (${m.volume_label || 'high volume'}), currently around ${Math.round((m.probability || 0) * 100)}% implied probability.`,
    }))

    if (!candidates.length) {
      return NextResponse.json({ generatedAt: new Date().toISOString(), lede: null, items: [] })
    }

    const list = candidates.map((c, i) => `${i + 1}. [${c.cid}] "${c.question}" — ${c.fact}`).join('\n')
    const prompt = `You are the editor of a prediction-market brief. For each situation below, write ONE short, substantive line — a genuine observation a sharp reader would value (what the price implies, what is worth watching). Do NOT simply restate the gap size or the volume figure. Honest and specific, no hype, no financial advice, and do not invent specific facts beyond what a knowledgeable reader would already know about the topic.

For a price divergence, frame it as a disagreement BETWEEN the two venues — do not assume the higher or the lower price is the "correct" one. Note where relevant that a gap can reflect thinner liquidity or a stale quote on one venue, not necessarily stronger conviction.

Situations:
${list}

Return ONLY this JSON:
{"lede":"one sentence, max 22 words, on what stands out across these situations right now","items":[{"cid":"d0","line":"one line, max 20 words, with a real observation — not a restatement of the numbers"}]}
Include exactly one item per situation, matching its cid exactly.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.4, responseMimeType: 'application/json' },
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
    return NextResponse.json({ generatedAt: null, lede: null, items: [] }, { status: 200 })
  }
}
