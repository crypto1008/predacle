import type { Metadata } from 'next'
import { Suspense } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import OddsHubClient from './OddsHubClient'
import { ODDS_TOPICS } from '@/lib/odds-topics'

export const revalidate = 3600

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
const DESC =
  'Aggregated prediction-market odds for major events — party, nominee and candidate probabilities pulled together across Polymarket, Kalshi and more, updated continuously on Predacle.'

export const metadata: Metadata = {
  title: { absolute: 'Prediction Market Odds — Aggregated Event Probabilities | Predacle' },
  description: DESC,
  alternates: { canonical: `${SITE}/odds` },
  openGraph: {
    title: 'Prediction Market Odds — Aggregated Event Probabilities',
    description: DESC,
    url: `${SITE}/odds`,
    siteName: 'Predacle',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
  twitter: { card: 'summary_large_image', title: 'Prediction Market Odds — Predacle', description: DESC },
}

export default function OddsHubPage() {
  const topics = Object.values(ODDS_TOPICS).map((t) => ({ slug: t.slug, question: t.question, intro: t.intro }))

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Prediction Market Odds',
    description: DESC,
    url: `${SITE}/odds`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: topics.map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: t.question,
        url: `${SITE}/odds/${t.slug}`,
      })),
    },
  }

  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <OddsHubClient topics={topics} />
      <Footer />
    </>
  )
}
