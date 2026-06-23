import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import ResolvedArchiveClient, { ResolvedItem, ArchiveCat } from '../ResolvedArchiveClient'
import { RESOLVED_CATS, resolvedCat } from '../categories'

export const revalidate = 1800

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

async function getItems(slug: string): Promise<ResolvedItem[]> {
  try {
    const { data } = await supabaseAdmin
      .from('market_resolutions')
      .select('id, question, category, resolved_outcome, final_probability, resolved_at')
      .eq('category', slug)
      .order('resolved_at', { ascending: false })
      .limit(100)
    return (data as ResolvedItem[]) || []
  } catch {
    return []
  }
}

async function getCount(slug: string): Promise<number> {
  try {
    const { count } = await supabaseAdmin
      .from('market_resolutions')
      .select('*', { count: 'exact', head: true })
      .eq('category', slug)
    return count || 0
  } catch {
    return 0
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ category: string }> }
): Promise<Metadata> {
  const { category } = await params
  const cat = resolvedCat(category)
  const url = `${SITE}/resolved/${category}`
  if (!cat) {
    return { title: 'Resolved markets not found | Predacle', alternates: { canonical: url }, robots: { index: false } }
  }
  const title = `Resolved ${cat.name} Prediction Markets — Outcomes & Results | Predacle`
  const description = `See how ${cat.name.toLowerCase()} prediction markets resolved: final outcomes and the market-implied probability before each settled. Aggregated from Polymarket and Kalshi.`
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'Predacle', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function ResolvedCategoryPage(
  { params }: { params: Promise<{ category: string }> }
) {
  const { category } = await params
  const cat = resolvedCat(category)
  if (!cat) notFound()

  const [items, count] = await Promise.all([getItems(category), getCount(category)])
  const categories: ArchiveCat[] = RESOLVED_CATS.map((c) => ({ ...c, count: c.slug === category ? count : 0 }))
  const url = `${SITE}/resolved/${category}`

  const description = `Historical outcomes of resolved ${cat.name.toLowerCase()} prediction markets aggregated from Polymarket and Kalshi, including the final probability before each resolved.`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Markets', item: `${SITE}/markets` },
          { '@type': 'ListItem', position: 3, name: 'Resolved', item: `${SITE}/resolved` },
          { '@type': 'ListItem', position: 4, name: cat.name, item: url },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: `Resolved ${cat.name} Prediction Markets`,
        description,
        url,
        isPartOf: { '@type': 'WebSite', name: 'Predacle', url: SITE },
      },
      {
        '@type': 'Dataset',
        name: `Predacle Resolved ${cat.name} Prediction Markets`,
        description,
        url,
        creator: { '@type': 'Organization', name: 'Predacle', url: SITE },
        isAccessibleForFree: true,
        license: `${SITE}/terms`,
        keywords: ['prediction markets', 'resolved markets', cat.name.toLowerCase(), 'Polymarket', 'Kalshi', 'forecasting'],
        variableMeasured: ['resolved outcome', 'final probability before resolution', 'resolution date'],
      },
    ],
  }

  const intro = `How ${cat.name.toLowerCase()} prediction markets actually resolved — the final outcome of each, when it settled, and the market-implied probability right before resolution. A running archive of ${cat.name.toLowerCase()} results across Polymarket and Kalshi.`

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ResolvedArchiveClient
        h1={`Resolved ${cat.name} Prediction Markets`}
        intro={intro}
        items={items}
        categories={categories}
        currentSlug={category}
      />
    </>
  )
}
