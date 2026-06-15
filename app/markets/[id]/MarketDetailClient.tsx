'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import ProbabilityChart from '../../components/ProbabilityChart'
import { affiliateUrl } from '@/lib/affiliate'
import MarketLpPanel from '../../components/MarketLpPanel'

export interface Market {
  id: string; platform: string; question: string
  probability: number | null; volume: number | null
  volume_label: string | null; end_date: string | null
  end_date_label: string | null; traders: number | null
  category: string | null; url: string; status: string
  fingerprint: string | null; created_at?: string
  probability_change?: number | null; image_url?: string | null
}

interface RelatedMarket {
  id: string; platform: string; question: string
  probability: number | null; volume_label: string | null
  end_date_label: string | null; url: string
}

interface CrossPlatform {
  id: string; platform: string
  probability: number | null; volume_label: string | null
  url: string; question: string
}

interface AISummary {
  summary: string; signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  signal_reason: string; key_insight: string
}

const PLATFORM_LABELS: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold', limitless: 'Limitless', azuro: 'Bookmaker',
}

const PLATFORM_URLS: Record<string, string> = {
  polymarket: 'https://polymarket.com', kalshi: 'https://kalshi.com',
  myriad: 'https://myriad.markets', manifold: 'https://manifold.markets',
  limitless: 'https://limitless.exchange', azuro: 'https://bookmaker.xyz',
}

