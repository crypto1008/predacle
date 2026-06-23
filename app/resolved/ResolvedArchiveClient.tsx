'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'

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

export interface ResolvedItem {
  id: string
  question: string
  category: string | null
  resolved_outcome: string | null
  final_probability: number | null
  resolved_at: string | null
}

export interface ArchiveCat {
  slug: string
  name: string
  emoji: string
  count: number
}

export default function ResolvedArchiveClient({
  h1,
  intro,
  items,
  categories,
  currentSlug,
}: {
  h1: string
  intro: string
  items: ResolvedItem[]
  categories: ArchiveCat[]
  currentSlug?: string
}) {
  const dark = useDarkMode()

  const bg = dark ? '#0a0b0d' : '#ffffff'
  const cardBg = dark ? '#101114' : '#ffffff'
  const border = dark ? '#26282d' : '#eaecef'
  const txt1 = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2 = dark ? '#8a919e' : '#5b616e'
  const chipBg = dark ? '#16171a' : '#f5f6f8'

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''
  const outColor = (o: string | null) =>
    o === 'YES' ? '#04794e' : o === 'NO' ? '#cf202f' : '#5b616e'
  const outBg = (o: string | null) =>
    o === 'YES' ? (dark ? '#04291b' : '#e7f8f0')
      : o === 'NO' ? (dark ? '#1c0202' : '#fdecec')
      : chipBg

  const currentName = currentSlug ? categories.find((c) => c.slug === currentSlug)?.name : null

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <Suspense fallback={
        <div style={{ height: 64, background: '#fff', borderBottom: '1px solid #eaecef' }} />
      }>
        <Header />
      </Suspense>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 64px' }}>
        {/* Breadcrumb */}
        <nav style={{ fontSize: 13, color: txt2, marginBottom: 16 }} aria-label="Breadcrumb">
          <Link href="/" style={{ color: txt2, textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 8px' }}>›</span>
          <Link href="/markets" style={{ color: txt2, textDecoration: 'none' }}>Markets</Link>
          <span style={{ margin: '0 8px' }}>›</span>
          {currentName ? (
            <>
              <Link href="/resolved" style={{ color: txt2, textDecoration: 'none' }}>Resolved</Link>
              <span style={{ margin: '0 8px' }}>›</span>
              <span style={{ color: txt1 }}>{currentName}</span>
            </>
          ) : (
            <span style={{ color: txt1 }}>Resolved</span>
          )}
        </nav>

        <h1
          style={{
            fontFamily: 'Sora, Inter, sans-serif',
            fontSize: 30,
            fontWeight: 700,
            color: txt1,
            letterSpacing: '-0.6px',
            marginBottom: 10,
            lineHeight: 1.2,
          }}
        >
          {h1}
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.65, color: txt2, maxWidth: 760, marginBottom: 22 }}>{intro}</p>

        {/* Category nav */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 26 }}>
          <Link href="/resolved" style={{ textDecoration: 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: !currentSlug ? '#0052ff' : chipBg, border: `1px solid ${!currentSlug ? '#0052ff' : border}`, fontSize: 13, fontWeight: 600, color: !currentSlug ? '#fff' : txt1 }}>
              All
            </span>
          </Link>
          {categories.map((c) => (
            <Link key={c.slug} href={`/resolved/${c.slug}`} style={{ textDecoration: 'none' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: currentSlug === c.slug ? '#0052ff' : chipBg, border: `1px solid ${currentSlug === c.slug ? '#0052ff' : border}`, fontSize: 13, fontWeight: 600, color: currentSlug === c.slug ? '#fff' : txt1 }}>
                {c.emoji} {c.name}{c.count ? ` · ${c.count.toLocaleString()}` : ''}
              </span>
            </Link>
          ))}
        </div>

        {/* Resolved list */}
        {items.length === 0 ? (
          <p style={{ fontSize: 14, color: txt2 }}>
            No resolved markets here yet. <Link href="/markets" style={{ color: '#0052ff', fontWeight: 600 }}>Browse live markets</Link>.
          </p>
        ) : (
          <div style={{ border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden', background: cardBg }}>
            {items.map((m, i) => (
              <Link
                key={m.id}
                href={`/markets/${m.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderTop: i === 0 ? 'none' : `1px solid ${border}`,
                  textDecoration: 'none',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.3px',
                    padding: '3px 9px',
                    borderRadius: 6,
                    background: outBg(m.resolved_outcome),
                    color: outColor(m.resolved_outcome),
                    minWidth: 44,
                    textAlign: 'center',
                  }}
                >
                  {m.resolved_outcome === 'YES' ? 'YES' : m.resolved_outcome === 'NO' ? 'NO' : 'OTHER'}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: txt1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.question}
                </span>
                <span style={{ flexShrink: 0, fontSize: 12, color: txt2, whiteSpace: 'nowrap' }}>
                  {fmtDate(m.resolved_at)}
                  {m.final_probability != null ? ` · ${Math.round(m.final_probability * 100)}% before` : ''}
                </span>
              </Link>
            ))}
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          <Link
            href="/markets"
            style={{ display: 'inline-block', padding: '11px 18px', borderRadius: 10, background: '#0052ff', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
          >
            Browse live markets →
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
