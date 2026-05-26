'use client'

import { useState } from 'react'

interface Market {
  id: string
  platform: string
  question: string
  probability: number | null
  volume: number | null
  volume_label: string | null
  end_date: string | null
  end_date_label: string | null
  traders: number | null
  category: string | null
  url: string
  status: string
  created_at?: string
  probability_change?: number | null
  image_url?: string | null
}

const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold',     limitless: 'Limitless', azuro: 'Azuro',
}

const CATEGORY_LABELS: Record<string, string> = {
  crypto: 'Crypto',   sports: 'Sports',       politics: 'Politics',
  economics: 'Econ',  tech: 'Tech',           science: 'Science',
  entertainment: 'Entertainment',             football: 'Football',
  other: 'General',
}

const CATEGORY_ICONS: Record<string, string> = {
  crypto: '₿',  sports: '🏆',  politics: '🗳️',
  economics: '📈', tech: '💻', science: '🔬',
  entertainment: '🎬', football: '⚽', other: '🌐',
}

function getProbColor(p: number | null) {
  if (p === null) return '#94a3b8'
  if (p >= 0.65)  return '#10b981'
  if (p >= 0.35)  return '#f59e0b'
  return '#ef4444'
}

function getProbBg(p: number | null) {
  if (p === null) return '#f8fafc'
  if (p >= 0.65)  return '#ecfdf5'
  if (p >= 0.35)  return '#fffbeb'
  return '#fef2f2'
}

function getProbLabel(p: number | null): { text: string; color: string; bg: string } | null {
  if (p === null) return null
  if (p >= 0.80) return { text: 'Strong YES', color: '#059669', bg: '#ecfdf5' }
  if (p >= 0.65) return { text: 'Likely YES', color: '#10b981', bg: '#d1fae5' }
  if (p >= 0.45) return { text: 'Toss-up',    color: '#d97706', bg: '#fffbeb' }
  if (p >= 0.20) return { text: 'Unlikely',   color: '#ef4444', bg: '#fef2f2' }
  return              { text: 'Long shot',  color: '#dc2626', bg: '#fef2f2' }
}