const PLATFORM_COLORS: Record<string, string> = {
  polymarket: '#6d28d9', kalshi: '#059669', myriad: '#7e22ce',
  manifold: '#dc2626', limitless: '#d97706', azuro: '#0891b2',
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

function getTimelineProgress(created_at?: string, end_date?: string | null): number | null {
  if (!created_at || !end_date) return null
  const start = new Date(created_at).getTime()
  const end   = new Date(end_date).getTime()
  const now   = Date.now()
  if (now >= end) return 100
  if (now <= start) return 0
  return Math.round((now - start) / (end - start) * 100)
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

function MarketDetail({ id, initialMarket }: { id: string; initialMarket: Market | null }) {
  const router = useRouter()
  const dark   = useDark()

  const [market,         setMarket]         = useState<Market | null>(initialMarket)
  const [loading,        setLoading]        = useState(!initialMarket)
  const [trading,        setTrading]        = useState(false)
  const [notFound,       setNotFound]       = useState(false)
  const [copied,         setCopied]         = useState(false)
  const [betAmount,      setBetAmount]      = useState(100)
  const [betSide,        setBetSide]        = useState<'YES' | 'NO'>('YES')
  const [aiSummary,      setAiSummary]      = useState<AISummary | null>(null)
  const [aiLoading,      setAiLoading]      = useState(false)
  const [aiError,        setAiError]        = useState(false)
  const [crossPlatform,  setCrossPlatform]  = useState<CrossPlatform[]>([])
  const [similar,        setSimilar]        = useState<RelatedMarket[]>([])
  const [platformHealth, setPlatformHealth] = useState<'live' | 'delayed' | 'offline' | null>(null)

  useEffect(() => {
    if (initialMarket) return
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
  }, [id, initialMarket])

  useEffect(() => {
    if (!market) return

    // AI summary
    const fetchAI = async () => {
      setAiLoading(true)
      try {
        const res = await fetch('/api/ai/market-summary', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(market),
        })
        if (!res.ok) { setAiError(true); return }
        const data = await res.json()
        if (data.error) { setAiError(true); return }
        setAiSummary(data)
      } catch { setAiError(true) }
      finally { setAiLoading(false) }
    }

    // Related markets
    const fetchRelated = async () => {
      try {
        const res  = await fetch(`/api/markets/${encodeURIComponent(id)}/related`)
        const data = await res.json()
        setCrossPlatform(data.crossPlatform || [])
        setSimilar(data.similar || [])
      } catch {}
    }

    // Platform health
    const fetchHealth = async () => {
      try {
        const res  = await fetch('/api/status')
        const data = await res.json()
        const mins = data.overall?.minutesAgo ?? 999
        if (mins < 90)       setPlatformHealth('live')
        else if (mins < 240)  setPlatformHealth('delayed')
        else                 setPlatformHealth('offline')
      } catch {}
    }

    fetchAI()
    fetchRelated()
    fetchHealth()
  }, [market, id])

  const handleTrade = () => {
    if (!market) return
    setTrading(true)
    fetch('/api/track-click', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market_id: market.id, platform: market.platform, url: market.url }),
    }).catch(() => {})
    window.open(affiliateUrl(market.platform, market.url), '_blank', 'noopener,noreferrer')
    setTimeout(() => setTrading(false), 1000)
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/markets/${id}`
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const handleTweet = () => {
    if (!market) return
    const url  = `${window.location.origin}/markets/${id}`
    const pct  = market.probability !== null ? Math.round(market.probability * 100) : null
    const text = `${market.question}${pct !== null ? ` — ${pct}% probability` : ''} via Predacle`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank')
  }

  // Dark palette
  const bg      = dark ? '#0b0d12' : '#ffffff'
  const cardBg  = dark ? '#111318' : '#ffffff'
  const border  = dark ? '#1e2330' : '#e8ecf0'
  const divider = dark ? '#1e2330' : '#f1f5f9'
  const txt1    = dark ? '#f1f5f9' : '#0f172a'
  const txt2    = dark ? '#64748b' : '#94a3b8'
  const footBg  = dark ? '#0d1117' : '#fafbfc'
  const inputBg = dark ? '#1e2330' : '#f5f7fa'

  if (loading) return (
    <div style={{ maxWidth: 720, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${border}`, borderTopColor: '#5f5cf0', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
      <p style={{ color: txt2, fontSize: 14 }}>Loading market...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (notFound) return (
    <div style={{ maxWidth: 720, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: txt1, marginBottom: 8 }}>Market not found</h1>
      <p style={{ fontSize: 14, color: txt2, marginBottom: 24 }}>This market may have expired or been removed</p>
      <button onClick={() => router.push('/markets')}
        style={{ padding: '10px 24px', background: '#5f5cf0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
        Browse all markets
      </button>
    </div>
  )

  if (!market) return null

  const pColor       = getProbColor(market.probability)
  const probLbl      = getProbLabel(market.probability)
  const closingB     = getClosingBadge(market.end_date)
  const isNew        = isNewMarket(market.created_at)
  const trendLbl     = getTrendLabel(market.probability_change)
  const timelinePct  = getTimelineProgress(market.created_at, market.end_date)
  const pct          = market.probability !== null ? Math.round(market.probability * 100) : null
  const pLabel       = PLATFORM_LABELS[market.platform] || market.platform
  const catLabel     = market.category ? market.category.charAt(0).toUpperCase() + market.category.slice(1) : null
  const catIcon      = market.category ? (CATEGORY_ICONS[market.category] || '') : ''
  const isKalshi     = market.platform === 'kalshi'
  const isAzuro      = market.platform === 'azuro'
  const avgBet       = market.volume && market.traders && market.traders > 0 ? market.volume / market.traders : null
  const avgBetLabel  = avgBet ? avgBet >= 1000 ? `$${(avgBet / 1000).toFixed(1)}k avg` : `$${Math.round(avgBet)} avg` : null

  // Bet calculator
  const prob      = market.probability || 0.5
  const yesProfit = betAmount * (1 - prob) / prob
  const noProfit  = betAmount * prob / (1 - prob)
  const profit    = betSide === 'YES' ? yesProfit : noProfit
  const payout    = betAmount + profit
  const returnPct = betSide === 'YES' ? Math.round((1 - prob) / prob * 100) : Math.round(prob / (1 - prob) * 100)

  // AI signal
  const signalStyle = aiSummary ? {
    BULLISH: { color: '#059669', bg: dark ? '#052e16' : '#ecfdf5', label: '↑ Bullish' },
    BEARISH: { color: '#dc2626', bg: dark ? '#1c0202' : '#fef2f2', label: '↓ Bearish' },
    NEUTRAL: { color: '#d97706', bg: dark ? '#1c1002' : '#fffbeb', label: '→ Neutral' },
  }[aiSummary.signal] : null

  // Health badge
  const healthBadge = platformHealth ? {
    live:    { label: '🟢 Live',    color: '#059669', bg: dark ? '#052e16' : '#ecfdf5' },
    delayed: { label: '🟡 Delayed', color: '#d97706', bg: dark ? '#1c1002' : '#fffbeb' },
    offline: { label: '🔴 Offline', color: '#dc2626', bg: dark ? '#1c0202' : '#fef2f2' },
  }[platformHealth] : null

  return (
    <main id="main" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 64px', background: bg, minHeight: '80vh' }}>

      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, fontSize: 13, color: txt2 }}>
        <a href="/" style={{ color: txt2, textDecoration: 'none' }}>Home</a>
        <span>›</span>
        <a href="/markets" style={{ color: txt2, textDecoration: 'none' }}>Markets</a>
        {catLabel && (<><span>›</span>
          <a href={`/markets?category=${market.category}`} style={{ color: txt2, textDecoration: 'none' }}>{catLabel}</a>
        </>)}
      </nav>

      {/* Main card */}
      <article style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16, position: 'relative' }}>

        {isNew && (
          <div style={{ position: 'absolute', top: 14, right: -1, background: '#5f5cf0', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 8px 2px 6px', borderRadius: '4px 0 0 4px', zIndex: 1 }}>
            🆕 NEW
          </div>
        )}

        {/* Header */}
        <div style={{ padding: '24px 24px 20px', borderBottom: `1px solid ${divider}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>

            {/* Platform badge */}
            <span className={`badge-${market.platform}`} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.3px', padding: '3px 9px', borderRadius: 6, textTransform: 'uppercase' }}>
              {pLabel}
            </span>

            {/* Health badge */}
            {healthBadge && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: healthBadge.bg, color: healthBadge.color }}>
                {healthBadge.label}
              </span>
            )}

            {/* Category */}
            {catLabel && (
              <span style={{ fontSize: 11, color: txt2, background: dark ? '#1e2330' : '#f8fafc', border: `1px solid ${dark ? '#2d3748' : '#e2e8f0'}`, padding: '3px 9px', borderRadius: 6, fontWeight: 500 }}>
                {catIcon} {catLabel}
              </span>
            )}

            {/* Closing badge */}
            {closingB && (
              <span style={{ fontSize: 10, fontWeight: 700, color: closingB.color, background: closingB.bg, border: `1px solid ${closingB.border}`, padding: '2px 8px', borderRadius: 5 }}>
                {closingB.label}
              </span>
            )}

            {market.end_date_label && !closingB && (
              <span style={{ fontSize: 11, color: txt2, marginLeft: 'auto' }}>Ends {market.end_date_label}</span>
            )}
          </div>

          <h1 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.4, color: txt1, marginBottom: 16 }}>
            {market.question}
          </h1>

          {/* Share buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleCopyLink} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: `1px solid ${border}`, borderRadius: 8, background: copied ? (dark ? '#052e16' : '#ecfdf5') : cardBg, color: copied ? '#059669' : txt2, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {copied ? '✓ Copied!' : '🔗 Copy link'}
            </button>
            <button onClick={handleTweet} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: `1px solid ${border}`, borderRadius: 8, background: cardBg, color: txt2, cursor: 'pointer', fontFamily: 'inherit' }}>
              𝕏 Share on X
            </button>
          </div>
        </div>

        {/* Probability */}
        <div style={{ padding: '24px', borderBottom: `1px solid ${divider}` }}>
          {pct !== null ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: 12, color: txt2, fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current probability</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-1px', color: pColor, lineHeight: 1 }}>{pct}%</p>
                    {probLbl && (
                      <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: dark ? probLbl.darkBg : probLbl.bg, color: probLbl.color }}>
                        {probLbl.text}
                      </span>
                    )}
                    {trendLbl && <span style={{ fontSize: 12, fontWeight: 600, color: trendLbl.color }}>{trendLbl.label}</span>}
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

              {/* Timeline */}
              {timelinePct !== null && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: txt2 }}>
                    <span>Created</span>
                    <span style={{ fontWeight: 600, color: '#5f5cf0' }}>Today ({timelinePct}% elapsed)</span>
                    <span>Closes {market.end_date_label}</span>
                  </div>
                  <div style={{ height: 4, background: dark ? '#1e2330' : '#f1f5f9', borderRadius: 4, position: 'relative' }}>
                    <div style={{ height: 4, background: 'linear-gradient(90deg, #5f5cf0, #a78bfa)', borderRadius: 4, width: `${timelinePct}%` }} />
                    <div style={{ position: 'absolute', top: '50%', left: `${timelinePct}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', background: '#5f5cf0', border: `2px solid ${cardBg}` }} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ background: dark ? '#052e16' : '#f0fdf4', border: `1px solid ${dark ? '#065f46' : '#bbf7d0'}`, borderRadius: 10, padding: '16px 18px' }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#15803d', marginBottom: 6 }}>
                {isKalshi ? 'No current offers in order book' : isAzuro ? 'On-chain odds available' : 'Probability not available'}
              </p>
              <p style={{ fontSize: 13, color: '#16a34a', lineHeight: 1.5 }}>
                {isKalshi ? 'No active sell orders right now. You can place your own offer on Kalshi.'
                 : isAzuro ? 'Live betting odds available directly on the Azuro platform.'
                 : 'This market does not currently report probability data.'}
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: `1px solid ${divider}` }}>
          {[
            { label: 'Volume',   val: market.volume_label || '—' },
            { label: 'Avg Bet',  val: avgBetLabel || '—' },
            { label: 'Traders',  val: market.traders ? market.traders.toLocaleString() : '—' },
            { label: 'Platform', val: pLabel },
          ].map(s => (
            <div key={s.label} style={{ flex: '1 1 120px', padding: '16px 24px', borderRight: `1px solid ${divider}` }}>
              <p style={{ fontSize: 11, color: txt2, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: txt1 }}>{s.val}</p>
            </div>
          ))}
        </div>

        {/* Trade CTA */}
        <div style={{ padding: '20px 24px', background: footBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: txt1, marginBottom: 2 }}>Trade this market on {pLabel}</p>
            <p style={{ fontSize: 12, color: txt2 }}>Opens {PLATFORM_URLS[market.platform] || pLabel} in a new tab</p>
          </div>
          <button onClick={handleTrade} disabled={trading}
            style={{ padding: '12px 28px', fontSize: 14, fontWeight: 700, background: trading ? (dark ? '#1e2330' : '#94a3b8') : '#5f5cf0', color: '#fff', border: 'none', borderRadius: 10, cursor: trading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {trading ? 'Opening...' : `Trade on ${pLabel} →`}
          </button>
        </div>
      </article>

      {/* Probability history */}
      {pct !== null && <ProbabilityChart marketId={id} dark={dark} />}

      {/* Bet Calculator */}
      {pct !== null && (
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${divider}` }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: txt1 }}>🧮 Bet Calculator</h2>
            <p style={{ fontSize: 12, color: txt2, marginTop: 2 }}>Estimate your potential profit</p>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 11, color: txt2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                  Bet Amount (USD)
                </label>
                <input type="number" min="1" value={betAmount}
                  onChange={e => setBetAmount(Math.max(1, parseFloat(e.target.value) || 1))}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 15, fontWeight: 600, border: `1px solid ${border}`, borderRadius: 8, background: inputBg, color: txt1, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: txt2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>Bet on</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['YES', 'NO'] as const).map(side => (
                    <button key={side} onClick={() => setBetSide(side)}
                      style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: `1px solid ${betSide === side ? (side === 'YES' ? '#10b981' : '#ef4444') : border}`, background: betSide === side ? (side === 'YES' ? (dark ? '#052e16' : '#ecfdf5') : (dark ? '#1c0202' : '#fef2f2')) : cardBg, color: betSide === side ? (side === 'YES' ? '#10b981' : '#ef4444') : txt2, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {side}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              {[10, 50, 100, 500, 1000].map(amt => (
                <button key={amt} onClick={() => setBetAmount(amt)}
                  style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: `1px solid ${border}`, background: betAmount === amt ? '#5f5cf0' : cardBg, color: betAmount === amt ? '#fff' : txt2, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ${amt}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, background: dark ? '#0d1117' : '#f8fafc', border: `1px solid ${border}`, borderRadius: 12, padding: '16px' }}>
              {[
                { label: 'Profit if correct', val: `$${profit.toFixed(2)}`, color: betSide === 'YES' ? '#10b981' : '#ef4444' },
                { label: 'Total payout',      val: `$${payout.toFixed(2)}`,  color: txt1 },
                { label: 'Return',            val: `${returnPct}%`,           color: '#5f5cf0' },
              ].map(r => (
                <div key={r.label} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: txt2, fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{r.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: r.color }}>{r.val}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: txt2, marginTop: 10, textAlign: 'center' }}>Based on current {pct}% probability. Actual prices may vary.</p>
          </div>
        </div>
      )}

      {/* LP Rewards — only renders for reward-eligible markets */}
      <MarketLpPanel marketId={id} platform={market.platform} dark={dark} />

      {/* AI Summary */}
      <div style={{ background: cardBg, border: `1px solid ${dark ? '#2d1b69' : '#c4b5fd'}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${divider}`, background: dark ? '#1a0f4a' : '#faf9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: txt1 }}>🤖 AI Market Analysis</h2>
            <p style={{ fontSize: 12, color: txt2, marginTop: 2 }}>Powered by Gemini AI</p>
          </div>
          {aiSummary && signalStyle && (
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: signalStyle.bg, color: signalStyle.color, border: `1px solid ${signalStyle.color}33` }}>
              {signalStyle.label}
            </span>
          )}
        </div>
        <div style={{ padding: '20px 24px' }}>
          {aiLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: txt2 }}>
              <div style={{ width: 16, height: 16, border: `2px solid ${border}`, borderTopColor: '#5f5cf0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Analyzing market...</span>
            </div>
          )}
          {aiError && <p style={{ fontSize: 13, color: txt2 }}>AI analysis unavailable. Try refreshing the page.</p>}
          {aiSummary && (
            <div>
              <p style={{ fontSize: 14, color: txt1, lineHeight: 1.7, marginBottom: 16 }}>{aiSummary.summary}</p>
              <p style={{ fontSize: 11, color: txt2, lineHeight: 1.5, marginBottom: 16, fontStyle: 'italic' }}>The signal reflects how the AI reads value at the current price: Bullish = underpriced, Bearish = overpriced, Neutral = fairly priced. An opinion, not financial advice.</p>
              <div style={{ background: dark ? '#0d1117' : '#f8fafc', border: `1px solid ${border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: txt2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Signal Reasoning</p>
                <p style={{ fontSize: 13, color: txt1, lineHeight: 1.6 }}>{aiSummary.signal_reason}</p>
              </div>
              <div style={{ background: dark ? '#1a0f4a' : '#faf9ff', border: `1px solid ${dark ? '#2d1b69' : '#c4b5fd'}`, borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>💡 Key Insight</p>
                <p style={{ fontSize: 13, color: txt1, lineHeight: 1.6 }}>{aiSummary.key_insight}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cross-Platform */}
      {crossPlatform.length > 0 && (
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${divider}` }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: txt1 }}>🔄 Also on Other Platforms</h2>
            <p style={{ fontSize: 12, color: txt2, marginTop: 2 }}>Same market, different platform probabilities</p>
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: dark ? '#1e1b4b' : '#ede9fe', border: `1px solid ${dark ? '#3730a3' : '#c4b5fd'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PLATFORM_COLORS[market.platform] || '#5f5cf0', display: 'inline-block' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: txt1 }}>{pLabel}</span>
                <span style={{ fontSize: 10, color: '#5f5cf0', fontWeight: 600, background: dark ? '#312e81' : '#e0e7ff', padding: '1px 6px', borderRadius: 4 }}>Current</span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: pColor }}>{pct !== null ? `${pct}%` : '—'}</span>
            </div>
            {crossPlatform.map(cp => {
              const cpPct   = cp.probability !== null ? Math.round(cp.probability * 100) : null
              const cpColor = getProbColor(cp.probability)
              const cpLabel = PLATFORM_LABELS[cp.platform] || cp.platform
              return (
                <a key={cp.id} href={affiliateUrl(cp.platform, cp.url)} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: cardBg, border: `1px solid ${border}`, textDecoration: 'none', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#c4b5fd'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = border}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: PLATFORM_COLORS[cp.platform] || '#94a3b8', display: 'inline-block' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: txt1 }}>{cpLabel}</span>
                    {cp.volume_label && <span style={{ fontSize: 11, color: txt2 }}>{cp.volume_label}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: cpColor }}>{cpPct !== null ? `${cpPct}%` : '—'}</span>
                    {pct !== null && cpPct !== null && cpPct !== pct && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: cpPct > pct ? (dark ? '#052e16' : '#ecfdf5') : (dark ? '#1c0202' : '#fef2f2'), color: cpPct > pct ? '#10b981' : '#ef4444' }}>
                        {cpPct > pct ? `+${cpPct - pct}pp` : `${cpPct - pct}pp`}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#5f5cf0' }}>Trade →</span>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* Similar Markets */}
      {similar.length > 0 && (
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: txt1 }}>📊 Similar Markets</h2>
              <p style={{ fontSize: 12, color: txt2, marginTop: 2 }}>More {catLabel} markets to explore</p>
            </div>
            <a href={`/markets?category=${market.category}`} style={{ fontSize: 12, color: '#5f5cf0', textDecoration: 'none', fontWeight: 600 }}>View all →</a>
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {similar.slice(0, 5).map(sm => {
              const smPct   = sm.probability !== null ? Math.round(sm.probability * 100) : null
              const smColor = getProbColor(sm.probability)
              const smLabel = PLATFORM_LABELS[sm.platform] || sm.platform
              return (
                <a key={sm.id} href={`/markets/${sm.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: cardBg, border: `1px solid ${border}`, textDecoration: 'none', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#c4b5fd'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = border}>
                  <span className={`badge-${sm.platform}`} style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', flexShrink: 0 }}>
                    {smLabel}
                  </span>
                  <span style={{ fontSize: 13, color: txt1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sm.question}
                  </span>
                  {sm.volume_label && <span style={{ fontSize: 11, color: txt2, flexShrink: 0 }}>{sm.volume_label}</span>}
                  <span style={{ fontSize: 14, fontWeight: 700, color: smColor, flexShrink: 0 }}>{smPct !== null ? `${smPct}%` : '—'}</span>
                </a>
              )
            })}
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: txt2, textAlign: 'center', lineHeight: 1.6, marginBottom: 16 }}>
        Predacle aggregates public data from prediction market platforms. This is not financial advice.
      </p>
      <div style={{ textAlign: 'center' }}>
        <button onClick={() => router.back()}
          style={{ fontSize: 13, color: '#5f5cf0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
          ← Back to markets
        </button>
      </div>
    </main>
  )
}

export default function MarketDetailClient({ id, initialMarket }: { id: string; initialMarket: Market | null }) {
  return (
    <>
      <Suspense fallback={<div style={{ height: 56, background: '#fff', borderBottom: '1px solid #e8ecf0' }} />}>
        <Header />
      </Suspense>
      <MarketDetail id={id} initialMarket={initialMarket} />
      <Footer />
    </>
  )
}