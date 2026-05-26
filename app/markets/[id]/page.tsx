'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'

interface Market {
  id: string; platform: string; question: string
  probability: number | null; volume: number | null
  volume_label: string | null; end_date: string | null
  end_date_label: string | null; traders: number | null
  category: string | null; url: string; status: string
  fingerprint: string | null
  created_at?: string
  probability_change?: number | null
  image_url?: string | null
}

const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold', limitless: 'Limitless', azuro: 'Azuro',
}

const PLATFORM_URLS: Record<string, string> = {
  polymarket: 'https://polymarket.com', kalshi: 'https://kalshi.com',
  myriad: 'https://myriad.markets', manifold: 'https://manifold.markets',
  limitless: 'https://limitless.exchange', azuro: 'https://azuro.org',
}

const CATEGORY_ICONS: Record<string, string> = {
  crypto: '₿', sports: '🏆', politics: '🗳️', economics: '📈',
  tech: '💻', science: '🔬', entertainment: '🎬', football: '⚽', other: '🌐',
}

function getProbColor(p: number | null) {
  if (p === null) return '#94a3b8'
  if (p >= 0.65) return '#10b981'
  if (p >= 0.35) return '#f59e0b'
  return '#ef4444'
}

function getProbLabel(p: number | null): { text: string; color: string; bg: string; darkBg: string } | null {
  if (p === null) return null
  if (p >= 0.80) return { text: 'Strong YES', color: '#059669', bg: '#ecfdf5', darkBg: '#052e16' }
  if (p >= 0.65) return { text: 'Likely YES', color: '#10b981', bg: '#d1fae5', darkBg: '#052e16' }
  if (p >= 0.45) return { text: 'Toss-up',    color: '#d97706', bg: '#fffbeb', darkBg: '#1c1002' }
  if (p >= 0.20) return { text: 'Unlikely',   color: '#ef4444', bg: '#fef2f2', darkBg: '#1c0202' }
  return              { text: 'Long shot',  color: '#dc2626', bg: '#fef2f2', darkBg: '#1c0202' }
}

