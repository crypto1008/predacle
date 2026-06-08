import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime     = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const market = await request.json()
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || apiKey === 'placeholder') {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
    }

    // Check cache — reuse if < 24 hours old
    try {
      const { data: cached } = await supabaseAdmin
        .from('ai_summaries')
        .select('summary, signal, signal_reason, key_insight')
        .eq('market_id', market.id)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single()
      if (cached) return NextResponse.json(cached)
    } catch {}

    const pct = market.probability !== null
      ? Math.round(market.probability * 100)
      : null
    const pctLabel   = pct !== null ? `${pct}%` : 'Unknown'
    const priceLabel = pct !== null ? `${pct}%` : 'the current price'

    const prompt = `You are analyzing a prediction market for a trader. Return ONLY a JSON object.

Market: ${market.question}
Platform: ${market.platform}
Current YES price (implied probability): ${pctLabel}
Volume: ${market.volume_label || 'Unknown'}
Category: ${market.category || 'General'}
Resolves: ${market.end_date_label || 'Unknown'}

The "signal" is a VALUE judgment about whether the current YES price offers an edge. It is NOT a restatement of the probability and NOT a prediction of the outcome:
- "BULLISH" = the YES outcome looks UNDERPRICED at ${priceLabel} (buying YES has an edge).
- "BEARISH" = the YES outcome looks OVERPRICED at ${priceLabel} (the price is too high; fading it or buying NO has an edge).
- "NEUTRAL" = the price looks FAIR, or there is no clear edge either way.

Rules:
- A high probability does NOT automatically mean BEARISH, and a low probability does NOT automatically mean BULLISH. A strong favorite at 90%+ is usually FAIRLY priced (NEUTRAL); a longshot at a few percent is usually FAIRLY priced too (NEUTRAL).
- Only choose BULLISH or BEARISH when you can name a concrete reason the price is wrong (a known catalyst, an overreaction, or a structurally implausible price for the timeframe).
- When in doubt, choose NEUTRAL. Do not force a directional call.

Respond with EXACTLY this JSON (each value max 2 sentences, no text outside the JSON):
{"summary":"what this market asks and what the current price implies","signal":"NEUTRAL","signal_reason":"why the price is under, over, or fairly valued, referencing the edge rather than just the probability","key_insight":"one practical insight for a trader"}
signal must be exactly BULLISH, BEARISH, or NEUTRAL.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.1,
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
    // Filter out thinking parts — only use actual text response
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

    // Normalize the signal to exactly one of the three allowed values so a
    // stray/lowercase value can never break the UI's signal styling.
    const sig = String(parsed.signal || '').toUpperCase()
    parsed.signal = (sig === 'BULLISH' || sig === 'BEARISH') ? sig : 'NEUTRAL'

    // Cache result
    try {
      await supabaseAdmin
        .from('ai_summaries')
        .upsert({
          market_id:     market.id,
          summary:       parsed.summary,
          signal:        parsed.signal,
          signal_reason: parsed.signal_reason,
          key_insight:   parsed.key_insight,
          created_at:    new Date().toISOString(),
        }, { onConflict: 'market_id' })
    } catch {}

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('AI summary error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
