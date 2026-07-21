import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { allPostsNewestFirst } from '@/lib/blog'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
const DESC = 'Data-driven writing on prediction markets from Predacle: how accurate the markets are, where the money is moving, and what the odds actually mean.'

export const metadata: Metadata = {
  title: { absolute: 'Predacle Blog: Prediction Market Data & Analysis' },
  description: DESC,
  alternates: { canonical: `${SITE}/blog` },
  openGraph: {
    title: 'Predacle Blog: Prediction Market Data & Analysis',
    description: DESC,
    url: `${SITE}/blog`,
    siteName: 'Predacle',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle prediction market blog' }],
  },
  twitter: { card: 'summary_large_image', site: '@PredacleHQ', title: 'Predacle Blog', description: DESC, images: ['/opengraph-image'] },
}

export default function BlogIndexPage() {
  const posts = allPostsNewestFirst()
  const collection = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Predacle Blog',
    url: `${SITE}/blog`,
    description: DESC,
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${SITE}/blog/${p.slug}`,
      datePublished: p.datePublished,
      author: { '@type': 'Organization', name: p.author },
    })),
  }

  return (
    <>
      <Suspense fallback={null}><Header /></Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 64px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Blog</h1>
        <p style={{ fontSize: 16, opacity: 0.7, margin: '0 0 36px' }}>
          Data-driven writing on prediction markets. What the odds get right, where the money moves, and what the numbers actually mean.
        </p>
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid rgba(128,128,128,0.15)' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, margin: '0 0 8px', letterSpacing: '-0.01em' }}>{p.title}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.75, margin: '0 0 8px' }}>{p.description}</p>
            <span style={{ fontSize: 13, opacity: 0.55 }}>
              {new Date(p.datePublished).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · {p.readingMinutes} min read
            </span>
          </Link>
        ))}
      </main>
      <Footer />
    </>
  )
}
