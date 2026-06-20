import { ImageResponse } from 'next/og'

export const alt = 'Predacle prediction market'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold', limitless: 'Limitless', azuro: 'Bookmaker',
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let market: any = null
  try {
    const res = await fetch(`${getBaseUrl()}/api/markets/${encodeURIComponent(id)}`,
      { next: { revalidate: 300 } })
    if (res.ok) market = await res.json()
  } catch {}

  const question = market?.question ?? 'Prediction Market'
  const pct = market?.probability != null ? Math.round(market.probability * 100) : null
  const platform = market ? (PLATFORM_LABELS[market.platform] || market.platform) : ''
  const probColor = pct == null ? '#8a919e'
    : pct >= 65 ? '#05a66b' : pct >= 35 ? '#f59e0b' : '#e5484d'

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: '#0a0b0d', padding: 64, justifyContent: 'space-between', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: '#a78bfa' }}>◆ Predacle</div>
          <div style={{ display: 'flex', fontSize: 24, color: '#5b616e', letterSpacing: 2,
            textTransform: 'uppercase' }}>{platform}</div>
        </div>
        <div style={{ display: 'flex', fontSize: 58, fontWeight: 700, color: '#f5f6f8', lineHeight: 1.2 }}>
          {question.length > 100 ? question.slice(0, 100) + '…' : question}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          {pct !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 26, color: '#5b616e', letterSpacing: 2,
                textTransform: 'uppercase' }}>Current probability</div>
              <div style={{ display: 'flex', fontSize: 150, fontWeight: 800, color: probColor,
                lineHeight: 1 }}>{pct}%</div>
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: 44, color: '#8a919e' }}>Live odds</div>
          )}
          <div style={{ display: 'flex', fontSize: 24, color: '#5b616e' }}>Odds across 6 platforms</div>
        </div>
      </div>
    ),
    { ...size }
  )
}