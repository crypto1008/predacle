import { ImageResponse } from 'next/og'

export const alt = 'Predacle — Every prediction market, one place'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Default Open Graph image for the homepage and every page that doesn't define
// its own (about, faq, markets list, etc.). Market detail pages override this
// with their own dynamic image. Mirrors the dark, Coinbase-blue brand styling.
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: '#0a0b0d', padding: 64, justifyContent: 'space-between', fontFamily: 'sans-serif' }}>

        {/* top row: wordmark + live badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: 14, background: '#0052ff', marginRight: 18 }}>
              <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#ffffff' }}>P</div>
            </div>
            <div style={{ display: 'flex', fontSize: 44, fontWeight: 800, color: '#f5f6f8' }}>Predacle</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, color: '#9aa0ab',
            background: '#16171a', border: '1px solid #26282d', borderRadius: 100, padding: '10px 22px' }}>
            <div style={{ display: 'flex', width: 12, height: 12, borderRadius: 6, background: '#05a66b', marginRight: 12 }} />
            <div style={{ display: 'flex' }}>Live · 6 platforms</div>
          </div>
        </div>

        {/* headline */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, color: '#f5f6f8', lineHeight: 1.05 }}>Every prediction</div>
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, color: '#f5f6f8', lineHeight: 1.05 }}>market, one place.</div>
        </div>

        {/* bottom row: platforms + url */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 27, color: '#9aa0ab' }}>
            Polymarket · Kalshi · Myriad · Manifold · Limitless · Bookmaker
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: '#5b616e' }}>predacle.com</div>
        </div>
      </div>
    ),
    { ...size }
  )
}
