'use client'

import { useState, useEffect } from 'react'
import { affiliateUrl } from '@/lib/affiliate'

/* ---------- shape returned by /api/lp ---------- */
interface LpFactors { reward: number; time: number; price: number; spread: number; volume: number }
interface LpOpportunity {
  id: string
  platform: string
  question: string
  url: string
  daily_reward: number
  min_size: number | null
  max_spread: number | null
  price: number | null
  spread: number | null
  days: number | null
  volume_24hr: number | null
  open_interest: number | null
  lp_score: number
  factors: LpFactors | null
  reward_precision: string
  fetched_at: string
}
interface ApiResponse { ok: boolean; count: number; updatedAt: string | null; opportunities: LpOpportunity[] }

const PLATFORM_LABELS: Record<string, string> = { polymarket: 'Polymarket', kalshi: 'Kalshi' }

function tierOf(score: number) {
  if (score >= 75) return { label: 'Strong', color: '#5f5cf0', bgL: '#ede9fe', bgD: '#1e1b4b', bdL: '#c7d2fe', bdD: '#312e81' }
  if (score >= 60) return { label: 'Good',   color: '#d97706', bgL: '#fffbeb', bgD: '#1c1002', bdL: '#fde68a', bdD: '#78350f' }
  return                   { label: 'Fair',   color: '#64748b', bgL: '#f1f5f9', bgD: '#1e2330', bdL: '#e2e8f0', bdD: '#2d3748' }
}
const fmtReward = (n: number) => `$${Math.round(n).toLocaleString()}/day`
const fmtPrice  = (p: number | null) => p == null ? '—' : `${+(p * 100).toFixed(1)}¢`
const fmtCents  = (s: number | null) => s == null ? '—' : `${+(s * 100).toFixed(1)}¢`
const fmtVol    = (v: number | null) => v == null ? '—' : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`
const fmtCount  = (v: number | null) => v == null ? '—' : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : `${Math.round(v)}`

function closingBadge(days: number | null) {
  if (days == null || days < 0) return null
  if (days <= 3) return { label: `⏰ ${days}d left`, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
  if (days <= 7) return { label: `⏰ ${days}d left`, color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
  return null
}

function useDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

/* =================================================================== */

export default function LpClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [longHorizon, setLongHorizon] = useState(false)
  const [sweetSpot, setSweetSpot] = useState(false)
  const [bigPools, setBigPools] = useState(false)
  const [platform, setPlatform] = useState<'' | 'polymarket' | 'kalshi'>('')
  const dark = useDark()

  const load = () => {
    setLoading(true); setErr(null)
    const p = new URLSearchParams({ limit: '80' })
    if (longHorizon) p.set('minDays', '15')
    if (sweetSpot) { p.set('priceMin', '0.15'); p.set('priceMax', '0.40') }
    if (bigPools) p.set('minReward', '100')
    if (platform) p.set('platform', platform)
    fetch(`/api/lp?${p.toString()}`)
      .then((r) => { if (!r.ok) throw new Error(`Request failed (${r.status})`); return r.json() })
      .then((d: ApiResponse) => setData(d))
      .catch((e) => setErr(e?.message || 'Failed to load LP opportunities'))
      .finally(() => setLoading(false))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [longHorizon, sweetSpot, bigPools, platform])

  const headClr = dark ? '#f1f5f9' : '#0f172a'
  const subClr = dark ? '#94a3b8' : '#64748b'
  const metaClr = dark ? '#64748b' : '#94a3b8'
  const panelBg = dark ? '#111318' : '#ffffff'
  const panelBorder = dark ? '#1e2330' : '#e8ecf0'

  const opps = data?.opportunities ?? []
  const updated = data?.updatedAt ? new Date(data.updatedAt) : null

  const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      style={{
        fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s',
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

      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: headClr, margin: '0 0 8px' }}>
          LP Rewards Scanner
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: subClr, maxWidth: 760, margin: 0 }}>
          Prediction markets pay liquidity providers for posting resting orders near a market&apos;s
          midpoint — you earn whether or not your orders fill. Predacle scans reward-eligible markets,
          drops the ones no LP should touch, and ranks what&apos;s left by an{' '}
          <strong style={{ color: subClr }}>LP Score</strong>. Polymarket shows an exact daily pool;
          Kalshi runs a liquidity-incentive program but doesn&apos;t publish per-market pools, so its
          markets are scored on book health and shown as <em>eligible</em> — verify the pool on Kalshi.
          The reward is the market&apos;s total pool, not your guaranteed share. Access is region-limited;
          check eligibility. Always check the live order book first. Not financial advice.
        </p>
      </div>

      {/* Platform + strategy filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
        {!loading && !err && (
          <span style={{ fontSize: 13, fontWeight: 600, color: headClr }}>
            {opps.length} opportunit{opps.length === 1 ? 'y' : 'ies'}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <Pill active={platform === ''} onClick={() => setPlatform('')}>All</Pill>
        <Pill active={platform === 'polymarket'} onClick={() => setPlatform('polymarket')}>Polymarket</Pill>
        <Pill active={platform === 'kalshi'} onClick={() => setPlatform('kalshi')}>Kalshi</Pill>
        <span style={{ width: 1, height: 22, background: panelBorder, margin: '0 2px' }} />
        <Pill active={bigPools} onClick={() => setBigPools((v) => !v)}>💰 $100+/day</Pill>
        <Pill active={sweetSpot} onClick={() => setSweetSpot((v) => !v)}>🎯 15–40¢</Pill>
        <Pill active={longHorizon} onClick={() => setLongHorizon((v) => !v)}>📅 15+ days</Pill>
        <Pill active={false} onClick={load}>↻ Refresh</Pill>
      </div>

      {loading ? (
        <div style={gridStyle}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, height: 230,
              animation: 'predacle-pulse 1.3s ease-in-out infinite', animationDelay: `${i * 0.08}s`,
            }} />
          ))}
        </div>
      ) : err ? (
        <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#ef4444', margin: '0 0 12px' }}>{err}</p>
          <Pill active={false} onClick={load}>Try again</Pill>
        </div>
      ) : opps.length === 0 ? (
        <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>💧</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: headClr, margin: '0 0 6px' }}>No LP opportunities match these filters</p>
          <p style={{ fontSize: 13, color: subClr, margin: 0 }}>Try loosening the filters above.</p>
        </div>
      ) : (
        <div style={gridStyle}>
          {opps.map((o) => <LpCard key={o.id} opp={o} dark={dark} />)}
        </div>
      )}

      {updated && !loading && !err && (
        <p style={{ fontSize: 11, color: metaClr, textAlign: 'center', marginTop: 24 }}>
          Updated {updated.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </p>
      )}
    </main>
  )
}

const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 16 }

/* =================================================================== */

function FactorBar({ label, value, dark, title }: { label: string; value: number; dark: boolean; title: string }) {
  const h = 26
  return (
    <div title={title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{ width: 9, height: h, background: dark ? '#1e2330' : '#f1f5f9', borderRadius: 3, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
        <div style={{ width: '100%', height: Math.max(2, Math.round((value || 0) * h)), background: '#5f5cf0', borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 8, fontWeight: 700, color: dark ? '#64748b' : '#94a3b8' }}>{label}</span>
    </div>
  )
}

function LpCard({ opp, dark }: { opp: LpOpportunity; dark: boolean }) {
  const cardBg = dark ? '#111318' : '#ffffff'
  const cardBorder = dark ? '#1e2330' : '#e8ecf0'
  const footerBg = dark ? '#0d1117' : '#fafbfc'
  const footerBorder = dark ? '#1e2330' : '#f1f5f9'
  const questionClr = dark ? '#f1f5f9' : '#1e293b'
  const metaClr = dark ? '#64748b' : '#94a3b8'
  const statClr = dark ? '#cbd5e1' : '#475569'

  const isKalshi = opp.platform === 'kalshi' || opp.reward_precision === 'qualitative'
  const t = tierOf(opp.lp_score)
  const closing = closingBadge(opp.days)
  const f = opp.factors

  const stats: [string, string][] = isKalshi
    ? [
        ['price', fmtPrice(opp.price)],
        ['spread', fmtCents(opp.spread)],
        ['resolves', opp.days == null ? '—' : `${opp.days}d`],
        ['volume', fmtCount(opp.volume_24hr)],
        ['open int', fmtCount(opp.open_interest)],
      ]
    : [
        ['price', fmtPrice(opp.price)],
        ['spread', fmtCents(opp.spread)],
        ['resolves', opp.days == null ? '—' : `${opp.days}d`],
        ['volume', fmtVol(opp.volume_24hr)],
        ['min order', opp.min_size == null ? '—' : `$${opp.min_size}`],
        ['band', opp.max_spread == null ? '—' : `${opp.max_spread}¢`],
      ]

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!opp.url) return
    fetch('/api/track-click', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market_id: opp.id, platform: opp.platform, url: opp.url }),
    }).catch(() => {})
    window.open(affiliateUrl(opp.platform, opp.url), '_blank', 'noopener,noreferrer')
  }

  return (
    <article
      style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.1s' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#c4b5fd'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(95,92,240,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = cardBorder; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ padding: '14px 14px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className={`badge-${opp.platform}`} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', padding: '2px 6px', borderRadius: 5, textTransform: 'uppercase' }}>
            {PLATFORM_LABELS[opp.platform] || opp.platform}
          </span>
          <span title={`LP Score ${opp.lp_score}/100`} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: t.color, background: dark ? t.bgD : t.bgL, border: `1px solid ${dark ? t.bdD : t.bdL}`, borderRadius: 4, padding: '1px 6px' }}>
            {t.label}
          </span>
          {isKalshi ? (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: '#854f0b', background: dark ? '#1c1002' : '#fef3c7', border: `1px solid ${dark ? '#78350f' : '#fde68a'}`, borderRadius: 4, padding: '1px 6px' }}>
              🪙 Rewards eligible
            </span>
          ) : (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: '#059669', background: dark ? '#052e16' : '#ecfdf5', border: `1px solid ${dark ? '#065f46' : '#a7f3d0'}`, borderRadius: 4, padding: '1px 6px' }}>
              💰 Exact reward
            </span>
          )}
          {closing && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', color: closing.color, background: closing.bg, border: `1px solid ${closing.border}`, borderRadius: 4, padding: '1px 6px' }}>
              {closing.label}
            </span>
          )}
        </div>

        {/* Question */}
        <h3 className="line-clamp-2" style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45, color: questionClr, margin: '0 0 14px' }}>
          {opp.question}
        </h3>

        {/* Headline: LP Score + reward */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px', color: '#5f5cf0', lineHeight: 1 }}>
            {opp.lp_score}<span style={{ fontSize: 12, fontWeight: 700, marginLeft: 1, color: metaClr }}>/100</span>
          </span>
          <span style={{ fontSize: 11, color: metaClr }}>LP Score</span>
          <div style={{ flex: 1 }} />
          {isKalshi ? (
            <span style={{ textAlign: 'right', lineHeight: 1.25 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#854f0b' }}>Rewards eligible</span><br />
              <span style={{ fontSize: 11, color: metaClr }}>pool not published</span>
            </span>
          ) : (
            <span style={{ fontSize: 16, fontWeight: 800, color: '#059669', letterSpacing: '-0.3px' }}>{fmtReward(opp.daily_reward)}</span>
          )}
        </div>

        {/* Factor sparkline — 5 bars (Polymarket) or 4 (Kalshi, no reward) */}
        {f && (
          <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
            {!isKalshi && <FactorBar label="R" value={f.reward} dark={dark} title={`Reward pool: ${Math.round(f.reward * 100)}/100`} />}
            <FactorBar label="T" value={f.time} dark={dark} title={`Time to resolution: ${Math.round(f.time * 100)}/100`} />
            <FactorBar label="P" value={f.price} dark={dark} title={`Price band: ${Math.round(f.price * 100)}/100`} />
            <FactorBar label="S" value={f.spread} dark={dark} title={`Spread health: ${Math.round(f.spread * 100)}/100`} />
            <FactorBar label="V" value={f.volume} dark={dark} title={`${isKalshi ? 'Activity' : 'Volume'}: ${Math.round(f.volume * 100)}/100`} />
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 'auto' }}>
          {stats.map(([k, v]) => (
            <span key={k} style={{ fontSize: 11, color: metaClr, whiteSpace: 'nowrap' }}>
              {k} <strong style={{ color: statClr, fontWeight: 700 }}>{v}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 14px', background: footerBg, borderTop: `1px solid ${footerBorder}`, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#5f5cf0', width: '100%' }}
      >
        Provide liquidity on {PLATFORM_LABELS[opp.platform] || opp.platform} →
      </button>
    </article>
  )
}
