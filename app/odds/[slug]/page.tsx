import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import OddsClient from './OddsClient'
import { getOddsTopic } from '@/lib/odds-topics'
import { getTopicOdds } from '@/lib/odds-data'

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
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title: topic.question, description: topic.description },
  }
}

export default async function OddsTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const topic = getOddsTopic(slug)
  if (!topic) notFound()

  let data = null
  try {
    data = await getTopicOdds(slug)
  } catch {
    data = null
  }

  const answer =
    data?.headline ||
    'Prediction markets are actively pricing this race; see the live candidate odds below.'

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
      {
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
      <OddsClient topic={{ question: topic.question, intro: topic.intro, slug }} data={data} />
      <Footer />
    </>
  )
}
