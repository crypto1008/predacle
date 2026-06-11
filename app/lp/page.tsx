import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import LpClient from './LpClient'

export const metadata: Metadata = {
  title: 'LP Rewards Scanner — Predacle',
  description:
    'Find the best Polymarket liquidity-provider reward opportunities. Ranked by the Predacle LP Score — daily reward pool, time to resolution, price band, spread health and volume.',
}

export default function LpPage() {
  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <LpClient />
      <Footer />
    </>
  )
}
