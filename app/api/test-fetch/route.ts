import { NextResponse } from 'next/server'

export async function GET() {
  const results: Record<string, any> = {}

  try {
    const r = await fetch(
      'https://api.limitless.exchange/markets/active?limit=5',
      {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      }
    )
    const text = await r.text()
    let parsed: any = null
    try { parsed = JSON.parse(text) } catch { /* ignore */ }
    results.limitless = {
      status: r.status,
      length: text.length,
      dataKey: Object.keys(parsed || {}),
      dataLength: parsed?.data?.length || 0,
      firstTitle: parsed?.data?.[0]?.title || null,
      firstPrices: parsed?.data?.[0]?.prices || null,
      rawPreview: text.substring(0, 500),
    }
  } catch (e: unknown) {
    results.limitless = {
      error: e instanceof Error ? e.message : String(e),
    }
  }

  return NextResponse.json(results)
}