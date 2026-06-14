'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type DivMarket = { platform: string; probability: number | null; url: string; volume: string | null }
type Opportunity = { question: string; markets: DivMarket[] }
type Pair = { question: string; poly: DivMarket; kal: DivMarket; gap: number }

function useDarkMode() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark'))
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

// Verified comparison rows (current as of 2026). Each: [dimension, Kalshi, Polymarket]
const ROWS: [string, string, string][] = [
  ['Regulation & safety',
    'CFTC-regulated (Designated Contract Market); balances eligible for FDIC insurance up to $250K',
    'Crypto-native; acquired CFTC-licensed QCEX in 2025 to re-enter the US — US access currently invite-only'],
  ['Money & funding',
    'US dollars — bank/ACH, debit, wire',
    'USDC stablecoin, settled on the Polygon blockchain'],
  ['US availability',
    'Available across most US states (some state-level legal challenges ongoing)',
    'US access limited (waitlist); operates globally elsewhere'],
  ['Fees',
    'Tied to the contract price',
    'Historically near-zero on the global platform'],
  ['2025 volume',
    '~$43.1B',
    '~$33.4B (global)'],
  ['Markets & coverage',
    'More markets overall; 17 sports; strong economic & financial coverage',
    'Deeper liquidity on major events; 14 sports; viral / political / crypto lean'],
  ['Best for',
    'Beginners, US bank users, and anyone who values regulatory clarity',
    'Crypto-comfortable and experienced traders who want depth'],
]

