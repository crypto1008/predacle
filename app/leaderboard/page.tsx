import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import LeaderboardClient from './LeaderboardClient'

export const metadata: Metadata = {
  title: 'Prediction Market Accuracy Leaderboard — Predacle',
  description:
    "Which prediction market is most accurate? Predacle scores Polymarket and Kalshi by comparing every resolved market's final price against the real outcome — Brier score, calibration curve, and directional accuracy across thousands of settled markets.",
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
