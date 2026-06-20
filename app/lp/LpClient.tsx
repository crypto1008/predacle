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
  competition?: number | null
  factors: LpFactors | null
  reward_precision: string
  fetched_at: string
}
interface ApiResponse { ok: boolean; count: number; updatedAt: string | null; opportunities: LpOpportunity[] }

const PLATFORM_LABELS: Record<string, string> = { polymarket: 'Polymarket', kalshi: 'Kalshi' }

function tierOf(score: number) {
  if (score >= 75) return { label: 'Strong', color: '#0052ff', bgL: '#eaf0ff', bgD: '#0f1d3d', bdL: '#c9dcff', bdD: '#1d3563' }
  if (score >= 60) return { label: 'Good',   color: '#d97706', bgL: '#fffbeb', bgD: '#1c1002', bdL: '#fde68a', bdD: '#78350f' }
  return                   { label: 'Fair',   color: '#5b616e', bgL: '#f5f6f8', bgD: '#26282d', bdL: '#eaecef', bdD: '#303338' }
}

// Reward-pool crowding (Polymarket only). Low = underfished (good), High = contested.
function competitionOf(c: number | null | undefined) {
  if (c == null) return null
  if (c < 0.40) return { label: 'Low',      color: '#04794e', desc: 'underfished — your share is barely diluted' }
  if (c < 0.70) return { label: 'Moderate', color: '#d97706', desc: 'a fair number of LPs likely competing' }
  return                 { label: 'High',     color: '#cf202f', desc: 'heavily contested — your share is split thin' }
}

const fmtReward = (n: number) => `$${Math.round(n).toLocaleString()}/day`
const fmtPrice  = (p: number | null) => p == null ? '—' : `${+(p * 100).toFixed(1)}¢`
const fmtCents  = (s: number | null) => s == null ? '—' : `${+(s * 100).toFixed(1)}¢`
const fmtVol    = (v: number | null) => v == null ? '—' : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`
const fmtCount  = (v: number | null) => v == null ? '—' : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : `${Math.round(v)}`

function closingBadge(days: number | null) {
  if (days == null || days < 0) return null
  if (days <= 3) return { label: `⏰ ${days}d left`, color: '#cf202f', bg: '#fdecec', border: '#f6c9cb' }
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
  const [lowComp, setLowComp] = useState(false)
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

  const headClr = dark ? '#f5f6f8' : '#0a0b0d'
  const subClr = dark ? '#8a919e' : '#5b616e'
  const metaClr = dark ? '#5b616e' : '#8a919e'
  const panelBg = dark ? '#16171a' : '#ffffff'
  const panelBorder = dark ? '#26282d' : '#eaecef'

  const opps = data?.opportunities ?? []
  // "Low competition" is a client-side filter (Polymarket-only signal; Kalshi rows have no competition value).
  const shown = lowComp ? opps.filter((o) => o.competition != null && o.competition < 0.40) : opps
  const updated = data?.updatedAt ? new Date(data.updatedAt) : null

  const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      style={{
        fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s',
        border: `1px solid ${active ? '#0052ff' : panelBorder}`,
        background: active ? (dark ? '#0f1d3d' : '#eaf0ff') : panelBg,
        color: active ? '#0052ff' : metaClr,
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
          The reward is the market&apos;s total pool, not your guaranteed share — a more contested pool
          means a thinner cut, which is what <strong style={{ color: subClr }}>Competition</strong> flags.
          Access is region-limited; check eligibility. Always check the live order book first. Not financial advice.
        </p>
      </div>

      {/* Platform + strategy filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
        {!loading && !err && (
          <span style={{ fontSize: 13, fontWeight: 600, color: headClr }}>
            {shown.length} opportunit{shown.length === 1 ? 'y' : 'ies'}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <Pill active={platform === ''} onClick={() => setPlatform('')}>All</Pill>
        <Pill active={platform === 'polymarket'} onClick={() => setPlatform('polymarket')}>Polymarket</Pill>
        <Pill active={platform === 'kalshi'} onClick={() => setPlatform('kalshi')}>Kalshi</Pill>
        <span style={{ width: 1, height: 22, background: panelBorder, margin: '0 2px' }} />
        <Pill active={bigPools} onClick={() => setBigPools((v) => !v)}>💰 $100+/day</Pill>
        <Pill active={lowComp} onClick={() => setLowComp((v) => !v)}>🟢 Low competition</Pill>
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
          <p style={{ fontSize: 14, color: '#e5484d', margin: '0 0 12px' }}>{err}</p>
          <Pill active={false} onClick={load}>Try again</Pill>
        </div>
      ) : shown.length === 0 ? (
        <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>💧</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: headClr, margin: '0 0 6px' }}>No LP opportunities match these filters</p>
          <p style={{ fontSize: 13, color: subClr, margin: 0 }}>
            {lowComp ? 'Low-competition is a Polymarket-only signal — try turning off other filters, or switch to Polymarket.' : 'Try loosening the filters above.'}
          </p>
        </div>
      ) : (
        <div style={gridStyle}>
          {shown.map((o) => <LpCard key={o.id} opp={o} dark={dark} />)}
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
      <div style={{ width: 9, height: h, background: dark ? '#26282d' : '#f5f6f8', borderRadius: 3, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
        <div style={{ width: '100%', height: Math.max(2, Math.round((value || 0) * h)), background: '#0052ff', borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 8, fontWeight: 700, color: dark ? '#5b616e' : '#8a919e' }}>{label}</span>
    </div>
  )
}

function LpCard({ opp, dark }: { opp: LpOpportunity; dark: boolean }) {
  const cardBg = dark ? '#16171a' : '#ffffff'
  const cardBorder = dark ? '#26282d' : '#eaecef'
  const footerBg = dark ? '#0d0e10' : '#fafbfc'
  const footerBorder = dark ? '#26282d' : '#f5f6f8'
  const questionClr = dark ? '#f5f6f8' : '#16181c'
  const metaClr = dark ? '#5b616e' : '#8a919e'
  const statClr = dark ? '#dfe1e6' : '#5b616e'

  const isKalshi = opp.platform === 'kalshi' || opp.reward_precision === 'qualitative'
  const t = tierOf(opp.lp_score)
  const comp = isKalshi ? null : competitionOf(opp.competition)
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
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#99b9ff'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,82,255,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
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
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: '#04794e', background: dark ? '#04291b' : '#e7f8f0', border: `1px solid ${dark ? '#0a5235' : '#bfeed8'}`, borderRadius: 4, padding: '1px 6px' }}>
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
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px', color: '#0052ff', lineHeight: 1 }}>
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
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, lineHeight: 1.15 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#04794e', letterSpacing: '-0.3px' }}>{fmtReward(opp.daily_reward)}</span>
              {comp && (
                <span title={`Competition ${Math.round((opp.competition || 0) * 100)}/100 — ${comp.desc}. Estimated from 24h volume relative to the reward pool, not a live LP count.`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: comp.color, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: comp.color, display: 'inline-block' }} />
                  {comp.label} competition
                </span>
              )}
            </span>
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
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 14px', background: footerBg, borderTop: `1px solid ${footerBorder}`, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#0052ff', width: '100%' }}
      >
        Provide liquidity on {PLATFORM_LABELS[opp.platform] || opp.platform} →
      </button>
    </article>
  )
}
