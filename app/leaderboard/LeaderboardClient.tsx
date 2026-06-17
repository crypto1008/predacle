'use client'

import { useState, useEffect } from 'react'

/* ---------- shape returned by /api/leaderboard ---------- */
interface Bucket { lo: number; hi: number; n: number; predicted: number | null; actual: number | null }
interface Platform {
  platform: string
  n: number
  brier: number
  logloss: number
  accuracy: number
  calibrationError: number
  avgPred: number
  yesRate: number
  curve: Bucket[]
}
interface ApiResponse {
  platforms: Platform[]
  totalResolved: number
  minSample: number
  method: string
  generatedAt: string
}

const PLATFORM_LABELS: Record<string, string> = { polymarket: 'Polymarket', kalshi: 'Kalshi' }
const PALETTE = ['#5f5cf0', '#0d9488', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

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

const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`

/* =================================================================== */

export default function LeaderboardClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const dark = useDark()

  useEffect(() => {
    setLoading(true); setErr(null)
    fetch('/api/leaderboard')
      .then((r) => { if (!r.ok) throw new Error(`Request failed (${r.status})`); return r.json() })
      .then((d: ApiResponse) => setData(d))
      .catch((e) => setErr(e?.message || 'Failed to load leaderboard'))
      .finally(() => setLoading(false))
  }, [])

  const headClr = dark ? '#f1f5f9' : '#0f172a'
  const subClr = dark ? '#94a3b8' : '#64748b'
  const metaClr = dark ? '#64748b' : '#94a3b8'
  const panelBg = dark ? '#111318' : '#ffffff'
  const panelBorder = dark ? '#1e2330' : '#e8ecf0'
  const statClr = dark ? '#cbd5e1' : '#475569'

  const platforms = data?.platforms ?? []
  const updated = data?.generatedAt ? new Date(data.generatedAt) : null

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px 64px' }}>
      <style>{`@keyframes predacle-pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>

      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px', color: headClr, margin: '0 0 8px' }}>
          Accuracy Leaderboard
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: subClr, maxWidth: 760, margin: 0 }}>
          Everyone trades on prediction markets; almost nobody checks whether the prices are actually{' '}
          <em>right</em>. We do. For every market that has resolved, Predacle compares its last
          pre-resolution price against what really happened, then scores each platform on two things:{' '}
          <strong style={{ color: subClr }}>sharpness</strong> (the Brier score — how confidently and
          correctly it priced outcomes) and <strong style={{ color: subClr }}>calibration</strong> (when
          a platform says &ldquo;60%&rdquo;, does that happen about 60% of the time?). Lower Brier is
          better. Only platforms with at least {data?.minSample ?? 100} resolved binary markets appear;
          coverage grows as more resolution sources come online. Not financial advice.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, height: 180, animation: 'predacle-pulse 1.3s ease-in-out infinite' }} />
          <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, height: 460, animation: 'predacle-pulse 1.3s ease-in-out infinite', animationDelay: '0.1s' }} />
        </div>
      ) : err ? (
        <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#ef4444', margin: 0 }}>{err}</p>
        </div>
      ) : platforms.length === 0 ? (
        <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🎯</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: headClr, margin: '0 0 6px' }}>Not enough resolved markets yet</p>
          <p style={{ fontSize: 13, color: subClr, margin: 0 }}>The leaderboard appears once a platform has enough settled markets to score.</p>
        </div>
      ) : (
        <>
          {/* ---------- ranked table ---------- */}
          <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, overflow: 'hidden', marginBottom: 22 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
                <thead>
                  <tr style={{ background: dark ? '#0d1117' : '#fafbfc', borderBottom: `1px solid ${panelBorder}` }}>
                    {[
                      ['#', 'Rank by Brier score', 'left', 48],
                      ['Platform', '', 'left', 0],
                      ['Resolved', 'Number of settled binary markets scored', 'right', 0],
                      ['Brier ↓', 'Mean squared error between price and outcome. 0 = perfect, lower = sharper.', 'right', 0],
                      ['Calibration', "How far the platform's stated probabilities sit from real frequencies (expected calibration error). Lower = better calibrated.", 'right', 0],
                      ['Accuracy', 'Directional hit-rate (did the >50% side win). Inflated by obvious markets — context only.', 'right', 0],
                    ].map(([label, tip, align, w]) => (
                      <th key={label as string} title={tip as string}
                        style={{ textAlign: align as any, padding: '11px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: metaClr, width: (w as number) || undefined, whiteSpace: 'nowrap' }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((p, i) => {
                    const col = PALETTE[i % PALETTE.length]
                    const top = i === 0
                    return (
                      <tr key={p.platform} style={{ borderBottom: i < platforms.length - 1 ? `1px solid ${panelBorder}` : 'none', background: top ? (dark ? 'rgba(95,92,240,0.06)' : 'rgba(95,92,240,0.04)') : 'transparent' }}>
                        <td style={{ padding: '13px 14px', textAlign: 'left', fontWeight: 700, color: top ? '#5f5cf0' : metaClr }}>
                          {top ? '🏆' : i + 1}
                        </td>
                        <td style={{ padding: '13px 14px', textAlign: 'left' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: col, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, color: headClr }}>{PLATFORM_LABELS[p.platform] || p.platform}</span>
                          </span>
                          <span style={{ display: 'block', fontSize: 11, color: metaClr, marginTop: 2, marginLeft: 17 }}>
                            says {pct(p.avgPred, 0)} → happens {pct(p.yesRate, 0)}
                          </span>
                        </td>
                        <td style={{ padding: '13px 14px', textAlign: 'right', color: statClr, fontVariantNumeric: 'tabular-nums' }}>{p.n.toLocaleString()}</td>
                        <td style={{ padding: '13px 14px', textAlign: 'right', fontWeight: 800, color: top ? '#5f5cf0' : headClr, fontVariantNumeric: 'tabular-nums' }}>{p.brier.toFixed(4)}</td>
                        <td style={{ padding: '13px 14px', textAlign: 'right', color: statClr, fontVariantNumeric: 'tabular-nums' }}>±{pct(p.calibrationError)}</td>
                        <td style={{ padding: '13px 14px', textAlign: 'right', color: metaClr, fontVariantNumeric: 'tabular-nums' }}>{pct(p.accuracy)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------- calibration chart ---------- */}
          <div style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: '20px 20px 16px', marginBottom: 22 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: headClr, margin: '0 0 4px' }}>Calibration curve</h2>
            <p style={{ fontSize: 13, color: subClr, margin: '0 0 14px', maxWidth: 720, lineHeight: 1.55 }}>
              Each point groups markets by their predicted probability and plots it against how often
              those markets actually resolved YES. A perfectly calibrated platform sits on the dashed
              diagonal. Points below the line mean overpricing; above means underpricing. Larger dots
              hold more markets.
            </p>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <CalibrationChart platforms={platforms} dark={dark} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
                {platforms.map((p, i) => (
                  <div key={p.platform} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 3, borderRadius: 2, background: PALETTE[i % PALETTE.length], display: 'inline-block' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: headClr }}>{PLATFORM_LABELS[p.platform] || p.platform}</span>
                    <span style={{ fontSize: 12, color: metaClr }}>Brier {p.brier.toFixed(4)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ width: 14, height: 0, borderTop: `2px dashed ${metaClr}`, display: 'inline-block' }} />
                  <span style={{ fontSize: 12, color: metaClr }}>perfect calibration</span>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- methodology ---------- */}
          <div style={{ background: dark ? '#0d1117' : '#fafbfc', border: `1px solid ${panelBorder}`, borderRadius: 12, padding: '18px 20px' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: headClr, margin: '0 0 8px' }}>How this is measured</h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: subClr }}>
              <li>We use each market&apos;s <strong style={{ color: subClr }}>last price before resolution</strong> as the forecast, and its real settlement as the truth.</li>
              <li><strong style={{ color: subClr }}>Brier score</strong> is the average squared gap between price and outcome — it rewards being both confident and correct, and is the headline rank.</li>
              <li><strong style={{ color: subClr }}>Calibration error</strong> measures the average distance between stated probabilities and actual frequencies across the buckets in the chart.</li>
              <li>Only binary (YES/NO) markets count; scalar and ambiguous resolutions are excluded. A platform needs at least {data?.minSample ?? 100} resolved markets to be ranked.</li>
              <li>Cross-platform Brier isn&apos;t perfectly apples-to-apples — platforms list different mixes of markets, and the pre-resolution lead time varies — so read the calibration curve alongside the score rather than the number alone.</li>
            </ul>
          </div>

          {updated && (
            <p style={{ fontSize: 11, color: metaClr, textAlign: 'center', marginTop: 24 }}>
              {data?.totalResolved.toLocaleString()} resolved markets · updated {updated.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </>
      )}
    </main>
  )
}

/* =================================================================== */

function CalibrationChart({ platforms, dark }: { platforms: Platform[]; dark: boolean }) {
  const W = 560, H = 440
  const padL = 56, padR = 18, padT = 18, padB = 50
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const X = (p: number) => padL + p * plotW
  const Y = (a: number) => padT + (1 - a) * plotH
  const grid = dark ? '#1e2330' : '#eef1f5'
  const axisClr = dark ? '#64748b' : '#94a3b8'
  const labelClr = dark ? '#94a3b8' : '#64748b'
  const dotStroke = dark ? '#0b0d12' : '#ffffff'

  const maxN = Math.max(1, ...platforms.flatMap((p) => p.curve.map((b) => b.n)))
  const rOf = (n: number) => 2.5 + 5.5 * Math.sqrt(n / maxN)
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxWidth: W, flex: '1 1 360px' }} role="img" aria-label="Calibration chart: predicted probability versus actual frequency">
      {/* grid + tick labels */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={X(t)} y1={padT} x2={X(t)} y2={padT + plotH} stroke={grid} strokeWidth={1} />
          <line x1={padL} y1={Y(t)} x2={padL + plotW} y2={Y(t)} stroke={grid} strokeWidth={1} />
          <text x={X(t)} y={padT + plotH + 18} textAnchor="middle" fontSize={10} fill={axisClr}>{Math.round(t * 100)}%</text>
          <text x={padL - 9} y={Y(t) + 3} textAnchor="end" fontSize={10} fill={axisClr}>{Math.round(t * 100)}%</text>
        </g>
      ))}

      {/* perfect-calibration diagonal */}
      <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke={axisClr} strokeWidth={1.5} strokeDasharray="4 4" />

      {/* platform curves */}
      {platforms.map((pl, i) => {
        const col = PALETTE[i % PALETTE.length]
        const pts = pl.curve.filter((b) => b.n > 0 && b.predicted != null && b.actual != null)
        const path = pts.map((b, j) => `${j === 0 ? 'M' : 'L'} ${X(b.predicted as number).toFixed(1)} ${Y(b.actual as number).toFixed(1)}`).join(' ')
        return (
          <g key={pl.platform}>
            <path d={path} fill="none" stroke={col} strokeWidth={2} strokeOpacity={0.85} strokeLinejoin="round" />
            {pts.map((b, j) => (
              <circle key={j} cx={X(b.predicted as number)} cy={Y(b.actual as number)} r={rOf(b.n)} fill={col} fillOpacity={0.78} stroke={dotStroke} strokeWidth={1}>
                <title>{`${PLATFORM_LABELS[pl.platform] || pl.platform}: priced ${((b.predicted as number) * 100).toFixed(1)}%, resolved ${((b.actual as number) * 100).toFixed(1)}% YES (n=${b.n})`}</title>
              </circle>
            ))}
          </g>
        )
      })}

      {/* axis titles */}
      <text x={padL + plotW / 2} y={H - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill={labelClr}>Predicted probability</text>
      <text x={15} y={padT + plotH / 2} textAnchor="middle" fontSize={11} fontWeight={600} fill={labelClr} transform={`rotate(-90 15 ${padT + plotH / 2})`}>Actual frequency (YES)</text>
    </svg>
  )
}
