'use client'
import { useState, useEffect } from 'react'

interface Headline { title: string; source: string; url: string; published_at: string | null }
interface Mover {
  id: string; platform: string; question: string; probability: number | null
  url: string; stance: 'bullish' | 'bearish' | 'neutral'; score: number
  why: string; drivers: string[]; move: number; headlines: Headline[]
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

const PLATFORM_COLORS: Record<string, string> = {
  polymarket: '#4f46e5', kalshi: '#00b16a', myriad: '#7e22ce',
  manifold: '#cf202f', limitless: '#d97706', azuro: '#0891b2',
}
const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold', limitless: 'Limitless', azuro: 'Bookmaker',
}

function relTime(iso: string | null) {
  if (!iso) return ''
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (h < 1) return 'Updated just now'
  if (h < 24) return `Updated ${h}h ago`
  return `Updated ${Math.floor(h / 24)}d ago`
}

export default function MoversFeed() {
  const [movers, setMovers] = useState<Mover[] | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const dark = useDark()

  useEffect(() => {
    let alive = true
    fetch('/api/movers')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) { setMovers(d.movers || []); setGeneratedAt(d.generatedAt) } })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!movers || movers.length === 0) return null

  const cardBg = dark ? '#16171a' : '#ffffff'
  const border = dark ? '#26282d' : '#eaecef'
  const txt1   = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2   = dark ? '#8a919e' : '#5b616e'
  const txt3   = dark ? '#5b616e' : '#8a919e'
  const up     = dark ? '#2bd97c' : '#05a66b'
  const down   = dark ? '#ff6b6b' : '#e5484d'

  return (
    <section style={{ marginBottom: 52 }}>
      <style>{`
        .mover-card { transition: border-color .15s, transform .12s; }
        .mover-card:hover { border-color: #0052ff !important; transform: translateY(-2px); }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
              color: '#0052ff', background: dark ? '#0f1d3d' : '#eaf0ff',
              border: `1px solid ${dark ? '#1d3563' : '#cdddff'}`, borderRadius: 100, padding: '3px 10px',
            }}>
              AI · News-driven
            </span>
          </div>
          <h2 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: txt1, letterSpacing: '-0.02em', margin: 0 }}>
            What&apos;s moving &amp; why
          </h2>
          <p style={{ fontSize: 14, color: txt2, marginTop: 4 }}>
            Biggest 24-hour odds swings, with the news driving them.
          </p>
        </div>
        {generatedAt && <span style={{ fontSize: 12.5, color: txt3 }}>{relTime(generatedAt)}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {movers.map(m => {
          const moveUp = m.move > 0
          const pct = m.probability !== null ? Math.round(m.probability * 100) : null
          const topNews = m.headlines[0]
          return (
            <a key={m.id} href={`/markets/${m.id}`} className="mover-card"
              style={{
                display: 'block', textDecoration: 'none',
                background: cardBg, border: `1px solid ${border}`,
                borderRadius: 16, padding: '16px 18px',
              }}>
              {/* top row: platform · move · sentiment */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11.5, fontWeight: 600, color: txt2,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PLATFORM_COLORS[m.platform] || '#888' }} />
                  {PLATFORM_LABELS[m.platform] || m.platform}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{
                  fontSize: 12, fontWeight: 700, color: moveUp ? up : down,
                  background: moveUp ? (dark ? '#04291b' : '#e7f8f0') : (dark ? '#3a0d0d' : '#fdecec'),
                  borderRadius: 6, padding: '3px 8px',
                }}>
                  {moveUp ? '↑' : '↓'} {Math.abs(m.move)} pts
                </span>
              </div>

              {/* question */}
              <div style={{ fontSize: 15, fontWeight: 700, color: txt1, lineHeight: 1.35, marginBottom: 8 }}>
                {m.question}
                {pct !== null && (
                  <span style={{ fontWeight: 600, color: txt3, fontSize: 13 }}> · {pct}% YES</span>
                )}
              </div>

              {/* the "why" */}
              {m.why && (
                <div style={{ fontSize: 13.5, color: txt2, lineHeight: 1.5, marginBottom: m.drivers.length || topNews ? 10 : 0 }}>
                  {m.why}
                </div>
              )}

              {/* drivers */}
              {m.drivers.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: topNews ? 10 : 0 }}>
                  {m.drivers.slice(0, 3).map((d, i) => (
                    <span key={i} style={{
                      fontSize: 11, fontWeight: 500, color: txt2,
                      background: dark ? '#0d0e10' : '#f5f6f8', border: `1px solid ${border}`,
                      borderRadius: 100, padding: '3px 9px',
                    }}>{d}</span>
                  ))}
                </div>
              )}

              {/* top headline source */}
              {topNews && (
                <div style={{ fontSize: 11.5, color: txt3, borderTop: `1px solid ${border}`, paddingTop: 9, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, color: txt2 }}>{topNews.source}</span>
                  <span>·</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topNews.title}</span>
                </div>
              )}
            </a>
          )
        })}
      </div>

      <p style={{ marginTop: 14, fontSize: 11.5, color: txt3 }}>
        Sentiment generated by AI from recent news headlines. Not financial advice.
      </p>
    </section>
  )
}
