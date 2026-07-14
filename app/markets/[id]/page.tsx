import type { Metadata } from 'next'
import MarketDetailClient, { type Market } from './MarketDetailClient'
import { shouldIndexMarket, canonicalOddsSlug } from '@/lib/index-gate'

const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold', limitless: 'Limitless', azuro: 'Bookmaker',
}

// A price-ladder rung, e.g. "Bitcoin price on Jun 12, 2026? — $63,500 or above".
// These are near-duplicate thin pages, so we keep them out of the search index.
function isLadderRung(question?: string): boolean {
  if (!question) return false
  return /[—–-]\s*\$\s*[\d,]+(?:\.\d+)?\s*(?:or|and)\s+(?:above|below|higher|lower|more|less)\b/i.test(question)
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

  // Resolved / closed handling — these pages must not read as live odds.
  const res = market.resolution
  const outcome = res && res.resolved_outcome && res.resolved_outcome !== 'UNCLEAR'
    ? res.resolved_outcome : null
  const resolvedDate = res && res.resolved_at ? new Date(res.resolved_at).toISOString().slice(0, 10) : null
  const finalPct = res && res.final_probability != null ? Math.round(res.final_probability * 100) : pct
  const isClosed = market.status === 'closed' || market.status === 'resolved'

  let title: string
  let description: string

  if (outcome) {
    title = `Resolved: ${market.question} — ${outcome} | Predacle`
    description = `This prediction market resolved ${outcome}${resolvedDate ? ` on ${resolvedDate}` : ''}.`
      + (finalPct !== null ? ` It was trading at about ${finalPct}% beforehand.` : '')
      + ` See the final result and how ${platform} priced it on Predacle.`
  } else if (isClosed) {
    title = `Closed: ${market.question} | Predacle`
    description = `This prediction market has closed and is no longer trading${resolvedDate ? ` (as of ${resolvedDate})` : ''}.`
      + ` View its history and final odds on ${platform} via Predacle.`
  } else {
    title = pct !== null
      ? `${market.question} — ${pct}% chance | Predacle`
      : `${market.question} | Predacle`
    const parts: string[] = []
    parts.push(pct !== null
      ? `Prediction markets give this a ${pct}% probability`
      : 'Live prediction market odds')
    parts.push(`tracked on ${platform}`)
    if (market.volume_label) parts.push(`${market.volume_label} volume`)
    if (market.end_date_label) parts.push(`closes ${market.end_date_label}`)
    description = parts.join(', ') +
      '. Compare odds across Polymarket, Kalshi, Manifold and more on Predacle.'
  }

  // The index gate. `follow` ALWAYS stays: the page remains live for users and
  // link equity still flows through to the odds pages. It simply stops asking to
  // rank. The sitemap alone cannot achieve this for resolved markets — Google
  // finds those by crawling /resolved, not the sitemap, which is why archived
  // props like "Resolved: Malik Tillman: 2+ shots on target" sit in the index.
  const gate = shouldIndexMarket({
    id,
    question: market.question,
    status: market.status,
    volume: market.volume,
    end_date: market.end_date,
  })

  // Near-duplicate rungs of a set that now has a better home on a curated /odds
  // page consolidate their signal there rather than throwing it away.
  const consolidateTo = canonicalOddsSlug(market.question)
  const canonicalUrl = consolidateTo
    ? `${getBaseUrl()}/odds/${consolidateTo}`
    : url

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url, siteName: 'Predacle', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
    ...(gate.index ? {} : { robots: { index: false, follow: true } }),
  }
}

function buildJsonLd(market: Market, id: string) {
  const base = getBaseUrl()
  const url = `${base}/markets/${id}`
  const pct = market.probability != null ? Math.round(market.probability * 100) : null
  const platform = PLATFORM_LABELS[market.platform] || market.platform

  const res = market.resolution
  const outcome = res && res.resolved_outcome && res.resolved_outcome !== 'UNCLEAR'
    ? res.resolved_outcome : null
  const resolvedDate = res && res.resolved_at ? new Date(res.resolved_at).toISOString().slice(0, 10) : null
  const finalPct = res && res.final_probability != null ? Math.round(res.final_probability * 100) : null

  // Resolved markets get a definitive acceptedAnswer; live ones a suggestedAnswer (estimate).
  const answer = outcome
    ? {
        acceptedAnswer: {
          '@type': 'Answer',
          url,
          text: `This market resolved ${outcome}${resolvedDate ? ` on ${resolvedDate}` : ''}.`
            + (finalPct !== null ? ` It was trading at about ${finalPct}% before resolution.` : '')
            + ` Source: ${platform}.`,
        },
      }
    : pct !== null
      ? {
          suggestedAnswer: {
            '@type': 'Answer',
            url,
            text: `As of ${new Date().toISOString().slice(0, 10)}, prediction markets `
              + `estimate a ${pct}% probability. Based on ${platform}`
              + `${market.volume_label ? ` with ${market.volume_label} in volume` : ''}.`,
          },
        }
      : {}

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
          ...answer,
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
