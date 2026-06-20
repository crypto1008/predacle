import { Suspense } from 'react'
import type { Metadata } from 'next'
import Header from './components/Header'
import Footer from './components/Footer'
import HomeClient from './components/HomeClient'

export const metadata: Metadata = {
  title: 'Predacle — Prediction Market Aggregator',
  description: 'Browse 16,000+ prediction markets across Polymarket, Kalshi, Myriad, Manifold, Limitless and Azuro. Live probabilities, real trading volumes, all in one place.',
  openGraph: {
    title: 'Predacle — Prediction Market Aggregator',
    description: 'Browse 16,000+ prediction markets across 6 platforms. Live probabilities, real trading volumes.',
  },
}

export default function HomePage() {
  return (
    <>
      <Suspense fallback={
        <div style={{ height: 56, background: '#fff', borderBottom: '1px solid #eaecef' }} />
      }>
        <Header />
      </Suspense>
      <HomeClient />
      <Footer />
    </>
  )
}