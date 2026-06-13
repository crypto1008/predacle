'use client'
import { useEffect, useState, type CSSProperties } from 'react'

type Point = { t: string; p: number }

export default function ProbabilityChart({ marketId, dark = false }: { marketId: string; dark?: boolean }) {
  const [points, setPoints] = useState<Point[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPoints(null)
    setFailed(false)
    fetch(`/api/snapshots?id=${encodeURIComponent(marketId)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setPoints(Array.isArray(d.points) ? d.points : []) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [marketId])

  const purple = '#5f5cf0'
  const sub = dark ? '#9ca3af' : '#6b7280'
  const grid = dark ? '#2a2a37' : '#eef0f4'
  const border = dark ? '#262633' : '#ececf1'
  const bg = dark ? '#15151d' : '#ffffff'
  const label = dark ? '#e5e7eb' : '#1f2937'

  const wrap: CSSProperties = { border: `1px solid ${border}`, borderRadius: 12, background: bg, padding: 16, marginTop: 16 }
  const title: CSSProperties = { fontSize: 13, fontWeight: 600, color: label }
  const note: CSSProperties = { fontSize: 12, color: sub, marginTop: 4 }

  if (failed) return null
  if (points === null) {
    return <div style={wrap}><div style={title}>Probability history</div><div style={note}>Loading…</div></div>
  }
  if (points.length < 2) {
    return (
      <div style={wrap}>
        <div style={title}>Probability history</div>
        <div style={note}>Not enough history yet — this chart fills in as the market trades.</div>
      </div>
    )
  }

  const W = 640, H = 200, padL = 38, padR = 14, padT = 14, padB = 26
  const xs = points.map(p => new Date(p.t).getTime())
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const spanX = (maxX - minX) || 1
  const X = (t: number) => padL + ((t - minX) / spanX) * (W - padL - padR)

  // Auto-scale the y-axis to this market's own range, with a minimum window
  // (~15 points) so genuinely-flat markets stay flat and small noise isn't
  // exaggerated. Clamped to [0,1]; axis is labeled with real percentages.
  const ys = points.map(p => Math.max(0, Math.min(1, p.p)))
  const lo = Math.min(...ys), hi = Math.max(...ys)
  const mid = (lo + hi) / 2
  const half = Math.max(((hi - lo) / 2) * 1.25, 0.075)
  let yMin = mid - half, yMax = mid + half
  if (yMin < 0) { yMax = Math.min(1, yMax - yMin); yMin = 0 }
  if (yMax > 1) { yMin = Math.max(0, yMin - (yMax - 1)); yMax = 1 }
  const ySpan = (yMax - yMin) || 1
  const Y = (p: number) => padT + (1 - (Math.max(0, Math.min(1, p)) - yMin) / ySpan) * (H - padT - padB)
  const floorY = H - padB

  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${X(xs[i]).toFixed(1)} ${Y(p.p).toFixed(1)}`).join(' ')
  const area = `${line} L ${X(maxX).toFixed(1)} ${floorY.toFixed(1)} L ${X(minX).toFixed(1)} ${floorY.toFixed(1)} Z`
  const showDots = points.length <= 40

  const gridVals = [yMax, (yMin + yMax) / 2, yMin]

  const fmt = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const cur = points[points.length - 1].p
  const delta = cur - points[0].p
  const deltaColor = delta > 0.001 ? '#059669' : delta < -0.001 ? '#dc2626' : sub
  const deltaTxt = `${delta >= 0 ? '+' : ''}${Math.round(delta * 100)} pts`

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={title}>Probability history</div>
        <div style={{ fontSize: 12, color: sub }}>
          <span style={{ color: label, fontWeight: 600 }}>{Math.round(cur * 100)}%</span>{' '}
          <span style={{ color: deltaColor }}>{deltaTxt}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 8 }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="pc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={purple} stopOpacity={dark ? 0.28 : 0.16} />
            <stop offset="100%" stopColor={purple} stopOpacity={0} />
          </linearGradient>
        </defs>
        {gridVals.map((r, i) => (
          <g key={i}>
            <line x1={padL} y1={Y(r)} x2={W - padR} y2={Y(r)} stroke={grid} strokeWidth={1} />
            <text x={padL - 6} y={Y(r) + 3} textAnchor="end" fontSize={10} fill={sub}>{Math.round(r * 100)}%</text>
          </g>
        ))}
        <path d={area} fill="url(#pc-fill)" />
        <path d={line} fill="none" stroke={purple} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {showDots && points.map((p, i) => (
          <circle key={i} cx={X(xs[i])} cy={Y(p.p)} r={2.5} fill={purple} />
        ))}
        <text x={padL} y={H - 8} textAnchor="start" fontSize={10} fill={sub}>{fmt(minX)}</text>
        <text x={W - padR} y={H - 8} textAnchor="end" fontSize={10} fill={sub}>{fmt(maxX)}</text>
      </svg>
    </div>
  )
}
