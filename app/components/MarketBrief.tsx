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

const KIND_TAG: Record<string, { label: string; color: string }> = {
  divergence: { label: 'Divergence', color: '#5f5cf0' },
  volume:     { label: 'High volume', color: '#059669' },
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
  const footerBg   = dark ? '#0d1117' : '#fafbfc'
  const hoverBg    = dark ? '#15171d' : '#fafaff'
  const txt1       = dark ? '#f1f5f9' : '#0f172a'
  const txt2       = dark ? '#94a3b8' : '#64748b'
  const txt3       = dark ? '#475569' : '#94a3b8'

  return (
    <section style={{ marginBottom: 44 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: txt1, margin: 0 }}>📡 Market Brief</h2>
        {brief.generatedAt && <span style={{ fontSize: 12, color: txt3 }}>{relTime(brief.generatedAt)}</span>}
      </div>

      <div style={{ background: panelBg, border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden' }}>
        {brief.lede && (
          <p style={{
            fontSize: 14, lineHeight: 1.6, color: txt2, margin: 0,
            padding: '15px 18px', borderLeft: '3px solid #5f5cf0',
            borderBottom: `1px solid ${itemBorder}`,
          }}>
            {brief.lede}
          </p>
        )}

        {brief.items.map((it, i) => {
          const tag = KIND_TAG[it.kind] || { label: it.kind, color: '#64748b' }
          return (
            <a
              key={i}
              href={it.href}
              style={{
                display: 'block', padding: '13px 18px', textDecoration: 'none',
                borderTop: i === 0 && !brief.lede ? 'none' : `1px solid ${itemBorder}`,
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: tag.color }}>
                  {tag.label}
                </span>
                <span style={{ fontSize: 11, color: txt3 }}>{it.meta}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: txt1, lineHeight: 1.4, marginBottom: 3 }}>
                {it.headline}
              </div>
              <div style={{ fontSize: 13, color: txt2, lineHeight: 1.5 }}>{it.line}</div>
            </a>
          )
        })}

        <div style={{
          padding: '9px 18px', fontSize: 11, color: txt3,
          background: footerBg, borderTop: `1px solid ${itemBorder}`,
        }}>
          Auto-generated from live market data. Not financial advice.
        </div>
      </div>
    </section>
  )
}
