import { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import ResolvedArchiveClient, { ResolvedItem, ArchiveCat } from './ResolvedArchiveClient'
import { RESOLVED_CATS } from './categories'

export const revalidate = 1800

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
const DESC =
  'Browse resolved prediction markets and their final outcomes, aggregated from Polymarket and Kalshi. See what actually happened and how the market priced it beforehand.'

export const metadata: Metadata = {
  title: { absolute: 'Resolved Prediction Markets — Outcomes & Results Archive | Predacle' },
  description: DESC,
  alternates: { canonical: `${SITE}/resolved` },
  openGraph: {
    title: 'Resolved Prediction Markets — Outcomes Archive',
    description: DESC,
    url: `${SITE}/resolved`,
    siteName: 'Predacle',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
  twitter: { card: 'summary_large_image', title: 'Resolved Prediction Markets — Outcomes Archive', description: DESC },
}

async function getRecent(): Promise<ResolvedItem[]> {
  try {
    const { data } = await supabaseAdmin
      .from('market_resolutions')
      .select('id, question, category, resolved_outcome, final_probability, resolved_at')
      .order('resolved_at', { ascending: false })
      .limit(60)
    return (data as ResolvedItem[]) || []
  } catch {
    return []
  }
}

async function getCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  await Promise.all(
    RESOLVED_CATS.map(async (c) => {
      try {
        const { count } = await supabaseAdmin
          .from('market_resolutions')
          .select('*', { count: 'exact', head: true })
          .eq('category', c.slug)
        out[c.slug] = count || 0
      } catch {
        out[c.slug] = 0
      }
    })
  )
  return out
}

export default async function ResolvedIndexPage() {
  const [items, counts] = await Promise.all([getRecent(), getCounts()])
  const categories: ArchiveCat[] = RESOLVED_CATS.map((c) => ({ ...c, count: counts[c.slug] || 0 }))
  const url = `${SITE}/resolved`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Markets', item: `${SITE}/markets` },
          { '@type': 'ListItem', position: 3, name: 'Resolved', item: url },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: 'Resolved Prediction Markets',
        description: DESC,
        url,
        isPartOf: { '@type': 'WebSite', name: 'Predacle', url: SITE },
      },
      {
        '@type': 'Dataset',
        name: 'Predacle Resolved Prediction Markets',
        description:
          'Historical outcomes of resolved prediction markets aggregated from Polymarket and Kalshi, including the final market-implied probability before each market resolved.',
        url,
        creator: { '@type': 'Organization', name: 'Predacle', url: SITE },
        isAccessibleForFree: true,
        license: `${SITE}/terms`,
        keywords: [
          'prediction markets',
          'resolved markets',
          'market outcomes',
          'Polymarket',
          'Kalshi',
          'forecasting',
          'calibration',
        ],
        variableMeasured: ['resolved outcome', 'final probability before resolution', 'resolution date'],
      },
    ],
  }

  const intro =
    'Every market eventually settles. This is the archive of prediction markets that have resolved — what actually happened, when, and how the market priced it right before resolution. Browse by category to study how each type of market tends to play out.'

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ResolvedArchiveClient
        h1="Resolved Prediction Markets"
        intro={intro}
        items={items}
        categories={categories}
      />
    </>
  )
}
