import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import ComparePolyKalshiClient from './ComparePolyKalshiClient'

export const metadata: Metadata = {
  title: 'Polymarket vs Kalshi (2026): Regulation, Fees, Markets & Live Price Gaps — Predacle',
  description:
    'A current comparison of Polymarket and Kalshi — regulation, fees, funding, markets and 2025 volume — plus a live feed of markets where the two platforms price the same event differently right now.',
  alternates: { canonical: '/compare/polymarket-vs-kalshi' },
  openGraph: {
    title: 'Polymarket vs Kalshi (2026): Full Comparison + Live Price Gaps',
    description:
      'Regulation, fees, funding, markets and volume compared — plus live markets where Polymarket and Kalshi disagree on the same event.',
    type: 'article',
  },
}

export default function ComparePage() {
  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <ComparePolyKalshiClient />
      <Footer />
    </>
  )
}
