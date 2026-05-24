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

function getProbColor(p: number | null) {
  if (p === null) return '#94a3b8'
  if (p >= 0.65) return '#10b981'
  if (p >= 0.35) return '#f59e0b'
  return '#ef4444'
}

function MarketDetail({ id }: { id: string }) {
  const router = useRouter()
  const [market, setMarket]     = useState<Market | null>(null)
  const [loading, setLoading]   = useState(true)
  const [trading, setTrading]   = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/markets/${encodeURIComponent(id)}`)
        if (res.status === 404) { setNotFound(true); return }
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setMarket(data)
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    load()
  }, [id])

  const handleTrade = () => {
    if (!market) return
    setTrading(true)
    // Fire tracking in background
    fetch('/api/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        market_id: market.id,
        platform: market.platform,
        url: market.url,
      }),
    }).catch(() => {})
    // Open immediately — direct user gesture
    window.open(market.url, '_blank', 'noopener,noreferrer')
    setTimeout(() => setTrading(false), 1000)
  }

  if (loading) return (
    <div style={{ maxWidth: 720, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
      <div style={{
        width: 40, height: 40, border: '3px solid #e8ecf0',
        borderTopColor: '#5f5cf0', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
      }} />
      <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading market...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (notFound) return (
    <div style={{ maxWidth: 720, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Market not found</h1>
      <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>This market may have expired or been removed</p>
      <button onClick={() => router.push('/markets')}
        style={{ padding: '10px 24px', background: '#5f5cf0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        Browse all markets
      </button>
    </div>
  )

  if (!market) return null

  const pColor   = getProbColor(market.probability)
  const pct      = market.probability !== null ? Math.round(market.probability * 100) : null
  const pLabel   = PLATFORM_LABELS[market.platform] || market.platform
  const catLabel = market.category ? market.category.charAt(0).toUpperCase() + market.category.slice(1) : null

  return (
    <main id="main" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 64px' }}>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, fontSize: 13, color: '#94a3b8' }}>
        <a href="/" style={{ color: '#94a3b8', textDecoration: 'none' }}>Home</a>
        <span>›</span>
        <a href="/markets" style={{ color: '#94a3b8', textDecoration: 'none' }}>Markets</a>
        {catLabel && (
          <>
            <span>›</span>
            <a href={`/markets?category=${market.category}`} style={{ color: '#94a3b8', textDecoration: 'none' }}>{catLabel}</a>
          </>
        )}
      </nav>

      {/* Main card */}
      <article style={{ background: '#fff', border: '1px solid #e8ecf0', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>

        {/* Header */}
        <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <span className={`badge-${market.platform}`} style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.3px',
              padding: '3px 9px', borderRadius: 6, textTransform: 'uppercase',
            }}>
              {pLabel}
            </span>
            {catLabel && (
              <span style={{ fontSize: 11, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 9px', borderRadius: 6, fontWeight: 500 }}>
                {catLabel}
              </span>
            )}
            {market.end_date_label && (
              <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>
                Ends {market.end_date_label}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.4, color: '#0f172a' }}>
            {market.question}
          </h1>
        </div>

        {/* Probability */}
        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Current probability
              </p>
              <p style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-1px', color: pColor, lineHeight: 1 }}>
                {pct !== null ? `${pct}%` : '—'}
              </p>
            </div>
            {pct !== null && (
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: pColor }}>YES</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>NO {100 - pct}%</span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: 8, background: pColor, borderRadius: 4, width: `${pct}%`, transition: 'width 0.6s' }} />
                </div>
              </div>
            )}
            {pct === null && (
              <p style={{ fontSize: 13, color: '#94a3b8' }}>
                {market.platform === 'azuro' ? 'On-chain odds available on platform' : 'Probability data not available'}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9' }}>
          {[
            { label: 'Volume',   val: market.volume_label || '—' },
            { label: 'Traders',  val: market.traders ? market.traders.toLocaleString() : '—' },
            { label: 'Platform', val: pLabel },
            { label: 'Category', val: catLabel || '—' },
          ].map(s => (
            <div key={s.label} style={{ flex: '1 1 120px', padding: '16px 24px', borderRight: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Trade CTA */}
        <div style={{
          padding: '20px 24px', background: '#fafbfc',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
              Trade this market on {pLabel}
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>
              Opens {PLATFORM_URLS[market.platform] || pLabel} in a new tab
            </p>
          </div>
          <button
            onClick={handleTrade}
            disabled={trading}
            style={{
              padding: '12px 28px', fontSize: 14, fontWeight: 700,
              background: trading ? '#94a3b8' : '#5f5cf0',
              color: '#fff', border: 'none', borderRadius: 10,
              cursor: trading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background 0.15s',
            }}
          >
            {trading ? 'Opening...' : `Trade on ${pLabel} →`}
          </button>
        </div>
      </article>

      {/* Disclaimer */}
      <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 1.6 }}>
        Predacle aggregates public data from prediction market platforms.
        This is not financial advice. Always do your own research before trading.
      </p>

      {/* Back */}
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