function getClosingBadge(end_date: string | null) {
  if (!end_date) return null
  const days = Math.ceil((new Date(end_date).getTime() - Date.now()) / 86400000)
  if (days < 0)  return null
  if (days === 0) return { label: 'Closes today', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
  if (days <= 3)  return { label: `⏰ ${days}d left`, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
  if (days <= 7)  return { label: `⏰ ${days}d left`, color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
  return null
}

function isNewMarket(created_at?: string): boolean {
  if (!created_at) return false
  return Date.now() - new Date(created_at).getTime() < 3 * 86400000
}

function getTrendLabel(change: number | null | undefined) {
  if (!change || Math.abs(change) < 0.005) return null
  const pct = Math.round(Math.abs(change) * 100)
  return change > 0
    ? { label: `↑${pct}%`, color: '#10b981' }
    : { label: `↓${pct}%`, color: '#ef4444' }
}

export default function MarketCard({ market, onClick }: {
  market: Market
  onClick?: () => void
}) {
  const [trading, setTrading] = useState(false)

  const handleTrade = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!market.url) return
    setTrading(true)
    fetch('/api/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market_id: market.id, platform: market.platform, url: market.url }),
    }).catch(() => {})
    window.open(market.url, '_blank', 'noopener,noreferrer')
    setTimeout(() => setTrading(false), 1000)
  }

  const pColor   = getProbColor(market.probability)
  const pBg      = getProbBg(market.probability)
  const probLbl  = getProbLabel(market.probability)
  const closingB = getClosingBadge(market.end_date)
  const isNew    = isNewMarket(market.created_at)
  const trendLbl = getTrendLabel(market.probability_change)

  const pLabel  = PLATFORM_LABELS[market.platform] || market.platform
  const cLabel  = market.category ? (CATEGORY_LABELS[market.category] || market.category) : null
  const cIcon   = market.category ? (CATEGORY_ICONS[market.category] || '') : ''
  const pct     = market.probability !== null ? Math.round(market.probability * 100) : null
  const barW    = pct !== null ? `${pct}%` : '0%'

  const isAzuro  = market.platform === 'azuro'
  const isKalshi = market.platform === 'kalshi'
  const hasProb  = market.probability !== null

  const isKalshiCombo = isKalshi && /^(yes|no) /i.test(market.question)
  const comboParts    = isKalshiCombo ? market.question.split(',').map((s: string) => s.trim()) : []
  const comboSummary  = comboParts.slice(0, 2).join(' · ')
  const comboExtra    = comboParts.length > 2 ? ` +${comboParts.length - 2} more` : ''

  // Avg bet size
  const avgBet = market.volume && market.traders && market.traders > 0
    ? market.volume / market.traders : null
  const avgBetLabel = avgBet
    ? avgBet >= 1000 ? `$${(avgBet / 1000).toFixed(1)}k avg` : `$${Math.round(avgBet)} avg`
    : null

  return (
    <article
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid #e8ecf0', borderRadius: 12,
        overflow: 'hidden', cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.1s',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#c4b5fd'
        e.currentTarget.style.boxShadow   = '0 4px 16px rgba(95,92,240,0.10)'
        e.currentTarget.style.transform   = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#e8ecf0'
        e.currentTarget.style.boxShadow   = 'none'
        e.currentTarget.style.transform   = 'translateY(0)'
      }}
    >
      {/* NEW badge ribbon */}
      {isNew && (
        <div style={{
          position: 'absolute', top: 10, right: -1,
          background: '#5f5cf0', color: '#fff',
          fontSize: 9, fontWeight: 700, letterSpacing: '0.4px',
          padding: '2px 8px 2px 6px', borderRadius: '4px 0 0 4px',
          zIndex: 1,
        }}>
          🆕 NEW
        </div>
      )}

      <div style={{ padding: '14px 14px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Badges row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>

          {/* Platform */}
          <span className={`badge-${market.platform}`} style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
            padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase',
          }}>
            {pLabel}
          </span>

          {/* Category with icon */}
          {cLabel && (
            <span style={{
              fontSize: 10, color: '#94a3b8', background: '#f8fafc',
              border: '1px solid #e2e8f0', padding: '2px 7px',
              borderRadius: 5, fontWeight: 500,
            }}>
              {cIcon} {cLabel}
            </span>
          )}

          {/* Combo badge */}
          {isKalshiCombo && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.4px',
              textTransform: 'uppercase', color: '#059669',
              background: '#ecfdf5', border: '1px solid #a7f3d0',
              borderRadius: 4, padding: '1px 6px',
            }}>
              Combo
            </span>
          )}

          {/* Closing urgency badge */}
          {closingB && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.3px',
              color: closingB.color, background: closingB.bg,
              border: `1px solid ${closingB.border}`,
              borderRadius: 4, padding: '1px 6px',
            }}>
              {closingB.label}
            </span>
          )}
        </div>

        {/* Question */}
        {isKalshiCombo ? (
          <div style={{ marginBottom: 'auto', paddingBottom: 12 }}>
            <h3 className="line-clamp-2" style={{
              fontSize: 13, fontWeight: 500, lineHeight: 1.5,
              color: '#1e293b', margin: 0,
            }}>
              {comboSummary}{comboExtra}
            </h3>
          </div>
        ) : (
          <h3 className="line-clamp-3" style={{
            fontSize: 13, fontWeight: 500, lineHeight: 1.5,
            color: '#1e293b', marginBottom: 'auto', paddingBottom: 12,
          }}>
            {market.question}
          </h3>
        )}

        {/* Probability */}
        <div style={{ marginTop: 12 }}>
          {hasProb ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
                <span style={{
                  fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px',
                  color: pColor,
                }}>
                  {pct}%
                </span>
                {probLbl && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 6px',
                    borderRadius: 4, background: probLbl.bg, color: probLbl.color,
                  }}>
                    {probLbl.text}
                  </span>
                )}
                {trendLbl && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, marginLeft: 'auto',
                    color: trendLbl.color,
                  }}>
                    {trendLbl.label}
                  </span>
                )}
              </div>
              <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: 3, borderRadius: 2, background: pColor,
                  width: barW, transition: 'width 0.6s',
                }} />
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ height: 3, flex: 1, background: '#f1f5f9', borderRadius: 2 }} />
              <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                {isAzuro ? 'On-chain odds' : isKalshi ? 'Combo market' : 'N/A'}
              </span>
              <div style={{ height: 3, flex: 1, background: '#f1f5f9', borderRadius: 2 }} />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px', background: '#fafbfc', borderTop: '1px solid #f1f5f9',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {market.volume_label && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {market.volume_label}
            </span>
          )}
          {avgBetLabel && (
            <span style={{ fontSize: 10, color: '#cbd5e1' }}>
              · {avgBetLabel}
            </span>
          )}
          {market.end_date_label && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {market.volume_label ? '·' : ''} {market.end_date_label}
            </span>
          )}
          {!market.volume_label && !market.end_date_label && market.traders && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {market.traders.toLocaleString()} {market.platform === 'kalshi' ? 'contracts' : 'traders'}
            </span>
          )}
          {!market.volume_label && !market.end_date_label && !market.traders && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {isAzuro ? 'Sports betting' : 'Active'}
            </span>
          )}
        </div>

        <button
          onClick={handleTrade}
          disabled={trading}
          aria-label={`Trade on ${pLabel}`}
          style={{
            fontSize: 11, fontWeight: 600,
            color:      trading ? '#94a3b8' : '#5f5cf0',
            background: trading ? '#f1f5f9' : '#ede9fe',
            border: 'none', padding: '4px 10px', borderRadius: 6,
            cursor: trading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          {trading ? '...' : 'Trade →'}
        </button>
      </div>
    </article>
  )
}