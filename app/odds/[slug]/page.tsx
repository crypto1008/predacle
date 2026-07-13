import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import OddsClient from './OddsClient'
import { getOddsTopic } from '@/lib/odds-topics'
import { getTopicOdds, getSimpleTopicOdds } from '@/lib/odds-data'
import { buildOddsFaq, ODDS_EXPLAINER } from '@/lib/odds-content'

export const revalidate = 900

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const topic = getOddsTopic(slug)
  if (!topic) return { title: 'Odds — Predacle' }
  return {
    title: { absolute: `${topic.question} | Predacle` },
    description: topic.description,
    alternates: { canonical: `${SITE}/odds/${slug}` },
    keywords: topic.keywords,
    openGraph: {
      title: topic.question,
      description: topic.description,
      url: `${SITE}/odds/${slug}`,
      siteName: 'Predacle',
      locale: 'en_US',
      type: 'article',
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
    },
    twitter: { card: 'summary_large_image', title: topic.question, description: topic.description },
  }
}

export default async function OddsTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const topic = getOddsTopic(slug)
  if (!topic) notFound()

  const structure = topic.structure || 'election'
  let data: any = null
  try {
    data = structure === 'simple' ? await getSimpleTopicOdds(slug) : await getTopicOdds(slug)
  } catch {
    data = null
  }

  const answer =
    data?.headline ||
    'Prediction markets are actively pricing this; see the live odds below.'

  // Generated from live data — no invented numbers. [] for election structure.
  const faq = buildOddsFaq(topic.question, data)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Odds', item: `${SITE}/odds/${slug}` },
          { '@type': 'ListItem', position: 3, name: topic.question, item: `${SITE}/odds/${slug}` },
        ],
      },
      // FAQPage when we have a generated FAQ (the ~20 'simple' topics); the
      // original single-question QAPage otherwise (election structure), so no
      // page ever loses its structured data. Never BOTH — Google treats QAPage
      // and FAQPage as distinct types and mixing them on one page is invalid.
      faq.length > 0
        ? {
            '@type': 'FAQPage',
            mainEntity: [
              { '@type': 'Question', name: topic.question, acceptedAnswer: { '@type': 'Answer', text: answer } },
              ...faq.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            ],
          }
        : {
            '@type': 'QAPage',
            mainEntity: {
              '@type': 'Question',
              name: topic.question,
              acceptedAnswer: { '@type': 'Answer', text: answer },
            },
          },
    ],
  }

  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <OddsClient topic={{ question: topic.question, intro: topic.intro, slug }} data={data} structure={structure} />

      {/* Server-rendered SEO content. Lives here, NOT in OddsClient, so it lands
          in the SSR HTML rather than being client-painted. */}
      <section className="odds-seo" style={{ maxWidth: 760, margin: '0 auto', padding: '8px 20px 48px' }}>
        {faq.length > 0 && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
              Frequently asked questions
            </h2>
            {faq.map((f, i) => (
              <div key={i} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{f.q}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.85 }}>{f.a}</p>
              </div>
            ))}
          </>
        )}

        <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16 }}>
          Understanding these odds
        </h2>
        {ODDS_EXPLAINER.map((s, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{s.h}</h3>
            <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.85 }}>{s.p}</p>
          </div>
        ))}
      </section>

      <Footer />
    </>
  )
}
