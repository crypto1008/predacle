import type { Metadata } from 'next'
import ContentPage from '../components/ContentPage'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
const DESC = 'Frequently asked questions about prediction markets and how Predacle aggregates odds across Polymarket, Kalshi, Manifold and more.'

export const metadata: Metadata = {
  title: 'FAQ',
  description: DESC,
  alternates: { canonical: `${SITE}/faq` },
  // Next.js merges metadata SHALLOWLY: without an openGraph block this page
  // inherits the root layout's, whose url points at the HOMEPAGE. Every field
  // must be restated, `images` included.
  openGraph: {
    title: 'Prediction Market FAQ — Predacle',
    description: DESC,
    url: `${SITE}/faq`,
    siteName: 'Predacle',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
  twitter: { card: 'summary_large_image', site: '@PredacleHQ', title: 'Prediction Market FAQ — Predacle', description: DESC, images: ['/opengraph-image'] },
}

const faqs: [string, string][] = [
  ["What is a prediction market?", "A prediction market lets people buy and sell shares in the outcome of a future event. The share price reflects the crowd's estimated probability of that outcome. A market trading at 24 cents implies roughly a 24% chance the event happens."],
  ["Does Predacle take bets or hold my money?", "No. Predacle is an aggregator. We display markets and odds, but all trading happens on the source platform. We never hold funds or place trades on your behalf."],
  ["Which platforms does Predacle track?", "We currently aggregate Polymarket, Kalshi, Myriad, Manifold, Limitless, and Azuro."],
  ["How often is the data updated?", "Market data refreshes roughly every 30 minutes, so probabilities and volumes stay close to live."],
  ["Why do the odds differ between platforms?", "Each platform has its own traders, liquidity, and fees, so the same question can be priced differently. Those gaps are exactly what Predacle's cross-platform comparison is designed to surface."],
  ["Is Predacle free to use?", "Yes. Browsing markets, comparing odds, and reading the AI summaries is free."],
  ["Is anything on Predacle financial advice?", "No. Everything on the site is for information only and is not financial, investment, or betting advice. Always do your own research."],
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(([q, a]) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

export default function FAQPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <ContentPage title="Frequently Asked Questions" intro="The short answers to the questions we hear most.">
        {faqs.map(([q, a], i) => (
          <div key={i} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{q}</h2>
            <p>{a}</p>
          </div>
        ))}
      </ContentPage>
    </>
  )
}
