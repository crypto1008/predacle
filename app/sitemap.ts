import { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { PLATFORM_KEYS, getPlatform } from '@/lib/platforms'
import { ODDS_TOPIC_SLUGS } from '@/lib/odds-topics'
import { shouldIndexMarket, canonicalOddsSlug } from '@/lib/index-gate'

// Build canonical compare-pair slugs. Only "anchored" pairs (at least one of the
// well-documented platforms) go in the sitemap, to avoid thin two-stub pages.
const RICH = new Set(['polymarket', 'kalshi'])
function comparePairUrls(now: Date): MetadataRoute.Sitemap {
  const b0 = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
  const out: MetadataRoute.Sitemap = []
  for (let i = 0; i < PLATFORM_KEYS.length; i++) {
    for (let j = i + 1; j < PLATFORM_KEYS.length; j++) {
      const a = PLATFORM_KEYS[i], b = PLATFORM_KEYS[j]
      if (!RICH.has(a) && !RICH.has(b)) continue          // skip thin pairs
      if (!getPlatform(a) || !getPlatform(b)) continue
      out.push({
        url: `${b0}/compare/${a}-vs-${b}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }
  }
  return out
}

export const revalidate = 3600

const base = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

// A price-ladder rung — thin, near-duplicate content we keep out of the sitemap.
function isLadderRung(question?: string | null): boolean {
  if (!question) return false
  return /[—–-]\s*\$\s*[\d,]+(?:\.\d+)?\s*(?:or|and)\s+(?:above|below|higher|lower|more|less)\b/i.test(question)
}

// Only markets that pass the index gate go in the sitemap.
//
// WAS: every active non-ladder market -> ~7,000 URLs. Search Console reported
// 42 indexed and 6,929 "Discovered - currently not indexed": Google sampled the
// set, found ephemeral near-duplicates, and deferred the crawl on the rest —
// with the curated /odds pages queued behind them.
//
// NOW: volume >= $50k AND >= 7 days to resolution AND active AND not a ladder
// rung AND not a Kalshi outcome set. Measured at ~15% of a live sample, so
// roughly 1,050 URLs. Markets canonicalised to an /odds page are also dropped —
// the odds page is already listed and is the URL we want ranked.
async function getAllMarkets(): Promise<{ id: string; lastmod: string | null }[]> {
  const pageSize = 1000
  let from = 0
  const all: { id: string; lastmod: string | null }[] = []
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('markets')
      .select('id, fetched_at, created_at, question, status, volume, end_date')
      .eq('status', 'active')
      .is('ladder_key', null) // exclude tagged ladder rungs
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error || !data || data.length === 0) break
    for (const m of data) {
      const gate = shouldIndexMarket({
        id: m.id,
        question: m.question,
        status: m.status,
        volume: m.volume,
        end_date: m.end_date,
      })
      if (!gate.index) continue
      // Consolidated onto a curated odds page — that page is the ranking target.
      if (canonicalOddsSlug(m.question)) continue
      all.push({ id: m.id, lastmod: m.fetched_at || m.created_at || null })
    }
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'always', priority: 1 },
    { url: `${base}/markets`, lastModified: now, changeFrequency: 'always', priority: 0.9 },
    { url: `${base}/category/crypto`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/category/sports`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/category/politics`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/category/economics`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/category/tech`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/category/science`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/category/entertainment`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/resolved`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/resolved/crypto`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/resolved/sports`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/resolved/politics`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/resolved/economics`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/resolved/tech`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    ...comparePairUrls(now),
    { url: `${base}/odds`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.7 },
    ...ODDS_TOPIC_SLUGS.map((slug) => ({
      url: `${base}/odds/${slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
    { url: `${base}/track-record`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/how-it-works`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/guides/lp-rewards`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  let marketEntries: MetadataRoute.Sitemap = []
  try {
    const markets = await getAllMarkets()
    marketEntries = markets.map((m) => ({
      url: `${base}/markets/${m.id}`,
      lastModified: m.lastmod ? new Date(m.lastmod) : now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }))
  } catch {
    marketEntries = []
  }

  return [...staticEntries, ...marketEntries]
}
