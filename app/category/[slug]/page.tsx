import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import CategoryHubClient from './CategoryHubClient'

// Render on demand, then cache for 30 min (ISR). Avoids a build-time DB dependency
// while keeping pages fast and fresh once crawled.
export const revalidate = 1800

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

type Cat = {
  name: string
  h1: string
  title: string
  description: string
  intro: string
  emoji: string
}

// The canonical category set (matches the `category` values used across the app).
const CATEGORIES: Record<string, Cat> = {
  crypto: {
    name: 'Crypto',
    h1: 'Crypto Prediction Markets',
    title: 'Crypto Prediction Markets — Live Bitcoin & Ethereum Odds | Predacle',
    description:
      'Compare live crypto prediction market odds across Polymarket, Kalshi, Limitless and more. Bitcoin, Ethereum, ETF and on-chain event probabilities in one place.',
    intro:
      'Crypto prediction markets let traders price the future of Bitcoin, Ethereum and other assets — from price targets to ETF approvals and protocol upgrades. Predacle aggregates live crypto odds across Polymarket, Kalshi, Limitless and more, so you can compare probabilities and spot price gaps between platforms in one place.',
    emoji: '₿',
  },
  sports: {
    name: 'Sports',
    h1: 'Sports Prediction Markets',
    title: 'Sports Prediction Markets — Live Odds Across Platforms | Predacle',
    description:
      'Compare live sports prediction market odds across Polymarket, Kalshi and more. Games, tournaments and season-long races priced by real traders, side by side.',
    intro:
      'Sports prediction markets price the outcome of games, tournaments and season-long races in real time, often moving faster than traditional sportsbooks. Predacle brings together live sports odds across major prediction platforms so you can see where the market agrees, where it diverges, and how probabilities shift as events unfold.',
    emoji: '🏆',
  },
  politics: {
    name: 'Politics',
    h1: 'Political Prediction Markets',
    title: 'Political Prediction Markets — Live Election Odds | Predacle',
    description:
      'Compare live political prediction market odds across Polymarket, Kalshi and more. Elections, policy decisions and geopolitical events priced side by side.',
    intro:
      'Political prediction markets turn elections, policy decisions and geopolitical events into live probabilities set by real traders. Predacle aggregates political odds from Polymarket, Kalshi and other platforms, letting you compare how each market is pricing the same outcome side by side.',
    emoji: '🗳️',
  },
  economics: {
    name: 'Economics',
    h1: 'Economics Prediction Markets',
    title: 'Economics Prediction Markets — Rates, Inflation & Jobs Odds | Predacle',
    description:
      'Compare live economic prediction market odds across platforms. Interest-rate decisions, inflation prints and jobs reports priced as real-time probabilities.',
    intro:
      'Economic prediction markets track interest-rate decisions, inflation prints, jobs reports and other macro releases as live probabilities. Predacle gathers economic odds across prediction platforms so you can compare the market-implied chances of each outcome and watch them move around key data.',
    emoji: '📈',
  },
  tech: {
    name: 'Tech',
    h1: 'Tech Prediction Markets',
    title: 'Tech Prediction Markets — AI, Product & Company Odds | Predacle',
    description:
      'Compare live technology prediction market odds across platforms. AI milestones, product launches and company outcomes priced by real traders, in one place.',
    intro:
      'Technology prediction markets cover product launches, AI milestones, company outcomes and other events shaping the industry. Predacle aggregates tech odds from multiple prediction platforms, giving you a single view of how the market is pricing each question — and where platforms disagree.',
    emoji: '💻',
  },
  science: {
    name: 'Science',
    h1: 'Science Prediction Markets',
    title: 'Science Prediction Markets — Research & Space Odds | Predacle',
    description:
      'Compare live science prediction market odds across platforms. Research breakthroughs, space missions and health milestones priced as real-time probabilities.',
    intro:
      'Science prediction markets price the likelihood of research breakthroughs, space missions, health milestones and other discoveries. Predacle collects science-related odds across prediction platforms so you can compare probabilities and track how sentiment shifts as new evidence arrives.',
    emoji: '🔬',
  },
  entertainment: {
    name: 'Entertainment',
    h1: 'Entertainment Prediction Markets',
    title: 'Entertainment Prediction Markets — Awards & Box Office Odds | Predacle',
    description:
      'Compare live entertainment prediction market odds across platforms. Awards, box-office results and pop-culture events priced by real traders, in one place.',
    intro:
      'Entertainment prediction markets cover awards, box-office results, streaming releases and pop-culture events. Predacle aggregates entertainment odds from across prediction platforms, letting you compare how the market is pricing each outcome in one place.',
    emoji: '🎬',
  },
}

const ORDER = ['crypto', 'sports', 'politics', 'economics', 'tech', 'science', 'entertainment']

interface Market {
  id: string
  platform: string
  question: string
  probability: number | null
  volume: number | null
  volume_label: string | null
  end_date: string | null
  end_date_label: string | null
  traders: number | null
  category: string | null
  url: string
  status: string
  image_url?: string | null
  probability_change?: number | null
}

async function getMarkets(slug: string): Promise<Market[]> {
  try {
    const { data } = await supabaseAdmin
      .from('markets')
      .select(
        'id, platform, question, probability, volume, volume_label, end_date, end_date_label, traders, category, url, status, image_url, probability_change'
      )
      .eq('status', 'active')
      .eq('category', slug)
      .is('ladder_key', null)
      .order('volume', { ascending: false, nullsFirst: false })
      .limit(36)
    return (data as Market[]) || []
  } catch {
    return []
  }
}

async function getCount(slug: string): Promise<number> {
  try {
    const { count } = await supabaseAdmin
      .from('markets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('category', slug)
      .is('ladder_key', null)
    return count || 0
  } catch {
    return 0
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const cat = CATEGORIES[slug]
  const url = `${SITE}/category/${slug}`
  if (!cat) {
    return {
      title: 'Category not found | Predacle',
      description: 'This category could not be found.',
      alternates: { canonical: url },
      robots: { index: false },
    }
  }
  return {
    title: { absolute: cat.title },
    description: cat.description,
    alternates: { canonical: url },
    openGraph: { title: cat.title, description: cat.description, url, siteName: 'Predacle', type: 'website' },
    twitter: { card: 'summary_large_image', title: cat.title, description: cat.description },
  }
}

export default async function CategoryPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const cat = CATEGORIES[slug]
  if (!cat) notFound()

  const [markets, count] = await Promise.all([getMarkets(slug), getCount(slug)])
  const url = `${SITE}/category/${slug}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Markets', item: `${SITE}/markets` },
          { '@type': 'ListItem', position: 3, name: cat.name, item: url },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: cat.h1,
        description: cat.description,
        url,
        isPartOf: { '@type': 'WebSite', name: 'Predacle', url: SITE },
      },
    ],
  }

  const others = ORDER.filter((s) => s !== slug).map((s) => ({
    slug: s,
    name: CATEGORIES[s].name,
    emoji: CATEGORIES[s].emoji,
  }))

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CategoryHubClient
        slug={slug}
        name={cat.name}
        h1={cat.h1}
        emoji={cat.emoji}
        intro={cat.intro}
        count={count}
        initialMarkets={markets}
        others={others}
      />
    </>
  )
}
