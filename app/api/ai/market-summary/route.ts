import { NextRequest, NextResponse } from 'next/server'

export const runtime   = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const market = await request.json()
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey || apiKey === 'placeholder') {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
    }

    const pct = market.probability !== null
      ? Math.round(market.probability * 100)
      : null

    const prompt = `You are a prediction market analyst. Analyze this market for a trader.

Question: ${market.question}
Platform: ${market.platform}
Current probability: ${pct !== null ? `${pct}%` : 'Unknown'}
Volume traded: ${market.volume_label || 'Unknown'}
Category: ${market.category || 'General'}
Resolves: ${market.end_date_label || 'Unknown'}

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "summary": "2-3 sentences explaining what this market asks, what the ${pct}% probability means in plain English, and what the current trading volume suggests about market confidence",
  "signal": "BULLISH",
  "signal_reason": "One sentence explaining why this signal based on the data",
  "key_insight": "One non-obvious insight about this market that an experienced trader would find valuable"
}

Signal must be exactly one of: BULLISH, BEARISH, NEUTRAL`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Anthropic error:', err)
      return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    const parsed = JSON.parse(match[0])
    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error('AI summary error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}