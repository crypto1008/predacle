import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime     = 'nodejs'
export const maxDuration = 30

const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold', limitless: 'Limitless', azuro: 'Bookmaker',
}

export async function POST(request: NextRequest) {
  try {
    const opp = await request.json()
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || apiKey === 'placeholder') {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
    }

    // Cache key: cluster + a coarse gap bucket, so a materially different gap
    // regenerates the read while a stable one keeps hitting cache.
    const gapPercent = Number(opp.gapPercent) || 0
    const bucket = Math.round(gapPercent / 5) * 5
    const fingerprint = String(opp.fingerprint ?? '')
    const cacheKey = `${fingerprint}:${bucket}`

    // Check cache — reuse if < 24 hours old
    try {
      const { data: cached } = await supabaseAdmin
        .from('opportunity_insights')
        .select('play, confidence')
        .eq('cache_key', cacheKey)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single()
      if (cached) return NextResponse.json(cached)
    } catch {}

    // Build a readable price line from the per-platform reps
    const priced = Array.isArray(opp.markets)
      ? opp.markets.filter((m: any) => m.probability != null)
      : []
    const priceLines = priced
      .map((m: any) => `${PLATFORM_LABELS[m.platform] || m.platform}: ${m.probability}%`)
      .join(', ')

    const highLabel = PLATFORM_LABELS[opp.highPlatform] || opp.highPlatform || 'one venue'
    const lowLabel  = PLATFORM_LABELS[opp.lowPlatform]  || opp.lowPlatform  || 'another venue'

    let daysLabel = 'unknown'
    if (opp.endDate) {
      const t = new Date(opp.endDate).getTime()
      if (!isNaN(t)) daysLabel = `${Math.ceil((t - Date.now()) / 86400000)} days`
    }

    const prompt = `You are a sharp prediction-market analyst. A cross-platform PRICE DIVERGENCE has been detected: the same event is priced differently across venues. This is NOT risk-free arbitrage — a gap can be real mispricing, but it can also come from thin liquidity, differing resolution criteria, or stale quotes. Return ONLY a JSON object.

Event: ${opp.question}
Category: ${opp.category || 'General'}
Resolves in: ${daysLabel}
Prices by venue (implied YES probability): ${priceLines || 'unknown'}
Dearer venue (prices YES highest): ${highLabel}
Cheaper venue (prices YES lowest): ${lowLabel}
Gap: ${gapPercent} points
Real money on both sides: ${opp.realMoney ? 'yes' : 'no — at least one side is play money, so this is not tradeable for real money'}
Flagged suspect (a near-0% or near-100% leg, often an artifact): ${opp.suspect ? 'yes' : 'no'}

Write:
1. "play": ONE sentence giving a trader the read — which side looks cheap or expensive and the directional edge (e.g. buy YES on the cheaper venue, or fade it on the dearer one). If the gap instead looks like noise (suspect, play money, very thin, or a likely resolution-criteria mismatch), say so plainly and advise caution. Refer to venues by name and to direction; do NOT quote exact percentages, since prices move. Honest and practical, no hype.
2. "confidence": "high", "medium", or "low" — how likely this gap is a genuine, exploitable edge rather than an artifact. Lower it for suspect, play-money, far-dated, or thin markets.

Respond with EXACTLY this JSON, each value max 2 sentences, nothing outside the JSON:
{"play":"...","confidence":"medium"}`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      }
    )
    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
    }

    const data  = await res.json()
    // Filter out thinking parts — only use the actual text response
    const parts = data.candidates?.[0]?.content?.parts || []
    const text  = parts
      .filter((p: any) => !p.thought)
      .map((p: any) => p.text || '')
      .join('')
      .trim()
    if (!text) {
      console.error('Empty response:', JSON.stringify(data).substring(0, 300))
      return NextResponse.json({ error: 'Empty AI response' }, { status: 500 })
    }

    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) {
        console.error('No JSON in:', text.substring(0, 300))
        return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
      }
      parsed = JSON.parse(match[0])
    }

    // Normalize confidence to exactly one of the three allowed values
    const c = String(parsed.confidence || '').toLowerCase()
    parsed.confidence = (c === 'high' || c === 'low') ? c : 'medium'
    parsed.play = String(parsed.play || '').trim()
    if (!parsed.play) {
      return NextResponse.json({ error: 'Empty play' }, { status: 500 })
    }

    // Cache result
    try {
      await supabaseAdmin
        .from('opportunity_insights')
        .upsert({
          cache_key:   cacheKey,
          fingerprint: fingerprint,
          play:        parsed.play,
          confidence:  parsed.confidence,
          created_at:  new Date().toISOString(),
        }, { onConflict: 'cache_key' })
    } catch {}

    return NextResponse.json({ play: parsed.play, confidence: parsed.confidence })
  } catch (error: any) {
    console.error('AI opportunity error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
