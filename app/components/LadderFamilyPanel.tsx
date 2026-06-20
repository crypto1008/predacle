'use client'

import { useState, useEffect } from 'react'

interface Rung {
  id: string; platform: string; question: string
  probability: number; url: string
  ladder_threshold: number; volume_label: string | null
}
interface FamilyResponse { ok: boolean; family: string | null; count: number; platform: string | null; rungs: Rung[] }

const PLATFORM_LABELS: Record<string, string> = { kalshi: 'Kalshi', polymarket: 'Polymarket', limitless: 'Limitless' }

const fmtFull = (n: number) => `$${Math.round(n).toLocaleString()}`
const fmtK = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`)

// Price at which the survival CDF P(>=X) equals `target`. CDF is decreasing in X.
function priceAtCdf(ths: number[], cdf: number[], target: number): number | null {
  for (let i = 0; i < cdf.length - 1; i++) {
    const a = cdf[i], b = cdf[i + 1]
    if (a >= target && b < target) {
      const f = (a - target) / (a - b || 1)
      return ths[i] + f * (ths[i + 1] - ths[i])
    }
  }
  if (cdf[0] < target) return ths[0]
  if (cdf[cdf.length - 1] >= target) return ths[ths.length - 1]
  return null
}

export default function LadderFamilyPanel({ marketId, dark }: { marketId: string; dark: boolean }) {
  const [data, setData] = useState<FamilyResponse | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [mode, setMode] = useState<'dist' | 'cdf'>('dist')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/markets/ladder?id=${encodeURIComponent(marketId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: FamilyResponse | null) => { if (alive) { setData(d); setLoaded(true) } })
      .catch(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [marketId])

  // Need a real ladder with enough rungs to be worth a chart.
  if (!loaded || !data || !data.family || data.rungs.length < 5) return null

  const cardBg  = dark ? '#16171a' : '#ffffff'
  const border  = dark ? '#26282d' : '#eaecef'
  const divider = dark ? '#26282d' : '#f5f6f8'
  const txt1    = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2    = dark ? '#5b616e' : '#8a919e'
  const statClr = dark ? '#dfe1e6' : '#5b616e'
  const grid    = dark ? '#26282d' : '#f5f6f8'
  const barDim  = dark ? '#1d3563' : '#c9dcff'
  const purple  = '#0052ff'

  const rungs = data.rungs
  const ths = rungs.map((r) => r.ladder_threshold)
  const cdf = rungs.map((r) => r.probability)
  const minTh = ths[0], maxTh = ths[ths.length - 1]
  const span = maxTh - minTh || 1

  // Probability mass per threshold gap (raw, uneven spacing).
  const gaps = rungs.slice(0, -1).map((_, i) => ({ lo: ths[i], hi: ths[i + 1], mass: Math.max(0, cdf[i] - cdf[i + 1]) }))

  // Rebin into uniform-width price bins, splitting each gap's mass proportionally
  // across the bins it overlaps — so uneven Kalshi strikes render as a clean histogram.
  const N_BINS = Math.min(30, Math.max(12, gaps.length))
  const binW = span / N_BINS
  const bins = Array.from({ length: N_BINS }, (_, i) => ({ lo: minTh + i * binW, hi: minTh + (i + 1) * binW, mass: 0 }))
  for (const g of gaps) {
    if (g.mass <= 0 || g.hi <= g.lo) continue
    for (const bin of bins) {
      const overlap = Math.max(0, Math.min(g.hi, bin.hi) - Math.max(g.lo, bin.lo))
      if (overlap > 0) bin.mass += g.mass * (overlap / (g.hi - g.lo))
    }
  }
  const maxMass = Math.max(...bins.map((b) => b.mass), 0.0001)
  const modalIdx = bins.reduce((best, b, i, arr) => (b.mass > arr[best].mass ? i : best), 0)

  const median = priceAtCdf(ths, cdf, 0.5)
  const p25 = priceAtCdf(ths, cdf, 0.75) // 25th pctile of price
  const p75 = priceAtCdf(ths, cdf, 0.25) // 75th pctile of price

  const platformLabel = PLATFORM_LABELS[data.platform || ''] || data.platform || ''
  const baseLabel = (data.family || '').replace(/\b\w/g, (c) => c.toUpperCase())
  const current = rungs.find((r) => r.id === marketId)
  const curBinIdx = current ? Math.min(N_BINS - 1, Math.max(0, Math.floor((current.ladder_threshold - minTh) / binW))) : -1

  // ---- chart geometry ----
  const W = 720, H = 240, padL = 42, padR = 10, padT = 16, padB = 30
  const plotW = W - padL - padR, plotH = H - padT - padB
  const baseY = padT + plotH
  const x = (th: number) => padL + ((th - minTh) / span) * plotW
  const yCdf = (p: number) => padT + (1 - p) * plotH
  const xMed = median != null ? x(median) : null

  const cdfPts = rungs.map((r, i) => `${x(ths[i]).toFixed(1)},${yCdf(cdf[i]).toFixed(1)}`).join(' ')
  const cdfArea = `M ${padL},${baseY} L ${cdfPts.split(' ').join(' L ')} L ${x(maxTh).toFixed(1)},${baseY} Z`

  const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick}
      style={{ fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
        border: `1px solid ${active ? purple : border}`, background: active ? (dark ? '#0f1d3d' : '#eaf0ff') : cardBg, color: active ? purple : txt2 }}>
      {children}
    </button>
  )

  const medLabelX = xMed != null ? Math.min(Math.max(xMed, padL + 34), W - padR - 34) : 0

  return (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: txt1 }}>📊 Implied Price Distribution</h2>
          <p style={{ fontSize: 12, color: txt2, marginTop: 2 }}>
            What {platformLabel ? `${platformLabel}'s` : 'the'} {rungs.length} thresholds imply about where it lands
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Pill active={mode === 'dist'} onClick={() => setMode('dist')}>Distribution</Pill>
          <Pill active={mode === 'cdf'} onClick={() => setMode('cdf')}>Cumulative</Pill>
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: '16px 16px 4px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} preserveAspectRatio="xMidYMid meet">
          {/* gridlines */}
          {mode === 'cdf'
            ? [0, 0.25, 0.5, 0.75, 1].map((p) => (
                <g key={p}>
                  <line x1={padL} y1={yCdf(p)} x2={W - padR} y2={yCdf(p)} stroke={grid} strokeWidth={1} />
                  <text x={padL - 6} y={yCdf(p) + 3} textAnchor="end" fontSize={9} fill={txt2}>{Math.round(p * 100)}%</text>
                </g>
              ))
            : <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke={grid} strokeWidth={1} />}

          {/* data */}
          {mode === 'dist'
            ? bins.map((b, i) => {
                const x0 = x(b.lo), x1 = x(b.hi)
                const w = Math.max(1, x1 - x0 - 1.5)
                const h = (b.mass / maxMass) * plotH
                const isModal = i === modalIdx
                const isCurrent = i === curBinIdx
                return (
                  <rect key={i} x={x0} y={baseY - h} width={w} height={Math.max(0, h)}
                    fill={isModal ? purple : barDim}
                    stroke={isCurrent ? '#d97706' : 'none'} strokeWidth={isCurrent ? 2 : 0} rx={1.5}>
                    <title>{`${fmtFull(b.lo)}–${fmtFull(b.hi)}: ${(b.mass * 100).toFixed(1)}% chance`}</title>
                  </rect>
                )
              })
            : (<>
                <path d={cdfArea} fill={dark ? 'rgba(0,82,255,0.16)' : 'rgba(0,82,255,0.10)'} stroke="none" />
                <polyline points={cdfPts} fill="none" stroke={purple} strokeWidth={2} strokeLinejoin="round" />
              </>)}

          {/* median marker */}
          {xMed != null && (
            <g>
              <line x1={xMed} y1={padT} x2={xMed} y2={baseY} stroke="#cf202f" strokeWidth={1.25} strokeDasharray="4 3" />
              <rect x={medLabelX - 33} y={padT - 13} width={66} height={13} rx={3} fill={cardBg} opacity={0.9} />
              <text x={medLabelX} y={padT - 3} textAnchor="middle" fontSize={9} fontWeight={700} fill="#cf202f">
                median {median != null ? fmtK(median) : ''}
              </text>
            </g>
          )}

          {/* x-axis labels */}
          {[minTh, median ?? (minTh + maxTh) / 2, maxTh].map((t, i) => (
            <text key={i} x={Math.min(Math.max(x(t), padL + 14), W - padR - 14)} y={H - 10}
              textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontSize={10} fill={txt2}>
              {fmtK(t)}
            </text>
          ))}
        </svg>
      </div>

      {/* Stats */}
      <div style={{ padding: '8px 24px 4px', display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
        <Stat label="Implied median" value={median != null ? fmtFull(median) : '—'} txt2={txt2} statClr={txt1} />
        <Stat label="50% chance between" value={p25 != null && p75 != null ? `${fmtK(p25)} – ${fmtK(p75)}` : '—'} txt2={txt2} statClr={txt1} />
        {current && (
          <Stat label="This market" value={`${Math.round(current.probability * 100)}% ≥ ${fmtK(current.ladder_threshold)}`} txt2={txt2} statClr="#d97706" />
        )}
      </div>

      {/* Full rung list */}
      <div style={{ padding: '8px 24px 18px' }}>
        <button onClick={() => setShowAll((v) => !v)}
          style={{ fontSize: 12, fontWeight: 600, color: purple, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          {showAll ? 'Hide thresholds' : `Show all ${rungs.length} thresholds →`}
        </button>
        {showAll && (
          <div style={{ marginTop: 12, border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
            {rungs.map((r, i) => {
              const pct = Math.round(r.probability * 100)
              const isCur = current && r.id === current.id
              return (
                <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', textDecoration: 'none',
                    background: isCur ? (dark ? '#1c1002' : '#fffbeb') : 'transparent',
                    borderBottom: i < rungs.length - 1 ? `1px solid ${divider}` : 'none' }}>
                  <span style={{ fontSize: 12.5, color: isCur ? '#d97706' : txt1, fontWeight: isCur ? 700 : 500 }}>
                    ≥ {fmtFull(r.ladder_threshold)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 80, height: 5, background: grid, borderRadius: 3, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: 5, width: `${pct}%`, background: purple }} />
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: statClr, width: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                  </span>
                </a>
              )
            })}
          </div>
        )}
        <p style={{ fontSize: 11, color: txt2, lineHeight: 1.5, marginTop: 12 }}>
          Derived from {platformLabel || 'platform'} “{baseLabel}” threshold markets. The distribution is implied by current prices and shifts as they move. Not financial advice.
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value, txt2, statClr }: { label: string; value: string; txt2: string; statClr: string }) {
  return (
    <div>
      <p style={{ fontSize: 10.5, color: txt2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: statClr, letterSpacing: '-0.3px' }}>{value}</p>
    </div>
  )
}
