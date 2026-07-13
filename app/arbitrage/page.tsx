import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import DivergenceClient from './DivergenceClient'

export const metadata: Metadata = {
  // Root layout applies the '%s | Predacle' template, so the brand must NOT be
  // repeated here (that produced "Price Divergence — Predacle | Predacle").
  title: 'Price Divergence',
  description:
    'Where prediction markets disagree on the same outcome. Compare live prices for the same event across Polymarket, Kalshi, Myriad, Manifold, Limitless and more.',
  alternates: { canonical: '/arbitrage' },
  openGraph: {
    title: 'Prediction Market Price Divergence — Predacle',
    description:
      'Where prediction markets disagree on the same outcome. Compare live prices across Polymarket, Kalshi, Myriad, Manifold and Limitless.',
    url: '/arbitrage',
    siteName: 'Predacle',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
}

export default function ArbitragePage() {
  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <DivergenceClient />
      <Footer />
    </>
  )
}
