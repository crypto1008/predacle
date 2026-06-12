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
  if (h < 1) return 'updated just now'
  if (h === 1) return 'updated 1h ago'
  if (h < 24) return `updated ${h}h ago`
  const d = Math.floor(h / 24)
  return `updated ${d}d ago`
}

// Per-kind pill + metric colors (light / dark).
const KIND_TAG: Record<string, {
  label: string
  color: string; colorD: string
  bgL: string; bgD: string
  bdL: string; bdD: string
  metricL: string; metricD: string
}> = {
  divergence: { label: 'Divergence',  color: '#5f5cf0', colorD: '#a5b4fc', bgL: '#ede9fe', bgD: '#1e1b4b', bdL: '#ddd6fe', bdD: '#312e81', metricL: '#dc2626', metricD: '#f87171' },
  volume:     { label: 'High volume', color: '#059669', colorD: '#34d399', bgL: '#ecfdf5', bgD: '#052e16', bdL: '#a7f3d0', bdD: '#065f46', metricL: '#059669', metricD: '#34d399' },
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

  const panelBg    = dark ? '#111318' : '#ffffff'
  const border     = dark ? '#1e2330' : '#e8ecf0'
  const itemBorder = dark ? '#1e2330' : '#f1f5f9'
  const hoverBg    = dark ? '#15171d' : '#f6f7fb'
  const txt1       = dark ? '#f1f5f9' : '#0f172a'
  const txt2       = dark ? '#94a3b8' : '#64748b'
  const txt3       = dark ? '#475569' : '#94a3b8'
  const ledeBg     = dark ? '#15132e' : '#f5f3ff'
  const ledeBorder = dark ? '#2a2550' : '#ece9fd'
  const ledeText   = dark ? '#c7d2fe' : '#4338ca'
  const dotRing    = dark ? '#1e1b4b' : '#ede9fe'

  return (
    <section style={{ marginBottom: 44 }}>
      <style>{`
        .mb-chev{transition:transform .12s ease,opacity .12s ease;opacity:.4;}
        .mb-row:hover .mb-chev{transform:translateX(3px);opacity:1;}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px', color: txt1, margin: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5f5cf0', boxShadow: `0 0 0 3px ${dotRing}` }} />
          Market Brief
        </h2>
        {brief.generatedAt && <span style={{ fontSize: 11, color: txt3 }}>{relTime(brief.generatedAt)}</span>}
      </div>

      {/* Card */}
      <div style={{ background: panelBg, border: `1px solid ${border}`, borderRadius: 14, padding: '14px 16px' }}>

        {/* Lead summary — slim tinted strip */}
        {brief.lede && (
          <div style={{ background: ledeBg, border: `1px solid ${ledeBorder}`, borderRadius: 9, padding: '10px 12px', marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, fontWeight: 600, color: ledeText }}>{brief.lede}</p>
          </div>
        )}

        {/* Items */}
        {brief.items.map((it, i) => {
          const tag = KIND_TAG[it.kind] || { label: it.kind, color: txt2, colorD: txt2, bgL: '#f1f5f9', bgD: '#1e2330', bdL: '#e2e8f0', bdD: '#2d3748', metricL: txt2, metricD: txt2 }
          const parts = (it.meta || '').split('·').map((s) => s.trim()).filter(Boolean)
          const metric = parts[0] || ''
          const rest = parts.slice(1).join(' · ')
          return (
            <div key={i}>
              {i > 0 && <div style={{ height: 1, background: itemBorder, margin: '0 -8px' }} />}
              <a
                className="mb-row"
                href={it.href}
                style={{ display: 'block', textDecoration: 'none', padding: '11px 8px', margin: '0 -8px', borderRadius: 8, transition: 'background 0.12s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: dark ? tag.colorD : tag.color, background: dark ? tag.bgD : tag.bgL, border: `1px solid ${dark ? tag.bdD : tag.bdL}`, borderRadius: 4, padding: '1px 6px' }}>
                    {tag.label}
                  </span>
                  {metric && <span style={{ fontSize: 11, fontWeight: 700, color: dark ? tag.metricD : tag.metricL }}>{metric}</span>}
                  {rest && <span style={{ fontSize: 11, color: txt3 }}>{rest}</span>}
                  <span style={{ flex: 1 }} />
                  <span className="mb-chev" style={{ fontSize: 14, color: '#5f5cf0', lineHeight: 1 }}>→</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: txt1, lineHeight: 1.4, marginBottom: 2 }}>{it.headline}</div>
                <div style={{ fontSize: 12, color: txt2, lineHeight: 1.45 }}>{it.line}</div>
              </a>
            </div>
          )
        })}

        {/* Footer */}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${itemBorder}`, fontSize: 10.5, color: txt3 }}>
          Auto-generated from live market data. Not financial advice.
        </div>
      </div>
    </section>
  )
}