export default function ComparePolyKalshiClient() {
  const dark = useDarkMode()
  const [pairs, setPairs] = useState<Pair[] | null>(null)

  useEffect(() => {
    fetch('/api/arbitrage?minGap=0.03&realOnly=true&limit=80')
      .then(r => r.json())
      .then(d => {
        const opps: Opportunity[] = Array.isArray(d.opportunities) ? d.opportunities : []
        const pk = opps
          .map((o): Pair | null => {
            const poly = o.markets.find(m => m.platform === 'polymarket')
            const kal = o.markets.find(m => m.platform === 'kalshi')
            if (!poly || !kal || poly.probability == null || kal.probability == null) return null
            return { question: o.question, poly, kal, gap: Math.abs(poly.probability - kal.probability) }
          })
          .filter((p): p is Pair => p !== null)
          .sort((a, b) => b.gap - a.gap)
          .slice(0, 8)
        setPairs(pk)
      })
      .catch(() => setPairs([]))
  }, [])

  const bg      = dark ? '#0b0d12' : '#ffffff'
  const panel   = dark ? '#111318' : '#ffffff'
  const soft    = dark ? '#0b0d12' : '#f8fafc'
  const border  = dark ? '#1e2330' : '#e8ecf0'
  const txt1    = dark ? '#f1f5f9' : '#0f172a'
  const txt2    = dark ? '#94a3b8' : '#64748b'
  const txt3    = dark ? '#475569' : '#94a3b8'
  const purple  = '#5f5cf0'
  const pillBg  = dark ? '#1e1b4b' : '#ede9fe'

  const wrap = { maxWidth: 860, margin: '0 auto', padding: '0 20px' } as const
  const h2: React.CSSProperties = { fontSize: 19, fontWeight: 700, color: txt1, letterSpacing: '-0.2px', marginBottom: 12 }

  return (
    <div style={{ background: soft }}>
      {/* Hero */}
      <div style={{ background: bg, borderBottom: `1px solid ${border}`, padding: '26px 20px 20px' }}>
        <div style={wrap}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: txt1, letterSpacing: '-0.5px' }}>
            Polymarket vs Kalshi
          </h1>
          <p style={{ fontSize: 14.5, color: txt2, marginTop: 8, lineHeight: 1.55, maxWidth: 680 }}>
            The two biggest prediction markets, compared on what actually matters — regulation, fees,
            funding, and coverage — plus a live look at where they price the same event differently
            right now. Updated for 2026.
          </p>
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ padding: '24px 20px 8px' }}>
        <div style={wrap}>
          <h2 style={h2}>At a glance</h2>
          <div style={{ border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden', background: panel }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: txt3, textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: `1px solid ${border}` }} />
              <div style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: purple, borderBottom: `1px solid ${border}`, borderLeft: `1px solid ${border}` }}>Kalshi</div>
              <div style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, color: purple, borderBottom: `1px solid ${border}`, borderLeft: `1px solid ${border}` }}>Polymarket</div>
              {ROWS.map(([dim, k, p], i) => (
                <div key={dim} style={{ display: 'contents' }}>
                  <div style={{ padding: '12px 14px', fontSize: 12.5, fontWeight: 600, color: txt2, borderBottom: i < ROWS.length - 1 ? `1px solid ${border}` : 'none' }}>{dim}</div>
                  <div style={{ padding: '12px 14px', fontSize: 13, color: txt1, lineHeight: 1.45, borderLeft: `1px solid ${border}`, borderBottom: i < ROWS.length - 1 ? `1px solid ${border}` : 'none' }}>{k}</div>
                  <div style={{ padding: '12px 14px', fontSize: 13, color: txt1, lineHeight: 1.45, borderLeft: `1px solid ${border}`, borderBottom: i < ROWS.length - 1 ? `1px solid ${border}` : 'none' }}>{p}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Narrative */}
      <div style={{ padding: '20px 20px 4px' }}>
        <div style={wrap}>
          <h2 style={h2}>The core difference</h2>
          <p style={{ fontSize: 14, color: txt2, lineHeight: 1.65 }}>
            The single biggest distinction is regulatory structure. Kalshi operates as a CFTC-regulated
            Designated Contract Market, so balances are held in US dollars with the legal protections of a
            regulated exchange and familiar bank funding. Polymarket grew up as a crypto-native platform
            settling in USDC on Polygon; in 2025 it acquired the CFTC-licensed QCEX to begin a regulated US
            return, but US access is still limited. For most US traders that regulatory gap is the deciding
            factor — Kalshi for certainty and bank deposits, Polymarket for liquidity, depth, and a
            crypto-first experience.
          </p>
        </div>
      </div>

      {/* Live divergences — the unique angle */}
      <div style={{ padding: '20px 20px 8px' }}>
        <div style={wrap}>
          <h2 style={h2}>⚡ Where they disagree right now</h2>
          <p style={{ fontSize: 13.5, color: txt2, lineHeight: 1.55, marginBottom: 14 }}>
            Live markets where Polymarket and Kalshi are pricing the same event differently. A gap can be a
            real edge — or it can come from thinner liquidity or slightly different resolution rules, so
            treat it as a starting point, not a guarantee.
          </p>

          {pairs === null ? (
            <p style={{ fontSize: 13, color: txt3, padding: '20px 0' }}>Loading live prices…</p>
          ) : pairs.length === 0 ? (
            <p style={{ fontSize: 13, color: txt3, padding: '20px 0' }}>
              No notable Polymarket–Kalshi divergences at the moment — the two are largely in agreement right now.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pairs.map((p, i) => (
                <div key={i} style={{ background: panel, border: `1px solid ${border}`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: txt1, lineHeight: 1.4, marginBottom: 10 }}>{p.question}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <a href={p.poly.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13, color: txt2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: purple, background: pillBg, padding: '2px 8px', borderRadius: 6 }}>Polymarket</span>
                      <strong style={{ color: txt1, fontVariantNumeric: 'tabular-nums' }}>{p.poly.probability}%</strong>
                    </a>
                    <span style={{ color: txt3, fontSize: 13 }}>vs</span>
                    <a href={p.kal.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13, color: txt2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: purple, background: pillBg, padding: '2px 8px', borderRadius: 6 }}>Kalshi</span>
                      <strong style={{ color: txt1, fontVariantNumeric: 'tabular-nums' }}>{p.kal.probability}%</strong>
                    </a>
                    <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                      {p.gap} pt gap
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 12.5, color: txt3, marginTop: 14 }}>
            See all cross-platform gaps on the{' '}
            <Link href="/arbitrage" style={{ color: purple, textDecoration: 'none', fontWeight: 600 }}>Divergence</Link> page.
          </p>
        </div>
      </div>

      {/* How to choose */}
      <div style={{ padding: '20px 20px 8px' }}>
        <div style={wrap}>
          <h2 style={h2}>How to choose</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <div style={{ background: panel, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: txt1, marginBottom: 8 }}>Choose Kalshi if…</div>
              <p style={{ fontSize: 13, color: txt2, lineHeight: 1.6 }}>
                you’re in the US and want bank funding, you value regulatory clarity and insured balances,
                or you’re new to prediction markets and want the simpler on-ramp.
              </p>
            </div>
            <div style={{ background: panel, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: txt1, marginBottom: 8 }}>Choose Polymarket if…</div>
              <p style={{ fontSize: 13, color: txt2, lineHeight: 1.6 }}>
                you’re comfortable with crypto wallets and USDC, you want the deepest liquidity on major
                political and crypto events, or you’re trading from outside the US.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{ padding: '16px 20px 44px' }}>
        <div style={wrap}>
          <p style={{ fontSize: 11.5, color: txt3, lineHeight: 1.6 }}>
            Predacle aggregates public market data and is not affiliated with Polymarket or Kalshi.
            Figures reflect publicly reported information and may change. Nothing here is financial advice.
          </p>
        </div>
      </div>
    </div>
  )
}
