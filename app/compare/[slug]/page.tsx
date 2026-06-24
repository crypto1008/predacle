import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import CompareClient from './CompareClient'
import { getPlatform, PLATFORM_KEYS, type PlatformKey } from '@/lib/platforms'

export const revalidate = 1800

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

// Parse "a-vs-b" into two platform keys. Returns null if malformed/unknown.
function parsePair(slug: string): { a: PlatformKey; b: PlatformKey } | null {
  const parts = slug.split('-vs-')
  if (parts.length !== 2) return null
  const a = getPlatform(parts[0])
  const b = getPlatform(parts[1])
  if (!a || !b || a.key === b.key) return null
  return { a: a.key, b: b.key }
}

// Canonical order = PLATFORM_KEYS order. Prevents duplicate-content pairs
// (polymarket-vs-kalshi vs kalshi-vs-polymarket) by 301-ing to one form.
function canonicalSlug(a: PlatformKey, b: PlatformKey): string {
  const ia = PLATFORM_KEYS.indexOf(a)
  const ib = PLATFORM_KEYS.indexOf(b)
  const [first, second] = ia <= ib ? [a, b] : [b, a]
  return `${first}-vs-${second}`
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const pair = parsePair(slug)
  if (!pair) return { title: 'Compare Prediction Markets — Predacle' }
  const a = getPlatform(pair.a)!
  const b = getPlatform(pair.b)!
  const canonical = canonicalSlug(pair.a, pair.b)
  const title = `${a.label} vs ${b.label} (2026): Fees, Regulation, Markets & Live Price Gaps — Predacle`
  const desc =
    `A current comparison of ${a.label} and ${b.label} — regulation, funding, fees and market coverage — plus a live feed of markets where the two price the same event differently right now.`
  return {
    title: { absolute: title },
    description: desc,
    alternates: { canonical: `${SITE}/compare/${canonical}` },
    openGraph: {
      title: `${a.label} vs ${b.label} (2026): Full Comparison + Live Price Gaps`,
      description: desc,
      url: `${SITE}/compare/${canonical}`,
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title: `${a.label} vs ${b.label} — Predacle`, description: desc },
  }
}

export default async function ComparePairPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pair = parsePair(slug)
  if (!pair) notFound()

  // Redirect non-canonical ordering to the canonical slug (avoids duplicate content).
  const canonical = canonicalSlug(pair.a, pair.b)
  if (slug !== canonical) redirect(`/compare/${canonical}`)

  const a = getPlatform(pair.a)!
  const b = getPlatform(pair.b)!

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE}/compare/${canonical}` },
      { '@type': 'ListItem', position: 3, name: `${a.label} vs ${b.label}`, item: `${SITE}/compare/${canonical}` },
    ],
  }

  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <CompareClient aKey={a.key} bKey={b.key} />
      <Footer />
    </>
  )
}
