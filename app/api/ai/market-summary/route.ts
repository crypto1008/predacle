import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime    = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const market = await request.json()
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey || apiKey === 'placeholder') {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
    }

    // Check cache first — reuse summary if < 24 hours old
    const { data: cached } = await supabaseAdmin
      .from('ai_summaries')
      .select('summary, signal, signal_reason, key_insight')
      .eq('market_id', market.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single()

    if (cached) {
      return NextResponse.json(cached)
    }

    const pct = market.probability !== null
      ? Math.round(market.probability * 100)
      : null

    const prompt = `Analyze this prediction market for a trader.

Question: ${market.question}
Platform: ${market.platform}
Current probability: ${pct !== null ? `${pct}%` : 'Unknown'}
Volume traded: ${market.volume_label || 'Unknown'}
Category: ${market.category || 'General'}
Resolves: ${market.end_date_label || 'Unknown'}

Respond ONLY with valid JSON, no markdown:
{
  "summary": "2-3 sentences explaining what this market asks, what the probability means in plain English, and what the volume suggests",
  "signal": "BULLISH",
  "signal_reason": "One sentence explaining the signal",
  "key_insight": "One non-obvious insight a trader would value"
}
Signal must be exactly: BULLISH, BEARISH, or NEUTRAL`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 600, temperature: 0.3 },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    const parsed = JSON.parse(match[0])

    // Cache in Supabase for 24 hours
    await supabaseAdmin
      .from('ai_summaries')
      .upsert({
        market_id:    market.id,
        summary:      parsed.summary,
        signal:       parsed.signal,
        signal_reason: parsed.signal_reason,
        key_insight:  parsed.key_insight,
        created_at:   new Date().toISOString(),
      }, { onConflict: 'market_id' })

    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error('AI summary error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}