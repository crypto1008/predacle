import { Suspense } from 'react'
import type { Metadata } from 'next'
import Header from '../components/Header'
import Footer from '../components/Footer'
import AISearchClient from './AISearchClient'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
const DESC = 'Search prediction markets in plain English. Describe what you want — "cheap longshots closing this week", "liquid crypto markets" — and Predacle finds them across six platforms.'

export const metadata: Metadata = {
  // absolute: bypasses the root '%s | Predacle' template. 'AI Search — Predacle'
  // was rendering as "AI Search — Predacle | Predacle".
  title: { absolute: 'AI Prediction Market Search — Predacle' },
  description: DESC,
  alternates: { canonical: `${SITE}/search` },
  openGraph: {
    title: 'AI Prediction Market Search', description: DESC, url: `${SITE}/search`,
    siteName: 'Predacle', locale: 'en_US', type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
  twitter: { card: 'summary_large_image', site: '@PredacleHQ', title: 'AI Prediction Market Search', description: DESC, images: ['/opengraph-image'] },
}

export default function SearchPage() {
  return (
    <>
      <Suspense fallback={<div style={{ height: 64, borderBottom: '1px solid #eaecef' }} />}>
        <Header />
      </Suspense>
      <Suspense fallback={null}>
        <AISearchClient />
      </Suspense>
      <Footer />
    </>
  )
}
