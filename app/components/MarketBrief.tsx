'use client'
import { useState, useEffect } from 'react'

interface BriefItem { kind: string; headline: string; meta: string; line: string; href: string }
interface Brief { generatedAt: string | null; lede: string | null; items: BriefItem[] }

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

function relTime(iso: string | null) {
  if (!iso) return ''
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (h < 1) return 'Updated just now'
  if (h === 1) return 'Updated 1h ago'
  if (h < 24) return `Updated ${h}h ago`
  const d = Math.floor(h / 24)
  return `Updated ${d}d ago`
}

// Per-kind accent (light / dark).
const KIND: Record<string, { label: string; aL: string; aD: string; bgL: string; bgD: string; bdL: string; bdD: string }> = {
  divergence: { label: 'Price divergence', aL: '#0052ff', aD: '#6b9bff', bgL: '#eaf0ff', bgD: '#0f1d3d', bdL: '#cdddff', bdD: '#1d3563' },
  volume:     { label: 'High volume',      aL: '#05a66b', aD: '#2bd97c', bgL: '#e7f8f0', bgD: '#04291b', bdL: '#bfeed8', bdD: '#0a5235' },
}

export default function MarketBrief() {
  const [brief, setBrief] = useState<Brief | null>(null)
  const dark = useDark()

  useEffect(() => {
    let alive = true
    fetch('/api/market-brief')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setBrief(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!brief || !brief.items || brief.items.length === 0) return null

  const cardBg = dark ? '#16171a' : '#ffffff'
  const border = dark ? '#26282d' : '#eaecef'
  const txt1   = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2   = dark ? '#8a919e' : '#5b616e'
  const txt3   = dark ? '#5b616e' : '#8a919e'
  const ledeBg = dark ? '#0f1d3d' : '#eef4ff'
  const ledeBd = dark ? '#1d3563' : '#d8e6ff'
  const ledeTx = dark ? '#c9dcff' : '#0a3aaf'

  return (
    <section style={{ marginBottom: 52 }}>
      <style>{`
        .brief-card { transition: border-color .15s, transform .12s; }
        .brief-card:hover { border-color: #0052ff !important; transform: translateY(-2px); }
        .brief-card:hover .brief-arrow { transform: translateX(3px); opacity: 1; }
        .brief-arrow { transition: transform .12s, opacity .12s; opacity: .45; }
      `}</style>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <span style={{
              fontSize: 10.5, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
              color: '#0052ff', background: dark ? '#0f1d3d' : '#eaf0ff',
              border: `1px solid ${dark ? '#1d3563' : '#cdddff'}`, borderRadius: 100, padding: '3px 10px',
            }}>
              AI · Auto-generated
            </span>
          </div>
          <h2 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: txt1, letterSpacing: '-0.02em', margin: 0 }}>
            Market Brief
          </h2>
        </div>
        {brief.generatedAt && <span style={{ fontSize: 12.5, color: txt3 }}>{relTime(brief.generatedAt)}</span>}
      </div>

      {/* Lead summary strip */}
      {brief.lede && (
        <div style={{
          background: ledeBg, border: `1px solid ${ledeBd}`, borderRadius: 16,
          padding: '16px 18px', marginBottom: 16,
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1.3, flexShrink: 0 }}>📊</span>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, fontWeight: 600, color: ledeTx }}>{brief.lede}</p>
        </div>
      )}

      {/* Item cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {brief.items.map((it, i) => {
          const k = KIND[it.kind] || { label: it.kind, aL: txt2, aD: txt2, bgL: '#f5f6f8', bgD: '#16171a', bdL: border, bdD: border }
          const accent = dark ? k.aD : k.aL
          const parts = (it.meta || '').split('·').map((s) => s.trim()).filter(Boolean)
          const metric = parts[0] || ''
          const rest = parts.slice(1).join(' · ')
          return (
            <a key={i} href={it.href} className="brief-card"
              style={{
                display: 'block', textDecoration: 'none',
                background: cardBg, border: `1px solid ${border}`,
                borderRadius: 16, padding: '16px 18px',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
                  color: accent, background: dark ? k.bgD : k.bgL,
                  border: `1px solid ${dark ? k.bdD : k.bdL}`, borderRadius: 6, padding: '3px 9px',
                }}>
                  {k.label}
                </span>
                <span style={{ flex: 1 }} />
                <span className="brief-arrow" style={{ fontSize: 16, color: '#0052ff', lineHeight: 1 }}>→</span>
              </div>

              {(metric || rest) && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  {metric && <span className="font-display" style={{ fontSize: 22, fontWeight: 800, color: accent, letterSpacing: '-0.02em' }}>{metric}</span>}
                  {rest && <span style={{ fontSize: 12.5, color: txt3 }}>{rest}</span>}
                </div>
              )}

              <div style={{ fontSize: 15, fontWeight: 700, color: txt1, lineHeight: 1.35, marginBottom: 5 }}>{it.headline}</div>
              <div style={{ fontSize: 13, color: txt2, lineHeight: 1.5 }}>{it.line}</div>
            </a>
          )
        })}
      </div>

      <p style={{ marginTop: 14, fontSize: 11.5, color: txt3 }}>
        Generated from live market data. Not financial advice.
      </p>
    </section>
  )
}
