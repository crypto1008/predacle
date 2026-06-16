'use client'

import { useState, useEffect } from 'react'
import { affiliateUrl } from '@/lib/affiliate'

interface LpFactors { reward: number; time: number; price: number; spread: number; volume: number }
interface LpOpportunity {
  id: string; platform: string; question: string; url: string
  daily_reward: number; min_size: number | null; max_spread: number | null
  price: number | null; spread: number | null; days: number | null
  volume_24hr: number | null; open_interest: number | null
  lp_score: number; competition?: number | null; factors: LpFactors | null; reward_precision: string; fetched_at: string
}

const PLATFORM_LABELS: Record<string, string> = { polymarket: 'Polymarket', kalshi: 'Kalshi' }

function tierOf(score: number) {
  if (score >= 75) return { label: 'Strong', color: '#5f5cf0', bgL: '#ede9fe', bgD: '#1e1b4b', bdL: '#c7d2fe', bdD: '#312e81' }
  if (score >= 60) return { label: 'Good',   color: '#d97706', bgL: '#fffbeb', bgD: '#1c1002', bdL: '#fde68a', bdD: '#78350f' }
  return                   { label: 'Fair',   color: '#64748b', bgL: '#f1f5f9', bgD: '#1e2330', bdL: '#e2e8f0', bdD: '#2d3748' }
}

// Reward-pool crowding (Polymarket only). Low = underfished (good), High = contested.
function competitionOf(c: number | null | undefined) {
  if (c == null) return null
  if (c < 0.40) return { label: 'Low',      color: '#059669', desc: 'underfished — your share is barely diluted' }
  if (c < 0.70) return { label: 'Moderate', color: '#d97706', desc: 'a fair number of LPs likely competing' }
  return                 { label: 'High',     color: '#dc2626', desc: 'heavily contested — your share is split thin' }
}

