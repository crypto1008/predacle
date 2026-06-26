'use client'

import { useState, useEffect } from 'react'

/* ---------- shape returned by /api/calibration ---------- */
interface Bucket { lo: number; hi: number; n: number; predicted: number | null; actual: number | null }
interface CatScore {
  category: string
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
  categories: CatScore[]
  overall: CatScore | null
  totalCalibratable: number
  minSample: number
  method: string
  generatedAt: string
}

const CAT_LABELS: Record<string, string> = {
  crypto: 'Crypto',
  sports: 'Sports',
  politics: 'Politics',
  economics: 'Economics',
  tech: 'Tech',
}
const PALETTE = ['#0052ff', '#0d9488', '#d97706', '#cf202f', '#7c3aed', '#0891b2']

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
const labelOf = (c: string) => CAT_LABELS[c] || c.charAt(0).toUpperCase() + c.slice(1)

/* ---------- single calibration chart (one category) ---------- */
function CalibrationChart({ cat, color, dark }: { cat: CatScore; color: string; dark: boolean }) {
  const W = 460, H = 380
  const padL = 50, padR = 16, padT = 16, padB = 46
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const X = (p: number) => padL + p * plotW
  const Y = (a: number) => padT + (1 - a) * plotH
  const grid = dark ? '#26282d' : '#f5f6f8'
  const axisClr = dark ? '#5b616e' : '#8a919e'
  const labelClr = dark ? '#8a919e' : '#5b616e'
  const dotStroke = dark ? '#0a0b0d' : '#ffffff'

  const pts = cat.curve.filter((b) => b.n > 0 && b.predicted != null && b.actual != null)
  const maxN = Math.max(1, ...cat.curve.map((b) => b.n))
  const rOf = (n: number) => 2.5 + 5.5 * Math.sqrt(n / maxN)
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const path = pts
    .map((b, j) => `${j === 0 ? 'M' : 'L'} ${X(b.predicted as number).toFixed(1)} ${Y(b.actual as number).toFixed(1)}`)
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', maxWidth: W }}
      role="img"
      aria-label={`Calibration chart for ${labelOf(cat.category)}: predicted probability versus actual frequency`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={X(t)} y1={padT} x2={X(t)} y2={padT + plotH} stroke={grid} strokeWidth={1} />
          <line x1={padL} y1={Y(t)} x2={padL + plotW} y2={Y(t)} stroke={grid} strokeWidth={1} />
          <text x={X(t)} y={padT + plotH + 17} textAnchor="middle" fontSize={10} fill={axisClr}>{Math.round(t * 100)}%</text>
          <text x={padL - 8} y={Y(t) + 3} textAnchor="end" fontSize={10} fill={axisClr}>{Math.round(t * 100)}%</text>
        </g>
      ))}

      {/* perfect-calibration diagonal */}
      <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke={axisClr} strokeWidth={1.5} strokeDasharray="4 4" />

      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.85} strokeLinejoin="round" />
      {pts.map((b, j) => (
        <circle key={j} cx={X(b.predicted as number)} cy={Y(b.actual as number)} r={rOf(b.n)} fill={color} fillOpacity={0.78} stroke={dotStroke} strokeWidth={1}>
          <title>{`Priced ${((b.predicted as number) * 100).toFixed(1)}%, resolved ${((b.actual as number) * 100).toFixed(1)}% YES (n=${b.n})`}</title>
        </circle>
      ))}

      <text x={padL + plotW / 2} y={H - 7} textAnchor="middle" fontSize={11} fontWeight={600} fill={labelClr}>Priced probability</text>
      <text x={14} y={padT + plotH / 2} textAnchor="middle" fontSize={11} fontWeight={600} fill={labelClr} transform={`rotate(-90 14 ${padT + plotH / 2})`}>Actually happened</text>
    </svg>
  )
}

/* =================================================================== */