function getClosingBadge(end_date: string | null) {
  if (!end_date) return null
  const days = Math.ceil((new Date(end_date).getTime() - Date.now()) / 86400000)
  if (days < 0)   return null
  if (days === 0) return { label: 'Closes today', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
  if (days <= 3)  return { label: `⏰ ${days}d left`, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
  if (days <= 7)  return { label: `⏰ ${days}d left`, color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
  return null
}

function isNewMarket(created_at?: string) {
  if (!created_at) return false
  return Date.now() - new Date(created_at).getTime() < 3 * 86400000
}

function getTrendLabel(change: number | null | undefined) {
  if (!change || Math.abs(change) < 0.005) return null
  const pct = Math.round(Math.abs(change) * 100)
  return change > 0
    ? { label: `↑${pct}% last month`, color: '#10b981' }
    : { label: `↓${pct}% last month`, color: '#ef4444' }
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

function MarketDetail({ id }: { id: string }) {
  const router  = useRouter()
  const dark    = useDark()
  const [market,   setMarket]   = useState<Market | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [trading,  setTrading]  = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/markets/${encodeURIComponent(id)}`)
        if (res.status === 404) { setNotFound(true); return }
        if (!res.ok) throw new Error('Failed')
        setMarket(await res.json())
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    load()
  }, [id])

  // Dark palette
  const bg      = dark ? '#0b0d12'  : '#ffffff'
  const cardBg  = dark ? '#111318'  : '#ffffff'
  const border  = dark ? '#1e2330'  : '#e8ecf0'
  const divider = dark ? '#1e2330'  : '#f1f5f9'
  const txt1    = dark ? '#f1f5f9'  : '#0f172a'
  const txt2    = dark ? '#64748b'  : '#94a3b8'
  const footBg  = dark ? '#0d1117'  : '#fafbfc'
  const statBg  = dark ? '#0d1117'  : '#fafbfc'

  const handleTrade = () => {
    if (!market) return
    setTrading(true)
    fetch('/api/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market_id: market.id, platform: market.platform, url: market.url }),
    }).catch(() => {})
    window.open(market.url, '_blank', 'noopener,noreferrer')
    setTimeout(() => setTrading(false), 1000)
  }

  if (loading) return (
    <div style={{ maxWidth: 720, margin: '60px auto', padding: '0 20px', textAlign: 'center', background: bg }}>
      <div style={{
        width: 40, height: 40,
        border: `3px solid ${border}`, borderTopColor: '#5f5cf0',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
      }} />
      <p style={{ color: txt2, fontSize: 14 }}>Loading market...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (notFound) return (
    <div style={{ maxWidth: 720, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: txt1, marginBottom: 8 }}>Market not found</h1>
      <p style={{ fontSize: 14, color: txt2, marginBottom: 24 }}>
        This market may have expired or been removed
      </p>
      <button onClick={() => router.push('/markets')}
        style={{ padding: '10px 24px', background: '#5f5cf0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        Browse all markets
      </button>
    </div>
  )

  if (!market) return null

  const pColor   = getProbColor(market.probability)
  const probLbl  = getProbLabel(market.probability)
  const closingB = getClosingBadge(market.end_date)
  const isNew    = isNewMarket(market.created_at)
  const trendLbl = getTrendLabel(market.probability_change)
  const pct      = market.probability !== null ? Math.round(market.probability * 100) : null
  const pLabel   = PLATFORM_LABELS[market.platform] || market.platform
  const catLabel = market.category
    ? market.category.charAt(0).toUpperCase() + market.category.slice(1)
    : null
  const catIcon  = market.category ? (CATEGORY_ICONS[market.category] || '') : ''
  const isKalshi = market.platform === 'kalshi'
  const isAzuro  = market.platform === 'azuro'
  const isCombo  = isKalshi && market.question.startsWith('Multi-bet:')

  const avgBet = market.volume && market.traders && market.traders > 0
    ? market.volume / market.traders : null
  const avgBetLabel = avgBet
    ? avgBet >= 1000 ? `$${(avgBet / 1000).toFixed(1)}k avg` : `$${Math.round(avgBet)} avg`
    : null

  return (
    <main id="main" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 64px', background: bg, minHeight: '80vh' }}>

      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, fontSize: 13, color: txt2 }}>
        <a href="/" style={{ color: txt2, textDecoration: 'none' }}>Home</a>
        <span>›</span>
        <a href="/markets" style={{ color: txt2, textDecoration: 'none' }}>Markets</a>
        {catLabel && (<><span>›</span>
          <a href={`/markets?category=${market.category}`} style={{ color: txt2, textDecoration: 'none' }}>
            {catLabel}
          </a></>
        )}
      </nav>

      {/* Main card */}
      <article style={{
        background: cardBg, border: `1px solid ${border}`,
        borderRadius: 16, overflow: 'hidden', marginBottom: 20, position: 'relative',
      }}>

        {isNew && (
          <div style={{
            position: 'absolute', top: 14, right: -1,
            background: '#5f5cf0', color: '#fff',
            fontSize: 9, fontWeight: 700, padding: '2px 8px 2px 6px',
            borderRadius: '4px 0 0 4px', zIndex: 1,
          }}>🆕 NEW</div>
        )}

        {/* Header */}
        <div style={{ padding: '24px 24px 20px', borderBottom: `1px solid ${divider}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <span className={`badge-${market.platform}`} style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.3px',
              padding: '3px 9px', borderRadius: 6, textTransform: 'uppercase',
            }}>
              {pLabel}
            </span>
            {catLabel && (
              <span style={{
                fontSize: 11, color: txt2,
                background: dark ? '#1e2330' : '#f8fafc',
                border: `1px solid ${dark ? '#2d3748' : '#e2e8f0'}`,
                padding: '3px 9px', borderRadius: 6, fontWeight: 500,
              }}>
                {catIcon} {catLabel}
              </span>
            )}
            {isCombo && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#059669',
                background: dark ? '#052e16' : '#ecfdf5',
                border: `1px solid ${dark ? '#065f46' : '#a7f3d0'}`,
                padding: '2px 8px', borderRadius: 5,
              }}>
                Multi-leg bet
              </span>
            )}
            {closingB && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: closingB.color, background: closingB.bg,
                border: `1px solid ${closingB.border}`,
                padding: '2px 8px', borderRadius: 5,
              }}>
                {closingB.label}
              </span>
            )}
            {market.end_date_label && !closingB && (
              <span style={{ fontSize: 11, color: txt2, marginLeft: 'auto' }}>
                Ends {market.end_date_label}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.4, color: txt1 }}>
            {market.question}
          </h1>
        </div>

        {/* Probability */}
        <div style={{ padding: '24px', borderBottom: `1px solid ${divider}` }}>
          {pct !== null ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: 12, color: txt2, fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Current probability
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-1px', color: pColor, lineHeight: 1 }}>
                      {pct}%
                    </p>
                    {probLbl && (
                      <span style={{
                        fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                        background: dark ? probLbl.darkBg : probLbl.bg, color: probLbl.color,
                      }}>
                        {probLbl.text}
                      </span>
                    )}
                    {trendLbl && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: trendLbl.color }}>
                        {trendLbl.label}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: pColor }}>YES</span>
                    <span style={{ fontSize: 12, color: txt2 }}>NO {100 - pct}%</span>
                  </div>
                  <div style={{ height: 8, background: dark ? '#1e2330' : '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: 8, background: pColor, borderRadius: 4, width: `${pct}%`, transition: 'width 0.6s' }} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{
              background: dark ? '#052e16' : '#f0fdf4',
              border: `1px solid ${dark ? '#065f46' : '#bbf7d0'}`,
              borderRadius: 10, padding: '16px 18px',
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#15803d', marginBottom: 6 }}>
                {isKalshi ? 'No current offers in order book' : isAzuro ? 'On-chain odds available' : 'Probability not available'}
              </p>
              <p style={{ fontSize: 13, color: '#16a34a', lineHeight: 1.5 }}>
                {isKalshi
                  ? 'There are no active sell orders right now. You can place your own offer on Kalshi directly.'
                  : isAzuro ? 'Live betting odds are available directly on the Azuro platform.'
                  : 'This market does not currently report probability data.'}
              </p>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: `1px solid ${divider}` }}>
          {[
            { label: 'Volume',   val: market.volume_label || '—' },
            { label: 'Avg Bet',  val: avgBetLabel || '—' },
            { label: 'Traders',  val: market.traders ? market.traders.toLocaleString() : '—' },
            { label: 'Platform', val: pLabel },
          ].map(s => (
            <div key={s.label} style={{
              flex: '1 1 120px', padding: '16px 24px',
              borderRight: `1px solid ${divider}`,
            }}>
              <p style={{ fontSize: 11, color: txt2, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: txt1 }}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Trade CTA */}
        <div style={{
          padding: '20px 24px', background: footBg,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: txt1, marginBottom: 2 }}>
              Trade this market on {pLabel}
            </p>
            <p style={{ fontSize: 12, color: txt2 }}>
              Opens {PLATFORM_URLS[market.platform] || pLabel} in a new tab
            </p>
          </div>
          <button
            onClick={handleTrade} disabled={trading}
            style={{
              padding: '12px 28px', fontSize: 14, fontWeight: 700,
              background: trading ? (dark ? '#1e2330' : '#94a3b8') : '#5f5cf0',
              color: '#fff', border: 'none', borderRadius: 10,
              cursor: trading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background 0.15s',
            }}
          >
            {trading ? 'Opening...' : `Trade on ${pLabel} →`}
          </button>
        </div>
      </article>

      <p style={{ fontSize: 12, color: txt2, textAlign: 'center', lineHeight: 1.6 }}>
        Predacle aggregates public data from prediction market platforms.
        This is not financial advice. Always do your own research before trading.
      </p>
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button onClick={() => router.back()}
          style={{ fontSize: 13, color: '#5f5cf0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
          ← Back to markets
        </button>
      </div>
    </main>
  )
}

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <>
      <Suspense fallback={<div style={{ height: 56, background: '#fff', borderBottom: '1px solid #e8ecf0' }} />}>
        <Header />
      </Suspense>
      <MarketDetail id={id} />
      <Footer />
    </>
  )
}