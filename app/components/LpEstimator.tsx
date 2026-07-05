'use client'

import { useState, useMemo } from 'react'
import { estimateLp, type LpEstimateInput } from '@/lib/lp/estimate'

// Shared, self-contained LP reward estimator. Drops into the per-market LP panel
// and the /lp page. Pure UI over lib/lp/estimate — no wallet, no execution.

const money = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n.toFixed(n < 10 ? 2 : 0)}`
const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`

const RISK_COLOR: Record<string, string> = {
  low: '#04794e', tight: '#04794e', short: '#04794e',
  moderate: '#d97706', ok: '#d97706', medium: '#d97706',
  high: '#cf202f', wide: '#cf202f', long: '#5b616e',
  unknown: '#5b616e',
}

export default function LpEstimator({
  dailyReward, competition, price, spread, days, minSize, dark, compact,
}: {
  dailyReward: number
  competition: number | null
  price: number | null
  spread: number | null
  days: number | null
  minSize: number | null
  dark: boolean
  compact?: boolean
}) {
  const [stakeStr, setStakeStr] = useState('1000')
  const stake = Math.max(0, Number(stakeStr.replace(/[^0-9.]/g, '')) || 0)

  const est = useMemo(() => {
    const inp: LpEstimateInput = { stake, dailyReward, competition, price, spread, days, minSize }
    return estimateLp(inp)
  }, [stake, dailyReward, competition, price, spread, days, minSize])

  const txt1 = dark ? '#e6e8eb' : '#0a0b0d'
  const txt2 = dark ? '#9198a1' : '#5b616e'
  const border = dark ? '#26282d' : '#eaecef'
  const inputBg = dark ? '#1a1c1f' : '#ffffff'
  const cellBg = dark ? '#1a1c1f' : '#f8f9fb'

  const RiskChip = ({ label, level, extra }: { label: string; level: string; extra?: string }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: txt2 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: RISK_COLOR[level] || '#5b616e' }} />
      {label} <strong style={{ color: RISK_COLOR[level] || txt1, fontWeight: 700, textTransform: 'capitalize' }}>{level}</strong>
      {extra && <span style={{ color: txt2 }}>{extra}</span>}
    </span>
  )

  return (
    <div style={{ marginTop: 14, paddingTop: 16, borderTop: `1px solid ${border}` }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: txt1 }}>🧮 Estimate your rewards</span>
          <span style={{ fontSize: 10, color: txt2 }}>estimate only — not a guarantee</span>
        </div>
      )}

      {/* Stake input */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: txt2, whiteSpace: 'nowrap' }}>Your stake</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', flex: 1, maxWidth: 180, background: inputBg, border: `1px solid ${border}`, borderRadius: 8, padding: '7px 10px' }}>
          <span style={{ fontSize: 14, color: txt2, marginRight: 3 }}>$</span>
          <input
            inputMode="decimal"
            value={stakeStr}
            onChange={(e) => setStakeStr(e.target.value)}
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, fontWeight: 700, color: txt1, fontFamily: 'inherit' }}
          />
        </span>
      </label>

      {est.available ? (
        <>
          {/* Range: conservative / typical / optimistic */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            {([['Conservative', est.conservative], ['Typical', est.typical], ['Optimistic', est.optimistic]] as const).map(
              ([label, p], i) => (
                <div key={label} style={{ background: cellBg, border: `1px solid ${border}`, borderRadius: 10, padding: '10px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px', color: i === 1 ? '#0052ff' : txt2, marginBottom: 5 }}>{label}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: txt1, letterSpacing: '-0.3px', lineHeight: 1.1 }}>{money(p.dailyReward)}<span style={{ fontSize: 10, fontWeight: 600, color: txt2 }}>/day</span></div>
                  <div style={{ fontSize: 11, color: txt2, marginTop: 3 }}>~{pct(p.apr)} APR</div>
                  {days != null && days > 0 && (
                    <div style={{ fontSize: 10, color: txt2, marginTop: 4 }}>{money(p.totalReward)} over {days}d</div>
                  )}
                </div>
              )
            )}
          </div>
          <p style={{ fontSize: 10.5, lineHeight: 1.5, color: txt2, margin: '0 0 14px' }}>
            Polymarket doesn&apos;t publish total in-band LP liquidity, so your exact share is unknowable.
            The range models competing capital from how contested the pool is — the more LPs compete, the
            thinner your cut. Rewards require actively posting and maintaining orders near the midpoint.
          </p>
        </>
      ) : (
        <p style={{ fontSize: 12, lineHeight: 1.5, color: txt2, margin: '0 0 14px' }}>
          {est.reason === 'pool not published'
            ? 'This platform doesn\u2019t publish a per-market reward pool, so a dollar estimate isn\u2019t possible. The risk profile below still applies.'
            : 'Enter a stake above to estimate your rewards.'}
        </p>
      )}

      {/* Risk panel */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center' }}>
        <RiskChip label="Inventory risk" level={est.risk.inventory.level} />
        <RiskChip label="Spread" level={est.risk.spread.level} extra={est.risk.spread.cents != null ? `(${est.risk.spread.cents}¢)` : undefined} />
        <RiskChip label="Horizon" level={est.risk.horizon.level} extra={est.risk.horizon.days != null ? `(${est.risk.horizon.days}d)` : undefined} />
        {est.risk.competition.value != null && <RiskChip label="Competition" level={est.risk.competition.level} />}
      </div>
      {!compact && (
        <p style={{ fontSize: 10, lineHeight: 1.5, color: txt2, margin: '10px 0 0' }}>
          {est.risk.inventory.note}. Not financial advice. LP access is region-limited — verify eligibility and the live order book on the platform.
        </p>
      )}
    </div>
  )
}
