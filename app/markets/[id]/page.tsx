import type { Metadata } from 'next'
import MarketDetailClient, { type Market } from './MarketDetailClient'

const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold', limitless: 'Limitless', azuro: 'Bookmaker',
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

async function getMarket(id: string): Promise<Market | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/markets/${encodeURIComponent(id)}`, {
      next: { revalidate: 300 }, // matches your 5-min data refresh
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const market = await getMarket(id)
  const url = `${getBaseUrl()}/markets/${id}`

  if (!market) {
    return {
      title: 'Market not found | Predacle',
      description: 'This prediction market could not be found.',
      alternates: { canonical: url },
      robots: { index: false },
    }
  }

  const pct = market.probability != null ? Math.round(market.probability * 100) : null
  const platform = PLATFORM_LABELS[market.platform] || market.platform

  const title = pct !== null
    ? `${market.question} — ${pct}% chance | Predacle`
    : `${market.question} | Predacle`

  const parts: string[] = []
  parts.push(pct !== null
    ? `Prediction markets give this a ${pct}% probability`
    : 'Live prediction market odds')
  parts.push(`tracked on ${platform}`)
  if (market.volume_label) parts.push(`${market.volume_label} volume`)
  if (market.end_date_label) parts.push(`closes ${market.end_date_label}`)
  const description = parts.join(', ') +
    '. Compare odds across Polymarket, Kalshi, Manifold and more on Predacle.'

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'Predacle', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

function buildJsonLd(market: Market, id: string) {
  const base = getBaseUrl()
  const url = `${base}/markets/${id}`
  const pct = market.probability != null ? Math.round(market.probability * 100) : null
  const platform = PLATFORM_LABELS[market.platform] || market.platform

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: base },
          { '@type': 'ListItem', position: 2, name: 'Markets', item: `${base}/markets` },
          { '@type': 'ListItem', position: 3, name: market.question, item: url },
        ],
      },
      {
        '@type': 'QAPage',
        mainEntity: {
          '@type': 'Question',
          name: market.question,
          text: market.question,
          ...(pct !== null && {
            suggestedAnswer: {
              '@type': 'Answer',
              url,
              text: `As of ${new Date().toISOString().slice(0, 10)}, prediction markets `
                + `estimate a ${pct}% probability. Based on ${platform}`
                + `${market.volume_label ? ` with ${market.volume_label} in volume` : ''}.`,
            },
          }),
        },
      },
    ],
  }
}

export default async function MarketPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const market = await getMarket(id)

  return (
    <>
      {market && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(market, id)) }}
        />
      )}
      <MarketDetailClient id={id} initialMarket={market} />
    </>
  )
}