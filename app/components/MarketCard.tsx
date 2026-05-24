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
}

interface Props {
  market: Market
  onClick?: () => void
}

const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket',
  kalshi:     'Kalshi',
  myriad:     'Myriad',
  manifold:   'Manifold',
  limitless:  'Limitless',
  azuro:      'Azuro',
}

const CATEGORY_LABELS: Record<string, string> = {
  crypto:        'Crypto',
  sports:        'Sports',
  politics:      'Politics',
  economics:     'Economics',
  tech:          'Tech',
  science:       'Science',
  entertainment: 'Entertainment',
  football:      'Football',
  other:         'General',
}

function getProbColor(p: number | null): string {
  if (p === null) return '#94a3b8'
  if (p >= 0.65) return '#10b981'
  if (p >= 0.35) return '#f59e0b'
  return '#ef4444'
}

function getProbBg(p: number | null): string {
  if (p === null) return '#f1f5f9'
  if (p >= 0.65) return '#ecfdf5'
  if (p >= 0.35) return '#fffbeb'
  return '#fef2f2'
}

function formatProb(p: number | null): string {
  if (p === null) return '—'
  return `${Math.round(p * 100)}%`
}

export default function MarketCard({ market, onClick }: Props) {
  const [trading, setTrading] = useState(false)

  const handleTrade = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setTrading(true)
    try {
      const res = await fetch('/api/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_id: market.id,
          platform:  market.platform,
          url:       market.url,
        }),
      })
      const data = await res.json()
      window.open(data.url || market.url, '_blank', 'noopener,noreferrer')
    } catch {
      window.open(market.url, '_blank', 'noopener,noreferrer')
    } finally {
      setTrading(false)
    }
  }

  const pColor = getProbColor(market.probability)
  const pBg    = getProbBg(market.probability)
  const pLabel = PLATFORM_LABELS[market.platform] || market.platform
  const cLabel = market.category ? (CATEGORY_LABELS[market.category] || market.category) : null
  const pct    = market.probability !== null ? Math.round(market.probability * 100) : null
  const barW   = pct !== null ? `${pct}%` : '0%'

  return (
    <article
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #e8ecf0',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.1s',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = '#c4b5fd'
        el.style.boxShadow = '0 4px 16px rgba(95,92,240,0.10)'
        el.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = '#e8ecf0'
        el.style.boxShadow = 'none'
        el.style.transform = 'translateY(0)'
      }}
    >
      {/* Card body */}
      <div style={{ padding: '14px 14px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Top row: platform + category badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className={`badge-${market.platform}`} style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
            padding: '2px 7px', borderRadius: 5, textTransform: 'uppercase',
          }}>
            {pLabel}
          </span>
          {cLabel && (
            <span style={{
              fontSize: 10, color: '#94a3b8', background: '#f8fafc',
              border: '1px solid #e2e8f0', padding: '2px 7px',
              borderRadius: 5, fontWeight: 500,
            }}>
              {cLabel}
            </span>
          )}
        </div>

        {/* Question */}
        <h3 className="line-clamp-3" style={{
          fontSize: 13, fontWeight: 500, lineHeight: 1.5,
          color: '#1e293b', marginBottom: 'auto', paddingBottom: 12,
        }}>
          {market.question}
        </h3>

        {/* Probability */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: pColor }}>
              {formatProb(market.probability)}
            </span>
            {market.probability !== null && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 6px',
                borderRadius: 4, background: pBg, color: pColor,
              }}>
                YES chance
              </span>
            )}
            {market.probability === null && (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>probability</span>
            )}
          </div>
          {/* Bar */}
          <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: 3, borderRadius: 2,
              background: market.probability !== null ? pColor : '#e2e8f0',
              width: barW,
              transition: 'width 0.6s cubic-bezier(0.19, 1, 0.22, 1)',
            }} />
          </div>
        </div>
      </div>

      {/* Card footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 14px', background: '#fafbfc',
        borderTop: '1px solid #f1f5f9',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {market.volume_label && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {market.volume_label}
            </span>
          )}
          {market.end_date_label && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {market.end_date_label}
            </span>
          )}
          {market.traders && !market.volume_label && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {market.traders.toLocaleString()} traders
            </span>
          )}
          {!market.volume_label && !market.end_date_label && !market.traders && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Active market</span>
          )}
        </div>
        <button
          onClick={handleTrade}
          disabled={trading}
          aria-label={`Trade on ${pLabel}`}
          style={{
            fontSize: 11, fontWeight: 600,
            color: trading ? '#94a3b8' : '#5f5cf0',
            background: trading ? '#f1f5f9' : '#ede9fe',
            border: 'none', padding: '4px 10px',
            borderRadius: 6, cursor: trading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s', fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {trading ? '...' : 'Trade →'}
        </button>
      </div>
    </article>
  )
}