export default function TrackRecordClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const dark = useDark()

  useEffect(() => {
    setLoading(true)
    fetch('/api/calibration')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error)
        else setData(d)
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const bg = dark ? '#0a0b0d' : '#ffffff'
  const headClr = dark ? '#f5f6f8' : '#0a0b0d'
  const subClr = dark ? '#8a919e' : '#5b616e'
  const metaClr = dark ? '#5b616e' : '#8a919e'
  const panelBg = dark ? '#16171a' : '#ffffff'
  const panelBorder = dark ? '#26282d' : '#eaecef'
  const softBg = dark ? '#0d0e10' : '#fafbfc'

  const cats = data?.categories || []
  const overall = data?.overall || null

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 20px 64px' }}>
        {/* Breadcrumb */}
        <nav style={{ fontSize: 13, color: subClr, marginBottom: 16 }} aria-label="Breadcrumb">
          <a href="/" style={{ color: subClr, textDecoration: 'none' }}>Home</a>
          <span style={{ margin: '0 8px', color: metaClr }}>&rsaquo;</span>
          <span style={{ color: headClr }}>Track Record</span>
        </nav>

        <h1 style={{ fontSize: 34, fontWeight: 800, color: headClr, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
          Do Prediction Markets Actually Get It Right?
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: subClr, maxWidth: 760, margin: '0 0 8px' }}>
          Everyone quotes prediction-market odds; far fewer check them afterward. This page does. For every
          resolved market we take the price right before it settled and compare it to what actually happened.
          If markets are well-calibrated, the things they price at 70% should happen about 70% of the time.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: metaClr, maxWidth: 760, margin: '0 0 28px' }}>
          Only binary (Yes/No) outcomes are scored. Non-binary settlements are excluded, and a category is
          shown only once it has enough resolved history to be meaningful.
        </p>

        {loading && <p style={{ color: subClr }}>Crunching resolved markets&hellip;</p>}
        {err && <p style={{ color: '#cf202f' }}>Couldn&apos;t load calibration data: {err}</p>}

        {!loading && !err && data && (
          <>
            {/* Headline aggregate */}
            {overall && (
              <div style={{ background: softBg, border: `1px solid ${panelBorder}`, borderRadius: 14, padding: '20px 22px', marginBottom: 28 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: metaClr, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 12px' }}>
                  Across {overall.n.toLocaleString()} resolved markets
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 40px' }}>
                  <Stat label="Directional accuracy" value={pct(overall.accuracy)} hint="how often the favoured side won" sub={subClr} head={headClr} meta={metaClr} />
                  <Stat label="Calibration error" value={pct(overall.calibrationError)} hint="avg gap between price and reality" sub={subClr} head={headClr} meta={metaClr} />
                  <Stat label="Brier score" value={overall.brier.toFixed(3)} hint="lower = sharper forecasts" sub={subClr} head={headClr} meta={metaClr} />
                </div>
              </div>
            )}

            {/* Per-category cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 32 }}>
              {cats.map((c, i) => {
                const color = PALETTE[i % PALETTE.length]
                return (
                  <div key={c.category} style={{ background: panelBg, border: `1px solid ${panelBorder}`, borderRadius: 14, padding: '18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
                      <h2 style={{ fontSize: 17, fontWeight: 700, color: headClr, margin: 0 }}>{labelOf(c.category)}</h2>
                    </div>
                    <p style={{ fontSize: 13, color: metaClr, margin: '0 0 12px' }}>{c.n.toLocaleString()} resolved markets</p>
                    <CalibrationChart cat={c} color={color} dark={dark} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', marginTop: 12 }}>
                      <MiniStat label="Accuracy" value={pct(c.accuracy)} sub={subClr} meta={metaClr} />
                      <MiniStat label="Calib. error" value={pct(c.calibrationError)} sub={subClr} meta={metaClr} />
                      <MiniStat label="Brier" value={c.brier.toFixed(3)} sub={subClr} meta={metaClr} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* How the curve reads */}
            <div style={{ background: softBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: '18px 20px', marginBottom: 22 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: headClr, margin: '0 0 6px' }}>How to read these charts</h2>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: subClr, margin: 0 }}>
                Each dot groups markets by the probability they were priced at (x-axis) and plots how often
                those markets actually resolved Yes (y-axis). Bigger dots hold more markets. A perfectly
                calibrated category sits right on the dashed diagonal: a dot above the line means the market
                under-priced those events, below means it over-priced them.
              </p>
            </div>

            {/* Methodology */}
            <div style={{ background: softBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: '18px 20px' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: headClr, margin: '0 0 8px' }}>Method &amp; caveats</h2>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: metaClr }}>
                <li><strong style={{ color: subClr }}>Calibration error</strong> is the average distance between the price and the real frequency across the buckets in each chart.</li>
                <li><strong style={{ color: subClr }}>Brier score</strong> is the mean squared error between price and outcome &mdash; lower is sharper.</li>
                <li>Only Yes/No markets with a recorded final price are scored; non-binary settlements are excluded.</li>
                <li>Crypto is not shown yet: on these platforms resolved crypto markets are almost entirely automated short-term price targets (&ldquo;Will Bitcoin reach $X on June 12?&rdquo;) that settle at near-0% or near-100%. Too few genuine forecasting markets have resolved to score it fairly; it will appear once enough do.</li>
                <li>History here is recent, so these reflect the current mix of markets rather than a long-run average. Categories with too few resolutions are not shown.</li>
              </ul>
              {data.generatedAt && (
                <p style={{ fontSize: 12, color: metaClr, margin: '14px 0 0' }}>
                  Updated {new Date(data.generatedAt).toLocaleString()}
                </p>
              )}
            </div>

            {/* Go deeper: outbound interlinks to live hubs + resolved + odds */}
            <div style={{ background: softBg, border: `1px solid ${panelBorder}`, borderRadius: 12, padding: '18px 20px' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: headClr, margin: '0 0 8px' }}>Go deeper</h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: subClr, margin: 0 }}>
                Browse live{' '}
                <a href="/category/politics" style={{ color: '#0052ff', textDecoration: 'none' }}>politics</a>{' '}and{' '}
                <a href="/category/sports" style={{ color: '#0052ff', textDecoration: 'none' }}>sports</a>{' '}markets,
                see every{' '}
                <a href="/resolved" style={{ color: '#0052ff', textDecoration: 'none' }}>resolved market</a>{' '}in the archive,
                or check the live{' '}
                <a href="/odds/2028-us-presidential-election" style={{ color: '#0052ff', textDecoration: 'none' }}>2028 election odds</a>.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Stat({ label, value, hint, sub, head, meta }: { label: string; value: string; hint: string; sub: string; head: string; meta: string }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 800, color: head, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: sub, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: meta, marginTop: 1 }}>{hint}</div>
    </div>
  )
}

function MiniStat({ label, value, sub, meta }: { label: string; value: string; sub: string; meta: string }) {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: sub }}>{value}</div>
      <div style={{ fontSize: 11, color: meta }}>{label}</div>
    </div>
  )
}
