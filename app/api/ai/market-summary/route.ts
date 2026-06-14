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
    const today      = new Date().toISOString().slice(0, 10)

    const prompt = `You are a sharp prediction-market analyst giving a trader your read. Today's date is ${today}. Return ONLY a JSON object.

Market: ${market.question}
Platform: ${market.platform}
Current YES price (implied probability): ${pctLabel}
Volume: ${market.volume_label || 'Unknown'}
Category: ${market.category || 'General'}
Resolves: ${market.end_date_label || 'Unknown'}

The "signal" is YOUR view on whether the current YES price offers value:
1. Estimate the true probability of YES from base rates and what you concretely know about THIS specific event. The market price already reflects the time left until it resolves — do not add distance-to-resolution back in as fresh uncertainty, and use today's date above to judge how near or far the resolution actually is.
2. Compare your estimate to the price (${priceLabel}).
3. Choose the signal:
   - "BULLISH" = your estimate is meaningfully HIGHER than the price (YES looks underpriced).
   - "BEARISH" = your estimate is meaningfully LOWER than the price (YES looks overpriced).
   - "NEUTRAL" = your estimate is close to the price.

Calibration rules — follow these strictly:
- A price already at an extreme (above ~90% or below ~10%) is usually there because the outcome is genuinely close to settled. Do NOT fade it just because the number feels too confident or the resolution is far off — the market has already priced that in. Only call a >90% price BEARISH (or a <10% price BULLISH) when you can name a SPECIFIC, concrete reason the crowd is wrong: a known upcoming event, a structural quirk, a fresh development. "It seems overconfident" or "anything can happen given the timeframe" is NOT a valid reason — when that is all you have, the signal is NEUTRAL.
- For mid-range prices, be willing to commit: if your fair value differs from the price by more than ~5-10 points for a concrete reason, lean BULLISH or BEARISH rather than defaulting to NEUTRAL.
- A high probability is not automatically BEARISH and a low probability is not automatically BULLISH. Judge the value, never the raw size of the number.

Respond with EXACTLY this JSON (each value max 2 sentences, no text outside the JSON):
{"summary":"what this market asks and what the current price implies","signal":"NEUTRAL","signal_reason":"your fair-value reasoning and why the price is under, over, or fairly valued","key_insight":"one practical insight for a trader"}
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
