import { Suspense } from 'react'
import type { Metadata } from 'next'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProWaitlist from './ProWaitlist'

export const metadata: Metadata = {
  title: 'Predacle Pro — Coming Soon',
  description:
    'Predacle Pro is coming: verified arbitrage, real-time prices, price-move alerts, API access and more. Join the waitlist for early access.',
}

export default function ProPage() {
  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <ProWaitlist />
      <Footer />
    </>
  )
}
