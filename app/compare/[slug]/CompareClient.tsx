'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getPlatform, type PlatformKey } from '@/lib/platforms'

type DivMarket = { platform: string; probability: number | null; url: string; volume: string | null }
type Opportunity = { question: string; markets: DivMarket[] }
type Pair = { question: string; a: DivMarket; b: DivMarket; gap: number }

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

export default function CompareClient({ aKey, bKey }: { aKey: PlatformKey; bKey: PlatformKey }) {
  const dark = useDarkMode()
  const A = getPlatform(aKey)!
  const B = getPlatform(bKey)!
  const [pairs, setPairs] = useState<Pair[] | null>(null)

  // Live divergences for this specific platform pair.
  useEffect(() => {
    fetch('/api/arbitrage?minGap=0.03&realOnly=true&limit=120')
      .then(r => r.json())
      .then(d => {
        const opps: Opportunity[] = Array.isArray(d.opportunities) ? d.opportunities : []
        const raw = opps
          .map((o): Pair | null => {
            const ma = o.markets.find(m => m.platform === aKey)
            const mb = o.markets.find(m => m.platform === bKey)
            if (!ma || !mb || ma.probability == null || mb.probability == null) return null
            const a = ma.probability, b = mb.probability
            // Skip near-settled legs (resolution-timing artifacts, not real disagreement).
            if (a >= 90 || a <= 10 || b >= 90 || b <= 10) return null
            return { question: o.question, a: ma, b: mb, gap: Math.abs(a - b) }
          })
          .filter((p): p is Pair => p !== null)
          .sort((x, y) => y.gap - x.gap)

        // Collapse ladder rungs of the same event to a single widest-gap row.
        const seen = new Set<string>()
        const deduped: Pair[] = []
        for (const p of raw) {
          const baseKey = p.question.split(/[\u2014\u2013]/)[0].trim().toLowerCase()
          if (seen.has(baseKey)) continue
          seen.add(baseKey)
          deduped.push(p)
        }
        setPairs(deduped.slice(0, 6))
      })
      .catch(() => setPairs([]))
  }, [aKey, bKey])

  const bg     = dark ? '#0a0b0d' : '#ffffff'
  const panel  = dark ? '#16171a' : '#ffffff'
  const soft   = dark ? '#0d0e10' : '#f5f6f8'
  const border = dark ? '#26282d' : '#eaecef'
  const txt1   = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2   = dark ? '#8a919e' : '#5b616e'
  const txt3   = dark ? '#5b616e' : '#8a919e'
  const blue   = '#0052ff'

  const h2 = { fontSize: 18, fontWeight: 700, color: txt1, margin: '0 0 14px' } as const
  const playMoney = A.money === 'play' || B.money === 'play'
  const caveat = A.caveat || B.caveat

  // The comparison rows, composed from the facts module.
  const ROWS: [string, string, string][] = [
    ['Regulation & safety', A.regulation, B.regulation],
    ['Money & funding', A.funding, B.funding],
    ['Markets & coverage', A.coverage, B.coverage],
    ['Fees', A.fees, B.fees],
    ['Best for', A.bestFor, B.bestFor],
  ]

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <main style={{ maxWidth: 940, margin: '0 auto', padding: '24px 20px 64px' }}>
        {/* Breadcrumb */}
        <nav style={{ fontSize: 13, color: txt2, marginBottom: 16 }} aria-label="Breadcrumb">
          <Link href="/" style={{ color: txt2, textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 8px', color: txt3 }}>&rsaquo;</span>
          <span style={{ color: txt1 }}>{A.label} vs {B.label}</span>
        </nav>

        <h1 style={{ fontSize: 30, fontWeight: 800, color: txt1, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
          {A.label} vs {B.label}
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: txt2, maxWidth: 720, margin: '0 0 24px' }}>
          Two prediction-market platforms compared on what actually matters — regulation, funding, fees and
          coverage — plus a live feed of markets where {A.label} and {B.label} price the same event differently
          right now.
        </p>

        {/* Play-money caveat — prominent, never buried */}
        {playMoney && caveat && (
          <div style={{
            background: dark ? '#231a02' : '#fff8e6',
            border: `1px solid ${dark ? '#5c4708' : '#f5d775'}`,
            borderRadius: 12, padding: '14px 16px', marginBottom: 26,
          }}>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: dark ? '#f0d98a' : '#7a5b00', margin: 0 }}>
              <strong>Heads up:</strong> {caveat}
            </p>
          </div>
        )}

        {/* At a glance */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={h2}>At a glance</h2>
          <div style={{ border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: soft, borderBottom: `1px solid ${border}` }}>
              <div style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: txt3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dimension</div>
              <div style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: txt1 }}>{A.label}</div>
              <div style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: txt1 }}>{B.label}</div>
            </div>
            {ROWS.map(([dim, av, bv], i) => (
              <div key={dim} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: i < ROWS.length - 1 ? `1px solid ${border}` : 'none', background: panel }}>
                <div style={{ padding: '14px', fontSize: 13, fontWeight: 600, color: txt2 }}>{dim}</div>
                <div style={{ padding: '14px', fontSize: 14, color: txt1, lineHeight: 1.5 }}>{av}</div>
                <div style={{ padding: '14px', fontSize: 14, color: txt1, lineHeight: 1.5 }}>{bv}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Live divergences — the unique angle */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={h2}>⚡ Where they disagree right now</h2>
          {pairs === null && <p style={{ color: txt2, fontSize: 14 }}>Loading live markets…</p>}
          {pairs !== null && pairs.length === 0 && (
            <p style={{ color: txt2, fontSize: 14, lineHeight: 1.6 }}>
              No notable {A.label}–{B.label} divergences on still-uncertain markets at the moment — the two are
              largely in agreement, or don&apos;t currently share enough matched markets.
            </p>
          )}
          {pairs !== null && pairs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pairs.map((p, i) => (
                <div key={i} style={{ border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px', background: panel }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: txt1, margin: '0 0 10px', lineHeight: 1.4 }}>{p.question}</p>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                    <a href={p.a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: txt2, textDecoration: 'none' }}>
                      {A.label}: <strong style={{ color: blue }}>{p.a.probability}%</strong>
                    </a>
                    <a href={p.b.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: txt2, textDecoration: 'none' }}>
                      {B.label}: <strong style={{ color: blue }}>{p.b.probability}%</strong>
                    </a>
                    <span style={{ fontSize: 12, color: txt3, marginLeft: 'auto' }}>{p.gap.toFixed(0)} pt gap</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Interlinking: track-record + live markets */}
        <section style={{ background: soft, border: `1px solid ${border}`, borderRadius: 12, padding: '18px 20px' }}>
          <h2 style={{ ...h2, marginBottom: 8 }}>Go deeper</h2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: txt2, margin: 0 }}>
            See how well markets are calibrated on our{' '}
            <Link href="/track-record" style={{ color: blue, textDecoration: 'none' }}>prediction market track record</Link>
            {' '}page, browse{' '}
            <Link href="/resolved" style={{ color: blue, textDecoration: 'none' }}>resolved markets</Link>
            , or compare live prices across all platforms on the{' '}
            <Link href="/markets" style={{ color: blue, textDecoration: 'none' }}>markets page</Link>.
          </p>
        </section>

        <p style={{ fontSize: 12, color: txt3, marginTop: 22, lineHeight: 1.6 }}>
          Platform details are general and can change — always verify current fees, availability and terms on
          {' '}<a href={A.site} target="_blank" rel="noopener noreferrer" style={{ color: txt2 }}>{A.label}</a> and
          {' '}<a href={B.site} target="_blank" rel="noopener noreferrer" style={{ color: txt2 }}>{B.label}</a> directly.
          Not financial advice.
        </p>
      </main>
    </div>
  )
}
