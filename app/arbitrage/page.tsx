import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import DivergenceClient from './DivergenceClient'

export const metadata: Metadata = {
  title: 'Price Divergence — Predacle',
  description:
    'Where prediction markets disagree on the same outcome. Compare live prices for the same event across Polymarket, Kalshi, Myriad, Manifold, Limitless and more.',
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
