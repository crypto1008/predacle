import type { Metadata } from 'next'
import MarketsClient from './MarketsClient'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
const DESC = 'Browse and compare live prediction market odds across Polymarket, Kalshi, Myriad, Manifold, Limitless and Bookmaker. Filter by category, platform, volume and probability — updated every 30 minutes.'

export const metadata: Metadata = {
  title: { absolute: 'All Prediction Markets — Live Odds Across 6 Platforms | Predacle' },
  description: DESC,
  alternates: { canonical: `${SITE}/markets` },
  openGraph: {
    title: 'All Prediction Markets — Live Odds Across 6 Platforms',
    description: DESC,
    url: `${SITE}/markets`,
    siteName: 'Predacle',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
  twitter: { card: 'summary_large_image', site: '@PredacleHQ', title: 'All Prediction Markets — Live Odds Across 6 Platforms', description: DESC, images: ['/opengraph-image'] },
}

// Server-rendered <h1> + intro so the page is not an empty shell to crawlers.
// The interactive feed (search, filters, cards) lives in MarketsClient. The
// client renders its own dynamic <h2> ("Crypto Markets", "Results for X"); this
// is the single canonical <h1> Google indexes. Visually hidden — the client UI
// supplies the visible header — but present in the SSR HTML.
const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
}

export default function MarketsPage() {
  return (
    <>
      <h1 style={srOnly}>All Prediction Markets — Live Odds Across Six Platforms</h1>
      <p style={srOnly}>{DESC}</p>
      <MarketsClient />
    </>
  )
}
