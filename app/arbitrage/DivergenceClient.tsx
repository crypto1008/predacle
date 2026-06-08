'use client'

import { useState, useEffect } from 'react'
import { affiliateUrl } from '@/lib/affiliate'

/* ---------- types (shape returned by /api/arbitrage) ---------- */
interface OppMarket {
  platform: string
  probability: number // integer percent, e.g. 24
  url: string
  volume: string | null
}
interface Opportunity {
  fingerprint: string
  question: string
  category: string | null
  gap: number
  gapPercent: number
  threshold: string | null
  endDate: string | null
  markets: OppMarket[]
  highPlatform: string
  lowPlatform: string
  platformCount: number
  realMoney: boolean
  suspect: boolean
  score: number
  quality: 'high' | 'medium' | 'low'
}
interface ApiResponse {
  arbitrageCount: number
  minGapUsed: number
  opportunities: Opportunity[]
}

/* ---------- shared maps (matched to MarketCard) ---------- */
const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold', limitless: 'Limitless', azuro: 'Bookmaker',
}
const REAL_MONEY = new Set(['polymarket', 'kalshi', 'myriad', 'limitless', 'azuro'])
const CATEGORY_LABELS: Record<string, string> = {
  crypto: 'Crypto', sports: 'Sports', politics: 'Politics', economics: 'Econ',
  tech: 'Tech', science: 'Science', entertainment: 'Entertainment',
  football: 'Football', other: 'General',
}
const CATEGORY_ICONS: Record<string, string> = {
  crypto: '₿', sports: '🏆', politics: '🗳️', economics: '📈',
  tech: '💻', science: '🔬', entertainment: '🎬', football: '⚽', other: '🌐',
}

/* Quality grade styling (light/dark) */
const QUALITY: Record<string, { label: string; color: string; bgL: string; bgD: string; bdL: string; bdD: string }> = {
  high:   { label: '🎯 High signal',   color: '#5f5cf0', bgL: '#ede9fe', bgD: '#1e1b4b', bdL: '#c7d2fe', bdD: '#312e81' },
  medium: { label: 'Medium signal',    color: '#d97706', bgL: '#fffbeb', bgD: '#1c1002', bdL: '#fde68a', bdD: '#78350f' },
  low:    { label: 'Low signal',       color: '#94a3b8', bgL: '#f1f5f9', bgD: '#1e2330', bdL: '#e2e8f0', bdD: '#2d3748' },
}

function confColor(c: string) {
  if (c === 'high') return '#10b981'
  if (c === 'medium') return '#f59e0b'
  return '#94a3b8'
}

