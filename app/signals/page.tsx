import type { Metadata } from 'next'
import SignalsClient from './SignalsClient'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
const DESC = 'The biggest probability moves across real-money prediction markets over the last 24 hours — where the money is repricing right now. Play money excluded, settling markets separated. Updated every 30 minutes.'

export const metadata: Metadata = {
  title: { absolute: 'Prediction Market Signals — Biggest 24h Odds Moves | Predacle' },
  description: DESC,
  alternates: { canonical: `${SITE}/signals` },
  openGraph: {
    title: 'Prediction Market Signals — Biggest 24h Odds Moves',
    description: DESC,
    url: `${SITE}/signals`,
    siteName: 'Predacle',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
  twitter: { card: 'summary_large_image', site: '@PredacleHQ', title: 'Prediction Market Signals — Biggest 24h Odds Moves', description: DESC, images: ['/opengraph-image'] },
}

const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
}

export default function SignalsPage() {
  return (
    <>
      <h1 style={srOnly}>Prediction Market Signals — Biggest 24-Hour Odds Moves</h1>
      <p style={srOnly}>{DESC}</p>
      <SignalsClient />
    </>
  )
}
