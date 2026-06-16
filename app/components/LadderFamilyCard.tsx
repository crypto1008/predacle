'use client'

import { useState, useEffect } from 'react'

interface Family {
  ladderKey: string
  baseLabel: string
  platform: string
  category: string | null
  rungCount: number
  thresholdMin: number | null
  thresholdMax: number | null
  impliedMedian: number | null
  totalVolume: number | null
  repId: string
  endLabel: string | null
}

const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold', limitless: 'Limitless', azuro: 'Bookmaker',
}
const CATEGORY_LABELS: Record<string, string> = {
  crypto: 'Crypto', sports: 'Sports', politics: 'Politics', economics: 'Econ',
  tech: 'Tech', science: 'Science', entertainment: 'Entertainment', football: 'Football', other: 'General',
}
const CATEGORY_ICONS: Record<string, string> = {
  crypto: '₿', sports: '🏆', politics: '🗳️', economics: '📈',
  tech: '💻', science: '🔬', entertainment: '🎬', football: '⚽', other: '🌐',
}

const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi
function cleanLabel(s: string): string {
  const t = (s || '').replace(MONTHS, m => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase())
  return t.charAt(0).toUpperCase() + t.slice(1)
}
function fmtUsd(n: number | null): string {
  if (n == null) return '—'
  if (Math.abs(n) >= 1000) return `$${Math.round(n).toLocaleString()}`
  return `$${(+Number(n).toFixed(2)).toLocaleString()}`
}
function fmtVol(v: number | null): string | null {
  if (!v) return null
  return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M vol` : v >= 1e3 ? `$${Math.round(v / 1e3)}K vol` : `$${Math.round(v)} vol`
}

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

export default function LadderFamilyCard({ family, onClick }: { family: Family; onClick?: () => void }) {
  const dark = useDark()
  const cardBg       = dark ? '#111318' : '#ffffff'
  const cardBorder   = dark ? '#1e2330' : '#e8ecf0'
  const footerBg     = dark ? '#0d1117' : '#fafbfc'
  const footerBorder = dark ? '#1e2330' : '#f1f5f9'
  const questionClr  = dark ? '#f1f5f9' : '#1e293b'
  const metaClr      = dark ? '#64748b' : '#94a3b8'
  const catBg        = dark ? '#1e2330' : '#f8fafc'
  const catBorder    = dark ? '#2d3748' : '#e2e8f0'
  const subClr       = dark ? '#94a3b8' : '#64748b'

  const pLabel = PLATFORM_LABELS[family.platform] || family.platform
  const cLabel = family.category ? (CATEGORY_LABELS[family.category] || family.category) : null
  const cIcon  = family.category ? (CATEGORY_ICONS[family.category] || '') : ''
  const title  = cleanLabel(family.baseLabel)
  const vol    = fmtVol(family.totalVolume)

  return (
    <article
      onClick={onClick}
      style={{
        background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.1s', position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4b5fd'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(95,92,240,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = cardBorder; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ padding: '14px 14px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className={`badge-${family.platform}`} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.3px', padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase' }}>
            {pLabel}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase', color: '#5f5cf0', background: dark ? '#1e1b4b' : '#ede9fe', border: `1px solid ${dark ? '#312e81' : '#c7d2fe'}`, borderRadius: 4, padding: '1px 6px' }}>
            📊 {family.rungCount} levels
          </span>
          {cLabel && (
            <span style={{ fontSize: 10, color: subClr, background: catBg, border: `1px solid ${catBorder}`, padding: '2px 7px', borderRadius: 5, fontWeight: 500 }}>
              {cIcon} {cLabel}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="line-clamp-2" style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5, color: questionClr, marginBottom: 'auto', paddingBottom: 12 }}>
          {title}
        </h3>

        {/* Implied median headline */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: '#5f5cf0' }}>
              {fmtUsd(family.impliedMedian)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: subClr }}>implied median</span>
          </div>
          <p style={{ fontSize: 11, color: metaClr, margin: 0 }}>
            {family.rungCount} levels · {fmtUsd(family.thresholdMin)}–{fmtUsd(family.thresholdMax)}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: footerBg, borderTop: `1px solid ${footerBorder}` }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {vol && <span style={{ fontSize: 11, color: metaClr }}>{vol}</span>}
          {family.endLabel && <span style={{ fontSize: 11, color: metaClr }}>{vol ? '·' : ''} {family.endLabel}</span>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#5f5cf0', whiteSpace: 'nowrap' }}>
          View distribution →
        </span>
      </div>
    </article>
  )
}
