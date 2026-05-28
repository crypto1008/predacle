'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MarketCard from './MarketCard'
import MarketCardSkeleton from './MarketCardSkeleton'
import SearchAutocomplete from './SearchAutocomplete'

interface Market {
  id: string; platform: string; question: string
  probability: number | null; volume: number | null
  volume_label: string | null; end_date: string | null
  end_date_label: string | null; traders: number | null
  category: string | null; url: string; status: string
  created_at?: string
  probability_change?: number | null
  image_url?: string | null
}

interface Stats {
  categories: { name: string; count: number }[]
  platforms:  { platform: string; market_count: number }[]
  totalMarkets: number
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

const TABS = [
  { label: 'All',        value: '' },
  { label: 'Polymarket', value: 'polymarket' },
  { label: 'Kalshi',     value: 'kalshi' },
  { label: 'Myriad',     value: 'myriad' },
  { label: 'Manifold',   value: 'manifold' },
  { label: 'Limitless',  value: 'limitless' },
  { label: 'Azuro',      value: 'azuro' },
]

const CATEGORIES = [
  { name: 'sports',    label: 'Sports',    icon: '🏆' },
  { name: 'crypto',    label: 'Crypto',    icon: '₿'  },
  { name: 'politics',  label: 'Politics',  icon: '🗳️' },
  { name: 'economics', label: 'Economics', icon: '📈' },
  { name: 'tech',      label: 'Tech',      icon: '💻' },
  { name: 'science',   label: 'Science',   icon: '🔬' },
]

const PLATFORM_COLORS: Record<string, string> = {
  polymarket: '#6d28d9', kalshi: '#059669', myriad: '#7e22ce',
  manifold: '#dc2626', limitless: '#d97706', azuro: '#0891b2',
}

export default function HomeClient() {
  const router   = useRouter()
  const dark     = useDark()
  const [allMarkets, setAllMarkets] = useState<Market[]>([])
  const [markets,    setMarkets]    = useState<Market[]>([])
  const [stats,      setStats]      = useState<Stats | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [activeTab,  setActiveTab]  = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [mr, sr] = await Promise.all([
          fetch('/api/markets/top'),
          fetch('/api/categories'),
        ])
        if (mr.ok) { const d = await mr.json(); setAllMarkets(d.markets || []); setMarkets(d.markets || []) }
        if (sr.ok) { const d = await sr.json(); setStats(d) }
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const handleTab = (val: string) => {
    setActiveTab(val)
    setMarkets(val ? allMarkets.filter(m => m.platform === val) : allMarkets)
  }

  const total = stats?.totalMarkets

  // Dark palette
  const bg      = dark ? '#0b0d12' : '#ffffff'
  const bg2     = dark ? '#111318' : '#f8fafc'
  const border  = dark ? '#1e2330' : '#e8ecf0'
  const border2 = dark ? '#1e2330' : '#e2e8f0'
  const txt1    = dark ? '#f1f5f9' : '#0f172a'
  const txt2    = dark ? '#94a3b8' : '#64748b'
  const txt3    = dark ? '#475569' : '#94a3b8'
  const cardBg  = dark ? '#111318' : '#ffffff'
  const divClr  = dark ? '#1e2330' : '#e8ecf0'

  return (
    <div style={{ background: bg }}>

      {/* Hero */}
      <section style={{
        background: bg, borderBottom: `1px solid ${border}`,
        padding: '44px 20px 32px',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: dark ? '#052e16' : '#ecfdf5',
            border: `1px solid ${dark ? '#065f46' : '#a7f3d0'}`,
            borderRadius: 20, padding: '4px 12px', marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>
              Live · {total ? total.toLocaleString() : '1,200+'} active markets
            </span>
          </div>

          <h1 style={{
            fontSize: 36, fontWeight: 700, letterSpacing: '-0.8px',
            lineHeight: 1.2, color: txt1, marginBottom: 12,
          }}>
            The{' '}
            <span style={{ color: '#5f5cf0' }}>Prediction Market</span>
            <br />Aggregator
          </h1>

          <p style={{
            fontSize: 15, color: txt2, lineHeight: 1.65,
            marginBottom: 24, maxWidth: 460, margin: '0 auto 24px',
          }}>
            Search and compare markets across Polymarket, Kalshi, Myriad,
            Manifold, Limitless and Azuro — updated every 30 minutes.
          </p>

          {/* Search with autocomplete */}
          <div style={{ maxWidth: 520, margin: '0 auto 14px', display: 'flex' }}>
            <SearchAutocomplete
              placeholder="Search — Bitcoin, FIFA, Elections, AI..."
              size="large"
            />
          </div>

          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Bitcoin', 'FIFA World Cup', 'US Elections', 'AI predictions'].map(tag => (
              <button key={tag}
                onClick={() => router.push(`/markets?q=${encodeURIComponent(tag)}`)}
                style={{
                  fontSize: 12, color: txt2,
                  background: dark ? '#1e2330' : '#f1f5f9',
                  border: `1px solid ${border2}`,
                  padding: '4px 10px', borderRadius: 20,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div style={{ background: bg, borderBottom: `1px solid ${border}`, padding: '10px 20px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 0 }}>
          {[
            { num: total ? total.toLocaleString() : '1,200+', lbl: 'Active markets' },
            { num: '6',      lbl: 'Platforms' },
            { num: '$140M+', lbl: 'Top market volume' },
            { num: '30 min', lbl: 'Data refresh' },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 24px',
              borderRight: i < 3 ? `1px solid ${border}` : 'none',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: txt1 }}>{s.num}</span>
              <span style={{ fontSize: 12, color: txt3 }}>{s.lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <main id="main" style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px 48px' }}>

        {/* Trending markets */}
        <section style={{ marginBottom: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: txt1 }}>Trending markets</h2>
            <a href="/markets" style={{ fontSize: 13, fontWeight: 500, color: '#5f5cf0', textDecoration: 'none' }}>
              View all →
            </a>
          </div>

          {/* Platform tabs */}
          <div className="scroll-x" style={{ display: 'flex', gap: 6, marginBottom: 20, paddingBottom: 4 }}>
            {TABS.map(tab => {
              const on = activeTab === tab.value
              return (
                <button key={tab.value} onClick={() => handleTab(tab.value)}
                  style={{
                    padding: '5px 14px', fontSize: 13, fontWeight: on ? 600 : 500,
                    borderRadius: 20, border: `1px solid ${on ? '#5f5cf0' : border}`,
                    background: on ? '#5f5cf0' : cardBg,
                    color: on ? '#fff' : txt2,
                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}>
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <MarketCardSkeleton key={i} />)
              : markets.length === 0
              ? <p style={{ gridColumn: '1/-1', textAlign: 'center', color: txt3, padding: '40px 0', fontSize: 14 }}>
                  No markets available for this platform right now
                </p>
              : markets.slice(0, 9).map(m => (
                <MarketCard key={m.id} market={m} onClick={() => router.push(`/markets/${m.id}`)} />
              ))
            }
          </div>
        </section>

        {/* Browse by category */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: divClr }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: txt3, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Browse by category
          </span>
          <div style={{ flex: 1, height: 1, background: divClr }} />
        </div>

        <section style={{ marginBottom: 44 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {CATEGORIES.map(cat => {
              const count = stats?.categories.find(c => c.name === cat.name)?.count
              return (
                <a key={cat.name} href={`/markets?category=${cat.name}`}
                  style={{
                    background: cardBg, border: `1px solid ${border}`,
                    borderRadius: 10, padding: '16px 12px', textDecoration: 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 6, textAlign: 'center', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4b5fd'; e.currentTarget.style.background = dark ? '#1a1a2e' : '#faf9ff' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.background = cardBg }}>
                  <span style={{ fontSize: 26 }}>{cat.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: txt1 }}>{cat.label}</span>
                  {count !== undefined && <span style={{ fontSize: 11, color: txt3 }}>{count.toLocaleString()}</span>}
                </a>
              )
            })}
          </div>
        </section>

        {/* Supported platforms */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: divClr }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: txt3, letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Supported platforms
          </span>
          <div style={{ flex: 1, height: 1, background: divClr }} />
        </div>

        <section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {Object.entries(PLATFORM_COLORS).map(([platform, color]) => {
              const count = stats?.platforms.find(p => p.platform === platform)?.market_count
              const label = platform.charAt(0).toUpperCase() + platform.slice(1)
              return (
                <a key={platform} href={`/markets?platform=${platform}`}
                  style={{
                    background: cardBg, border: `1px solid ${border}`,
                    borderRadius: 10, padding: '12px 14px', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4b5fd' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = border }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: txt1 }}>{label}</div>
                    {count !== undefined && <div style={{ fontSize: 11, color: txt3 }}>{count.toLocaleString()} markets</div>}
                  </div>
                </a>
              )
            })}
          </div>
        </section>

      </main>
    </div>
  )
}