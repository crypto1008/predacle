import { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export const revalidate = 3600

const base = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

// A price-ladder rung — thin, near-duplicate content we keep out of the sitemap.
function isLadderRung(question?: string | null): boolean {
  if (!question) return false
  return /[—–-]\s*\$\s*[\d,]+(?:\.\d+)?\s*(?:or|and)\s+(?:above|below|higher|lower|more|less)\b/i.test(question)
}

async function getAllMarkets(): Promise<{ id: string; lastmod: string | null }[]> {
  const pageSize = 1000
  let from = 0
  const all: { id: string; lastmod: string | null }[] = []
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('markets')
      .select('id, fetched_at, created_at, question')
      .eq('status', 'active')
      .is('ladder_key', null) // exclude tagged ladder rungs
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error || !data || data.length === 0) break
    for (const m of data) {
      if (isLadderRung(m.question)) continue // belt-and-suspenders for any untagged stragglers
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
    { url: `${base}/compare/polymarket-vs-kalshi`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/how-it-works`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
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
