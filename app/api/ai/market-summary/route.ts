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

    const prompt = `You are a prediction market analyst. Analyze this market.

Question: ${market.question}
Platform: ${market.platform}
Probability: ${pct !== null ? `${pct}%` : 'Unknown'}
Volume: ${market.volume_label || 'Unknown'}
Category: ${market.category || 'General'}
Resolves: ${market.end_date_label || 'Unknown'}

Return ONLY this JSON with no other text:
{"summary":"2-3 sentences about what this market asks and what ${pct}% means","signal":"BEARISH","signal_reason":"one sentence","key_insight":"one non-obvious insight"}

Signal must be BULLISH, BEARISH, or NEUTRAL.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1024,
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

    const data = await res.json()

    // Skip thought parts — only use actual text response parts
    const parts = data.candidates?.[0]?.content?.parts || []
    const text = parts
      .filter((p: any) => !p.thought)
      .map((p: any) => p.text || '')
      .join('')
      .trim()

    console.log('Gemini response text:', text.substring(0, 300))

    if (!text) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 500 })
    }

    // Parse JSON — handle any wrapping
    let parsed: any
    try {
      // Try direct parse first (responseMimeType should give clean JSON)
      parsed = JSON.parse(text)
    } catch {
      // Fall back to regex extraction
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) {
        console.error('No JSON in response:', text)
        return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
      }
      parsed = JSON.parse(match[0])
    }

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