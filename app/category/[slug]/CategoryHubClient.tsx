'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import MarketCard from '../../components/MarketCard'

function useDarkMode() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const update = () => setDark(document.documentElement.classList.contains('dark'))
    update()
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

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

interface Other {
  slug: string
  name: string
  emoji: string
}

export default function CategoryHubClient({
  slug,
  name,
  h1,
  emoji,
  intro,
  count,
  initialMarkets,
  others,
}: {
  slug: string
  name: string
  h1: string
  emoji: string
  intro: string
  count: number
  initialMarkets: Market[]
  others: Other[]
}) {
  const dark = useDarkMode()
  const router = useRouter()

  const bg = dark ? '#0a0b0d' : '#ffffff'
  const border = dark ? '#26282d' : '#eaecef'
  const txt1 = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2 = dark ? '#8a919e' : '#5b616e'
  const chipBg = dark ? '#16171a' : '#f5f6f8'

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <Header />
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 64px' }}>
        {/* Breadcrumb */}
        <nav style={{ fontSize: 13, color: txt2, marginBottom: 16 }} aria-label="Breadcrumb">
          <Link href="/" style={{ color: txt2, textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 8px' }}>›</span>
          <Link href="/markets" style={{ color: txt2, textDecoration: 'none' }}>Markets</Link>
          <span style={{ margin: '0 8px' }}>›</span>
          <span style={{ color: txt1 }}>{name}</span>
        </nav>

        {/* Heading */}
        <h1
          style={{
            fontFamily: 'Sora, Inter, sans-serif',
            fontSize: 32,
            fontWeight: 700,
            color: txt1,
            letterSpacing: '-0.6px',
            marginBottom: 8,
            lineHeight: 1.2,
          }}
        >
          <span style={{ marginRight: 8 }}>{emoji}</span>
          {h1}
        </h1>

        <p style={{ fontSize: 14, color: txt2, marginBottom: 18 }}>
          {count.toLocaleString()} live {name.toLowerCase()} {count === 1 ? 'market' : 'markets'} across 6 platforms
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.65, color: txt2, maxWidth: 760, marginBottom: 26 }}>
          {intro}
        </p>

        {/* Cross-category links (internal linking) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 30 }}>
          {others.map((o) => (
            <Link key={o.slug} href={`/category/${o.slug}`} style={{ textDecoration: 'none' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: chipBg,
                  border: `1px solid ${border}`,
                  fontSize: 13,
                  fontWeight: 600,
                  color: txt1,
                }}
              >
                <span>{o.emoji}</span>
                {o.name}
              </span>
            </Link>
          ))}
        </div>

        {/* Market grid */}
        {initialMarkets.length === 0 ? (
          <p style={{ fontSize: 14, color: txt2 }}>
            No active {name.toLowerCase()} markets right now. Check back soon or{' '}
            <Link href="/markets" style={{ color: '#0052ff', fontWeight: 600 }}>browse all markets</Link>.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
            }}
          >
            {initialMarkets.map((m) => (
              <MarketCard key={m.id} market={m} onClick={() => router.push(`/markets/${m.id}`)} />
            ))}
          </div>
        )}

        {/* CTA row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 34 }}>
          <Link
            href={`/markets?category=${slug}`}
            style={{
              display: 'inline-block',
              padding: '11px 18px',
              borderRadius: 10,
              background: '#0052ff',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            See all {name} markets →
          </Link>
          <Link
            href="/compare/polymarket-vs-kalshi"
            style={{
              display: 'inline-block',
              padding: '11px 18px',
              borderRadius: 10,
              background: chipBg,
              border: `1px solid ${border}`,
              color: txt1,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Compare platforms →
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
