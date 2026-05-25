import { NextResponse } from 'next/server'

export async function GET() {
  const AZURO_API = 'https://api.onchainfeed.org/api/v1/public'

  const results: any = {}

  // Try multiple endpoint formats
  const endpoints = [
    `${AZURO_API}/gateway/games?state=prematch&limit=2&withConditions=true`,
    `${AZURO_API}/gateway/games?state=prematch&limit=2`,
    `${AZURO_API}/gateway/games`,
    `${AZURO_API}/gateway/markers?state=prematch&limit=2`,
    `${AZURO_API}/gateway/sports`,
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      })
      const body = await res.text()
      let parsed: any
      try { parsed = JSON.parse(body) } catch { parsed = body.slice(0, 200) }
      results[url.replace(AZURO_API, '')] = {
        status: res.status,
        keys:   typeof parsed === 'object' ? Object.keys(parsed) : parsed,
        sample: typeof parsed === 'object' ? JSON.stringify(parsed).slice(0, 300) : parsed,
      }
    } catch (e: any) {
      results[url.replace(AZURO_API, '')] = { error: e.message }
    }
  }

  return NextResponse.json(results)
}