function probColor(pct: number) {
  if (pct >= 65) return '#10b981'
  if (pct >= 35) return '#f59e0b'
  return '#ef4444'
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getClosingBadge(end_date: string | null) {
  if (!end_date) return null
  const days = Math.ceil((new Date(end_date).getTime() - Date.now()) / 86400000)
  if (isNaN(days) || days < 0) return null
  if (days === 0) return { label: 'Closes today', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
  if (days <= 3) return { label: `⏰ ${days}d left`, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
  if (days <= 7) return { label: `⏰ ${days}d left`, color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
  return null
}

function useDark() {
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

/* =================================================================== */

export default function DivergenceClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [realOnly, setRealOnly] = useState(false)
  const [bestOnly, setBestOnly] = useState(false)
  const dark = useDark()

  const load = () => {
    setLoading(true)
    setErr(null)
    fetch('/api/arbitrage?minGap=0.02&limit=50')
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`)
        return r.json()
      })
      .then((d: ApiResponse) => setData(d))
      .catch((e) => setErr(e?.message || 'Failed to load divergences'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const headClr = dark ? '#f1f5f9' : '#0f172a'
  const subClr = dark ? '#94a3b8' : '#64748b'
  const metaClr = dark ? '#64748b' : '#94a3b8'
  const panelBg = dark ? '#111318' : '#ffffff'
  const panelBorder = dark ? '#1e2330' : '#e8ecf0'

  const opps = data?.opportunities ?? []
  const shown = (realOnly ? opps.filter((o) => o.realMoney) : opps)
    .filter((o) => !bestOnly || o.quality !== 'low')

  // Surface AI "the play" only on the strongest few, to keep it fast + cheap.
  const aiEligible = new Set(
    shown.filter((o) => o.quality !== 'low').slice(0, 8).map((o) => o.fingerprint)
  )

  /* ---- toggle pill ---- */
  const Pill = ({ active, onClick, children }: {
    active: boolean; onClick: () => void; children: React.ReactNode
  }) => (
    <button
      onClick={onClick}
      style={{
        fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
        border: `1px solid ${active ? '#5f5cf0' : panelBorder}`,
        background: active ? (dark ? '#1e1b4b' : '#ede9fe') : panelBg,
        color: active ? '#5f5cf0' : metaClr,
      }}
    >
      {children}
    </button>
  )

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px 64px' }}>
      <style>{`@keyframes predacle-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: headClr, margin: '0 0 8px' }}>
          Price Divergence
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: subClr, maxWidth: 720, margin: 0 }}>
          Where prediction markets disagree on the same outcome. Ranked by an opportunity score that
          weighs the size of the gap, how liquid the thinner side is, time to resolution, and whether
          real money is involved — a bigger gap is sometimes a real signal, sometimes just thin
          liquidity on one side. Always open each market and check the live order book before trading.
          Not financial advice.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
        {!loading && !err && (
          <span style={{ fontSize: 13, fontWeight: 600, color: headClr }}>
            {shown.length} divergence{shown.length === 1 ? '' : 's'}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <Pill active={bestOnly} onClick={() => setBestOnly((v) => !v)}>
          ✨ Best only
        </Pill>
        <Pill active={realOnly} onClick={() => setRealOnly((v) => !v)}>
          💰 Real-money only
        </Pill>
        <Pill active={false} onClick={load}>↻ Refresh</Pill>
      </div>

      {/* States */}
      {loading ? (
        <div style={gridStyle}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12,
              height: 220, animation: 'predacle-pulse 1.3s ease-in-out infinite',
              animationDelay: `${i * 0.08}s`,
            }} />
          ))}
        </div>
      ) : err ? (
        <div style={{
          background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12,
          padding: '28px 20px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: '#ef4444', margin: '0 0 12px' }}>{err}</p>
          <Pill active={false} onClick={load}>Try again</Pill>
        </div>
      ) : shown.length === 0 ? (
        <div style={{
          background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12,
          padding: '40px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🤝</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: headClr, margin: '0 0 6px' }}>
            {realOnly
              ? 'No real-money divergences right now'
              : bestOnly
              ? 'No high-quality opportunities right now'
              : 'Markets are largely in agreement'}
          </p>
          <p style={{ fontSize: 13, color: subClr, margin: 0 }}>
            {realOnly
              ? 'Try turning off the real-money filter to see play-money disagreements too.'
              : bestOnly
              ? 'Turn off “Best only” to see every cross-platform gap, including weaker ones.'
              : 'No significant cross-platform gaps at the moment. Check back later — prices move constantly.'}
          </p>
        </div>
      ) : (
        <div style={gridStyle}>
          {shown.map((opp) => (
            <OppCard key={opp.fingerprint} opp={opp} dark={dark} showAi={aiEligible.has(opp.fingerprint)} />
          ))}
        </div>
      )}
    </main>
  )
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
  gap: 16,
}

/* =================================================================== */

function OppCard({ opp, dark, showAi }: { opp: Opportunity; dark: boolean; showAi: boolean }) {
  const cardBg = dark ? '#111318' : '#ffffff'
  const cardBorder = dark ? '#1e2330' : '#e8ecf0'
  const footerBg = dark ? '#0d1117' : '#fafbfc'
  const footerBorder = dark ? '#1e2330' : '#f1f5f9'
  const trackBg = dark ? '#1e2330' : '#f1f5f9'
  const questionClr = dark ? '#f1f5f9' : '#1e293b'
  const metaClr = dark ? '#64748b' : '#94a3b8'
  const catBg = dark ? '#1e2330' : '#f8fafc'
  const catBorder = dark ? '#2d3748' : '#e2e8f0'

  const cLabel = opp.category ? (CATEGORY_LABELS[opp.category] || opp.category) : null
  const cIcon = opp.category ? (CATEGORY_ICONS[opp.category] || '') : ''
  const closing = getClosingBadge(opp.endDate)
  const ends = fmtDate(opp.endDate)
  const q = QUALITY[opp.quality] || QUALITY.low

  const rows = [...opp.markets].sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))

  /* ---- AI "the play" (lazy, top cards only; silent until the endpoint exists) ---- */
  const [play, setPlay] = useState<string | null>(null)
  const [conf, setConf] = useState<string | null>(null)
  useEffect(() => {
    if (!showAi) return
    let alive = true
    fetch('/api/ai/opportunity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opp),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && d.play) { setPlay(d.play); setConf(d.confidence || null) } })
      .catch(() => {})
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAi, opp.fingerprint])

  const handleOpen = (m: OppMarket) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!m.url) return
    fetch('/api/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market_id: `${opp.fingerprint}:${m.platform}`, platform: m.platform, url: m.url }),
    }).catch(() => {})
    window.open(affiliateUrl(m.platform, m.url), '_blank', 'noopener,noreferrer')
  }

  return (
    <article
      style={{
        background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12,
        overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.1s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#c4b5fd'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(95,92,240,0.12)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = cardBorder
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ padding: '14px 14px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          <span
            title={`Opportunity score ${opp.score}/100`}
            style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase',
              color: q.color, background: dark ? q.bgD : q.bgL,
              border: `1px solid ${dark ? q.bdD : q.bdL}`, borderRadius: 4, padding: '1px 6px',
            }}
          >
            {q.label}
          </span>
          {cLabel && (
            <span style={{
              fontSize: 10, color: metaClr, background: catBg, border: `1px solid ${catBorder}`,
              padding: '2px 7px', borderRadius: 5, fontWeight: 500,
            }}>
              {cIcon} {cLabel}
            </span>
          )}
          {opp.threshold && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.2px', color: dark ? '#a5b4fc' : '#4f46e5',
              background: dark ? '#1e1b4b' : '#eef2ff', border: `1px solid ${dark ? '#312e81' : '#c7d2fe'}`,
              padding: '2px 7px', borderRadius: 5,
            }}>
              {opp.threshold}
            </span>
          )}
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase',
            color: opp.realMoney ? '#059669' : (dark ? '#94a3b8' : '#64748b'),
            background: opp.realMoney ? (dark ? '#052e16' : '#ecfdf5') : (dark ? '#1e2330' : '#f1f5f9'),
            border: `1px solid ${opp.realMoney ? (dark ? '#065f46' : '#a7f3d0') : (dark ? '#2d3748' : '#e2e8f0')}`,
            borderRadius: 4, padding: '1px 6px',
          }}>
            {opp.realMoney ? '💰 Real money' : 'Play money'}
          </span>
          {opp.suspect && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase',
              color: '#d97706', background: dark ? '#1c1002' : '#fffbeb',
              border: `1px solid ${dark ? '#78350f' : '#fde68a'}`, borderRadius: 4, padding: '1px 6px',
            }}>
              ⚠ Check prices
            </span>
          )}
          {closing && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.3px',
              color: closing.color, background: closing.bg, border: `1px solid ${closing.border}`,
              borderRadius: 4, padding: '1px 6px',
            }}>
              {closing.label}
            </span>
          )}
        </div>

        {/* Question */}
        <h3 className="line-clamp-2" style={{
          fontSize: 14, fontWeight: 600, lineHeight: 1.45, color: questionClr, margin: '0 0 14px',
        }}>
          {opp.question}
        </h3>

        {/* Gap headline */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: '#5f5cf0', lineHeight: 1 }}>
            {opp.gapPercent}<span style={{ fontSize: 13, fontWeight: 700, marginLeft: 1 }}>pt</span>
          </span>
          <span style={{ fontSize: 11, color: metaClr }}>
            gap · {PLATFORM_LABELS[opp.highPlatform] || opp.highPlatform} vs {PLATFORM_LABELS[opp.lowPlatform] || opp.lowPlatform}
          </span>
        </div>

        {/* AI "the play" — renders only once the endpoint returns one */}
        {play && (
          <div style={{
            marginBottom: 14, padding: '9px 10px', borderRadius: 8,
            background: dark ? '#15131f' : '#faf9ff',
            border: `1px solid ${dark ? '#312e81' : '#e9e7fb'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: '#5f5cf0' }}>
                🤖 The play
              </span>
              {conf && (
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: confColor(conf) }}>
                  · {conf} confidence
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: dark ? '#cbd5e1' : '#475569', margin: 0 }}>
              {play}
            </p>
          </div>
        )}

        {/* Platform rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 'auto' }}>
          {rows.map((m) => {
            const pct = Math.round(m.probability ?? 0)
            const pColor = probColor(pct)
            return (
              <div key={m.platform + m.url} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge-${m.platform}`} style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', padding: '2px 6px',
                  borderRadius: 5, textTransform: 'uppercase', whiteSpace: 'nowrap',
                  minWidth: 66, textAlign: 'center',
                }}>
                  {PLATFORM_LABELS[m.platform] || m.platform}
                </span>
                <div style={{ flex: 1, height: 4, background: trackBg, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: 4, width: `${pct}%`, background: pColor, borderRadius: 2, transition: 'width 0.6s' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: pColor, minWidth: 36, textAlign: 'right' }}>
                  {pct}%
                </span>
                <button
                  onClick={handleOpen(m)}
                  aria-label={`Open on ${PLATFORM_LABELS[m.platform] || m.platform}`}
                  style={{
                    fontSize: 10, fontWeight: 600, color: '#5f5cf0',
                    background: dark ? '#1e1b4b' : '#ede9fe', border: 'none',
                    padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                    fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  View →
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '9px 14px', background: footerBg, borderTop: `1px solid ${footerBorder}`,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
          {rows.filter((m) => m.volume).slice(0, 2).map((m, i) => (
            <span key={m.platform} style={{ fontSize: 10, color: metaClr, whiteSpace: 'nowrap' }}>
              {i > 0 ? '· ' : ''}{(PLATFORM_LABELS[m.platform] || m.platform).slice(0, 4)} {m.volume}
            </span>
          ))}
        </div>
        {ends && (
          <span style={{ fontSize: 11, color: metaClr, whiteSpace: 'nowrap' }}>Ends {ends}</span>
        )}
      </div>
    </article>
  )
}
