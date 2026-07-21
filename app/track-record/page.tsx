import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import TrackRecordClient from './TrackRecordClient'
import { getCalibration, type CalibrationResult } from '@/lib/calibration'

// Round a 0..1 rate to a compact percentage-points string, e.g. 0.0239 -> '2.4'.
function pctPts(x: number): string {
  return (x * 100).toFixed(1)
}

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
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prediction Market Track Record \u2014 How Accurate Are They?',
    description: DESC,
  },
}

export default async function TrackRecordPage() {
  // Server-render the headline numbers into the HTML so crawlers and LLMs can
  // read and cite them. Fail-soft: if calibration can't be computed, the hero is
  // simply omitted and the interactive client below still loads.
  let cal: CalibrationResult | null = null
  try {
    cal = await getCalibration()
  } catch {
    cal = null
  }
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
    license: `${SITE}/terms`,
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
      {cal?.overall && (
        <section style={{ maxWidth: 820, margin: '0 auto', padding: '40px 20px 8px' }}>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            Are prediction markets accurate?
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, margin: '0 0 14px' }}>
            Across <strong>{(cal.totalCalibratable as number).toLocaleString()} resolved
            markets</strong>, the price landed within{' '}
            <strong>{pctPts(cal.overall.calibrationError as number)} percentage points</strong>{' '}
            of what actually happened, on average. When these markets priced something at
            70%, it came true about 70% of the time.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.8, margin: '0 0 8px' }}>
            This page scores every resolved binary market by comparing its final
            pre-resolution price against the real outcome — {(cal.categories as unknown[]).length ?
            'across ' + (cal.categories as Array<{category:string}>).map(c => c.category).join(' and ') : ''}.
            Short-term automated crypto price markets and price-ladder rungs are excluded so the
            numbers reflect genuine forecasting. Figures update as new markets resolve.
          </p>
        </section>
      )}

      <TrackRecordClient />
      <Footer />
    </>
  )
}
