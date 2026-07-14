import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import LeaderboardClient from './LeaderboardClient'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
const DESC = "Which prediction market is most accurate? Predacle scores Polymarket and Kalshi by comparing every resolved market's final price against the real outcome — Brier score, calibration curve, and directional accuracy across thousands of settled markets."

export const metadata: Metadata = {
  // absolute: the root template was appending a SECOND '| Predacle'.
  title: { absolute: 'Prediction Market Accuracy Leaderboard — Predacle' },
  description: DESC,
  alternates: { canonical: `${SITE}/leaderboard` },
  openGraph: {
    title: 'Which Prediction Market Is Most Accurate?', description: DESC, url: `${SITE}/leaderboard`,
    siteName: 'Predacle', locale: 'en_US', type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
  twitter: { card: 'summary_large_image', site: '@PredacleHQ', title: 'Which Prediction Market Is Most Accurate?', description: DESC, images: ['/opengraph-image'] },
}

export default function LeaderboardPage() {
  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <LeaderboardClient />
      <Footer />
    </>
  )
}