const fmtReward = (n: number) => `$${Math.round(n).toLocaleString()}/day`
const fmtPrice  = (p: number | null) => p == null ? '—' : `${+(p * 100).toFixed(1)}¢`
const fmtCents  = (s: number | null) => s == null ? '—' : `${+(s * 100).toFixed(1)}¢`
const fmtVol    = (v: number | null) => v == null ? '—' : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`
const fmtCount  = (v: number | null) => v == null ? '—' : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : `${Math.round(v)}`

function FactorBar({ label, value, dark, title }: { label: string; value: number; dark: boolean; title: string }) {
  const h = 28
  return (
    <div title={title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 10, height: h, background: dark ? '#1e2330' : '#f1f5f9', borderRadius: 3, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
        <div style={{ width: '100%', height: Math.max(2, Math.round((value || 0) * h)), background: '#5f5cf0', borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color: dark ? '#64748b' : '#94a3b8' }}>{label}</span>
    </div>
  )
}

export default function MarketLpPanel({ marketId, platform, dark }: { marketId: string; platform: string; dark: boolean }) {
  const [opp, setOpp] = useState<LpOpportunity | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // Only Polymarket and Kalshi run LP reward programs; skip the fetch otherwise.
    if (platform !== 'polymarket' && platform !== 'kalshi') { setLoaded(true); return }
    let alive = true
    fetch(`/api/lp?id=${encodeURIComponent(marketId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) { setOpp(d?.opportunities?.[0] ?? null); setLoaded(true) } })
      .catch(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [marketId, platform])

  // Invisible until we confirm this market is reward-eligible (most markets aren't).
  if (!loaded || !opp) return null

  const cardBg  = dark ? '#111318' : '#ffffff'
  const border  = dark ? '#1e2330' : '#e8ecf0'
  const divider = dark ? '#1e2330' : '#f1f5f9'
  const txt1    = dark ? '#f1f5f9' : '#0f172a'
  const txt2    = dark ? '#64748b' : '#94a3b8'
  const statClr = dark ? '#cbd5e1' : '#475569'

  const isKalshi = opp.platform === 'kalshi' || opp.reward_precision === 'qualitative'
  const t = tierOf(opp.lp_score)
  const comp = isKalshi ? null : competitionOf(opp.competition)
  const f = opp.factors

  const stats: [string, string][] = isKalshi
    ? [['price', fmtPrice(opp.price)], ['spread', fmtCents(opp.spread)], ['resolves', opp.days == null ? '—' : `${opp.days}d`], ['volume', fmtCount(opp.volume_24hr)], ['open int', fmtCount(opp.open_interest)]]
    : [['price', fmtPrice(opp.price)], ['spread', fmtCents(opp.spread)], ['resolves', opp.days == null ? '—' : `${opp.days}d`], ['volume', fmtVol(opp.volume_24hr)], ['min order', opp.min_size == null ? '—' : `$${opp.min_size}`], ['band', opp.max_spread == null ? '—' : `${opp.max_spread}¢`]]

  const handleOpen = () => {
    if (!opp.url) return
    fetch('/api/track-click', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market_id: opp.id, platform: opp.platform, url: opp.url }),
    }).catch(() => {})
    window.open(affiliateUrl(opp.platform, opp.url), '_blank', 'noopener,noreferrer')
  }

  const label = PLATFORM_LABELS[opp.platform] || opp.platform

  return (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: txt1 }}>💧 LP Rewards</h2>
          <p style={{ fontSize: 12, color: txt2, marginTop: 2 }}>Earn for providing liquidity near the midpoint</p>
        </div>
        <span title={`LP Score ${opp.lp_score}/100`} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: t.color, background: dark ? t.bgD : t.bgL, border: `1px solid ${dark ? t.bdD : t.bdL}`, borderRadius: 5, padding: '3px 8px' }}>
          {t.label}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px' }}>
        {/* Score + reward */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.5px', color: '#5f5cf0', lineHeight: 1 }}>
            {opp.lp_score}<span style={{ fontSize: 13, fontWeight: 700, marginLeft: 1, color: txt2 }}>/100</span>
          </span>
          <span style={{ fontSize: 12, color: txt2 }}>LP Score</span>
          <div style={{ flex: 1 }} />
          {isKalshi ? (
            <span style={{ textAlign: 'right', lineHeight: 1.25 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#854f0b' }}>Rewards eligible</span><br />
              <span style={{ fontSize: 11, color: txt2 }}>pool not published</span>
            </span>
          ) : (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, lineHeight: 1.15 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#059669', letterSpacing: '-0.3px' }}>{fmtReward(opp.daily_reward)}</span>
              {comp && (
                <span title={`Competition ${Math.round((opp.competition || 0) * 100)}/100 — ${comp.desc}. Estimated from 24h volume relative to the reward pool, not a live LP count.`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: comp.color, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: comp.color, display: 'inline-block' }} />
                  {comp.label} competition
                </span>
              )}
            </span>
          )}
        </div>

        {/* Factor bars */}
        {f && (
          <div style={{ display: 'flex', gap: 9, marginBottom: 16 }}>
            {!isKalshi && <FactorBar label="R" value={f.reward} dark={dark} title={`Reward pool: ${Math.round(f.reward * 100)}/100`} />}
            <FactorBar label="T" value={f.time} dark={dark} title={`Time to resolution: ${Math.round(f.time * 100)}/100`} />
            <FactorBar label="P" value={f.price} dark={dark} title={`Price band: ${Math.round(f.price * 100)}/100`} />
            <FactorBar label="S" value={f.spread} dark={dark} title={`Spread health: ${Math.round(f.spread * 100)}/100`} />
            <FactorBar label="V" value={f.volume} dark={dark} title={`${isKalshi ? 'Activity' : 'Volume'}: ${Math.round(f.volume * 100)}/100`} />
            <div style={{ flex: 1 }} />
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 16 }}>
          {stats.map(([k, v]) => (
            <span key={k} style={{ fontSize: 12, color: txt2, whiteSpace: 'nowrap' }}>
              {k} <strong style={{ color: statClr, fontWeight: 700 }}>{v}</strong>
            </span>
          ))}
        </div>

        {/* Note */}
        <p style={{ fontSize: 11, color: txt2, lineHeight: 1.5, marginBottom: 14 }}>
          {isKalshi
            ? 'Kalshi runs a liquidity-incentive program but doesn’t publish per-market pools — verify the live pool and your region’s eligibility on Kalshi. You earn whether or not your orders fill. Not financial advice.'
            : 'This is the market’s total daily pool, not your guaranteed share — your earnings depend on your share of resting liquidity near the midpoint, so a more contested pool means a thinner cut. Check the live order book first. Not financial advice.'}
        </p>

        {/* CTA + link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button onClick={handleOpen}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 20px', background: '#5f5cf0', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#fff' }}>
            Provide liquidity on {label} →
          </button>
          <a href="/lp" style={{ fontSize: 12, fontWeight: 600, color: '#5f5cf0', textDecoration: 'none' }}>See all LP opportunities →</a>
        </div>
      </div>
    </div>
  )
}
