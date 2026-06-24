import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import TrackRecordClient from './TrackRecordClient'

export const revalidate = 1800

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
const DESC =
  'Do prediction markets actually get it right? Predacle scores thousands of resolved markets by comparing each one\u2019s final price against what really happened \u2014 calibration curves and accuracy across sports and politics.'

export const metadata: Metadata = {
  title: { absolute: 'Prediction Market Track Record \u2014 Calibration & Accuracy | Predacle' },
  description: DESC,
  alternates: { canonical: `${SITE}/track-record` },
  openGraph: {
    title: 'Prediction Market Track Record \u2014 How Accurate Are They?',
    description: DESC,
    url: `${SITE}/track-record`,
    siteName: 'Predacle',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prediction Market Track Record \u2014 How Accurate Are They?',
    description: DESC,
  },
}

export default function TrackRecordPage() {
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Track Record', item: `${SITE}/track-record` },
    ],
  }

  const dataset = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Prediction Market Calibration & Track Record',
    description:
      'Calibration and accuracy of resolved prediction markets, computed by comparing each market\u2019s final pre-resolution price against its real outcome, grouped by category (sports, politics).',
    url: `${SITE}/track-record`,
    creator: { '@type': 'Organization', name: 'Predacle', url: SITE },
    isAccessibleForFree: true,
    keywords: [
      'prediction market accuracy',
      'prediction market calibration',
      'Brier score',
      'are prediction markets accurate',
      'Polymarket accuracy',
      'Kalshi accuracy',
    ],
    measurementTechnique:
      'Brier score and expected calibration error (ECE) over binary resolved markets; final pre-resolution price vs realized outcome',
  }

  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }} />
      <TrackRecordClient />
      <Footer />
    </>
  )
}
