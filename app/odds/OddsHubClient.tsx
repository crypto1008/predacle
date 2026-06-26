'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type TopicCard = { slug: string; question: string; intro: string }

function useDarkMode() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

export default function OddsHubClient({ topics }: { topics: TopicCard[] }) {
  const dark = useDarkMode()

  const bg     = dark ? '#0a0b0d' : '#ffffff'
  const panel  = dark ? '#16171a' : '#ffffff'
  const soft   = dark ? '#0d0e10' : '#f5f6f8'
  const border = dark ? '#26282d' : '#eaecef'
  const txt1   = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2   = dark ? '#8a919e' : '#5b616e'
  const txt3   = dark ? '#5b616e' : '#8a919e'
  const blue   = '#0052ff'

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '24px 20px 64px' }}>
        <nav style={{ fontSize: 13, color: txt2, marginBottom: 16 }} aria-label="Breadcrumb">
          <Link href="/" style={{ color: txt2, textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 8px', color: txt3 }}>&rsaquo;</span>
          <span style={{ color: txt1 }}>Odds</span>
        </nav>

        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px', color: txt1 }}>
          Prediction Market Odds
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: txt2, maxWidth: 680, margin: '0 0 32px' }}>
          Plain-English answers to &ldquo;what are the odds of X?&rdquo; — each page pulls together every
          related market across platforms into one aggregated, continuously-updated view, so you see where the
          money actually sits rather than a single market in isolation.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {topics.map((t) => (
            <Link
              key={t.slug}
              href={`/odds/${t.slug}`}
              style={{
                display: 'block',
                border: `1px solid ${border}`,
                borderRadius: 14,
                padding: '20px 22px',
                textDecoration: 'none',
                background: panel,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 700, color: txt1, margin: '0 0 6px' }}>{t.question}</h2>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: txt2, margin: 0 }}>{t.intro}</p>
              <span style={{ display: 'inline-block', marginTop: 12, fontSize: 14, fontWeight: 600, color: blue }}>
                See the odds →
              </span>
            </Link>
          ))}
        </div>

        {/* Go deeper interlinks */}
        <section style={{ background: soft, border: `1px solid ${border}`, borderRadius: 12, padding: '18px 20px', marginTop: 30 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px', color: txt1 }}>Go deeper</h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: txt2, margin: 0 }}>
            See how accurate markets have been on our{' '}
            <Link href="/track-record" style={{ color: blue, textDecoration: 'none' }}>track record</Link>
            {' '}page, browse all{' '}
            <Link href="/markets" style={{ color: blue, textDecoration: 'none' }}>live markets</Link>
            , or compare platforms on{' '}
            <Link href="/compare/polymarket-vs-kalshi" style={{ color: blue, textDecoration: 'none' }}>Polymarket vs Kalshi</Link>.
          </p>
        </section>
      </main>
    </div>
  )
}
