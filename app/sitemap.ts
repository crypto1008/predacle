import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
  const now = new Date()

  const categories = [
    'sports', 'crypto', 'politics',
    'economics', 'tech', 'science',
    'entertainment', 'other'
  ]

  const platforms = [
    'polymarket', 'kalshi', 'myriad',
    'manifold', 'limitless', 'azuro'
  ]

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: 'always',
      priority: 1,
    },
    {
      url: `${base}/markets`,
      lastModified: now,
      changeFrequency: 'always',
      priority: 0.9,
    },
    ...categories.map(cat => ({
      url: `${base}/markets/category/${cat}`,
      lastModified: now,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    })),
    ...platforms.map(p => ({
      url: `${base}/markets/platform/${p}`,
      lastModified: now,
      changeFrequency: 'hourly' as const,
      priority: 0.7,
    })),
  ]
}