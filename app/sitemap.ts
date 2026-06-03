import { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export const revalidate = 3600

const base = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

async function getAllMarkets(): Promise<{ id: string; lastmod: string | null }[]> {
  const pageSize = 1000
  let from = 0
  const all: { id: string; lastmod: string | null }[] = []
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('markets')
      .select('id, fetched_at, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error || !data || data.length === 0) break
    for (const m of data) {
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
