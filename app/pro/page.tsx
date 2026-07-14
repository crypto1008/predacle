import { Suspense } from 'react'
import type { Metadata } from 'next'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProWaitlist from './ProWaitlist'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
const DESC = 'Predacle Pro is coming: verified arbitrage, real-time prices, price-move alerts, API access and more. Join the waitlist for early access.'

export const metadata: Metadata = {
  // The root layout applies a '%s | Predacle' template, so the brand must NOT be
  // repeated here — 'Predacle Pro — Coming Soon' rendered as
  // "Predacle Pro — Coming Soon | Predacle".
  title: { absolute: 'Predacle Pro — Coming Soon' },
  description: DESC,
  alternates: { canonical: `${SITE}/pro` },
  openGraph: {
    title: 'Predacle Pro — Coming Soon', description: DESC, url: `${SITE}/pro`,
    siteName: 'Predacle', locale: 'en_US', type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
  twitter: { card: 'summary_large_image', site: '@PredacleHQ', title: 'Predacle Pro — Coming Soon', description: DESC, images: ['/opengraph-image'] },
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
