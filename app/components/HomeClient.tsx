'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MarketCard from './MarketCard'
import MarketCardSkeleton from './MarketCardSkeleton'

interface Market {
  id: string; platform: string; question: string
  probability: number | null; volume: number | null
  volume_label: string | null; end_date: string | null
  end_date_label: string | null; traders: number | null
  category: string | null; url: string; status: string
}

interface Stats {
  categories: { name: string; count: number }[]
  platforms:  { platform: string; market_count: number }[]
  totalMarkets: number
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
  { name: 'sports',    label: 'Sports',    icon: '⚽' },
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
  const router = useRouter()
  const [allMarkets, setAllMarkets] = useState<Market[]>([])
  const [markets, setMarkets]       = useState<Market[]>([])
  const [stats, setStats]           = useState<Stats | null>(null)
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState('')
  const [search, setSearch]         = useState('')

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) router.push(`/markets?q=${encodeURIComponent(search.trim())}`)
  }

  const total = stats?.totalMarkets

  return (
    <div>

      {/* Hero */}
      <section style={{ background: '#fff', borderBottom: '1px solid #e8ecf0', padding: '44px 20px 32px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#ecfdf5', border: '1px solid #a7f3d0',
            borderRadius: 20, padding: '4px 12px', marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>
              Live · {total ? total.toLocaleString() : '16,000+'} active markets
            </span>
          </div>

          <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.8px', lineHeight: 1.2, color: '#0f172a', marginBottom: 12 }}>
            The{' '}
            <span style={{ color: '#5f5cf0' }}>Prediction Market</span>
            <br />Aggregator
          </h1>

          <p style={{ fontSize: 15, color: '#64748b', lineHeight: 1.65, marginBottom: 24, maxWidth: 460, margin: '0 auto 24px' }}>
            Search and compare markets across Polymarket, Kalshi, Myriad, Manifold, Limitless and Azuro — updated every 5 minutes.
          </p>

          <form onSubmit={handleSearch} style={{ marginBottom: 14 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, maxWidth: 520, margin: '0 auto',
              background: '#f8fafc', border: '1.5px solid #e2e8f0',
              borderRadius: 12, padding: '10px 16px',
            }}>
              <svg width="16" height="16" fill="none" stroke="#94a3b8" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="search" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search — Bitcoin, FIFA, Elections, AI..."
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: '#0f172a', fontFamily: 'inherit' }}
                aria-label="Search prediction markets"
              />
              <button type="submit" style={{
                background: '#5f5cf0', color: '#fff', border: 'none', borderRadius: 8,
                padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>
                Search
              </button>
            </div>
          </form>

          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Bitcoin', 'FIFA World Cup', 'US Elections', 'AI predictions'].map(tag => (
              <button key={tag}
                onClick={() => router.push(`/markets?q=${encodeURIComponent(tag)}`)}
                style={{
                  fontSize: 12, color: '#64748b', background: '#f1f5f9',
                  border: '1px solid #e2e8f0', padding: '4px 10px',
                  borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8ecf0', padding: '10px 20px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 0 }}>
          {[
            { num: total ? total.toLocaleString() : '16,000+', lbl: 'Active markets' },
            { num: '6',     lbl: 'Platforms' },
            { num: '$21M+', lbl: 'Top market volume' },
            { num: '5 min', lbl: 'Data refresh' },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 24px',
              borderRight: i < 3 ? '1px solid #e8ecf0' : 'none',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{s.num}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <main id="main" style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 20px 48px' }}>

        {/* Trending markets */}
        <section aria-labelledby="trending-heading" style={{ marginBottom: 44 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 id="trending-heading" style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Trending markets</h2>
            <a href="/markets" style={{ fontSize: 13, fontWeight: 500, color: '#5f5cf0', textDecoration: 'none' }}>View all →</a>
          </div>

          {/* Platform tabs */}
          <div className="scroll-x" style={{ display: 'flex', gap: 6, marginBottom: 20, paddingBottom: 4 }}>
            {TABS.map(tab => {
              const on = activeTab === tab.value
              return (
                <button key={tab.value} onClick={() => handleTab(tab.value)}
                  style={{
                    padding: '5px 14px', fontSize: 13, fontWeight: on ? 600 : 500,
                    borderRadius: 20, border: `1px solid ${on ? '#5f5cf0' : '#e8ecf0'}`,
                    background: on ? '#5f5cf0' : '#fff', color: on ? '#fff' : '#64748b',
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
              ? <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: 14 }}>
                  No markets available for this platform right now
                </p>
              : markets.slice(0, 9).map(m => (
                  <MarketCard key={m.id} market={m} onClick={() => router.push(`/markets/${m.id}`)} />
                ))
            }
          </div>
        </section>

        {/* Category section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#e8ecf0' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Browse by category</span>
          <div style={{ flex: 1, height: 1, background: '#e8ecf0' }} />
        </div>

        <section aria-labelledby="cat-heading" style={{ marginBottom: 44 }}>
          <h2 id="cat-heading" className="sr-only">Browse by category</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {CATEGORIES.map(cat => {
              const count = stats?.categories.find(c => c.name === cat.name)?.count
              return (
                <a key={cat.name} href={`/markets?category=${cat.name}`}
                  style={{
                    background: '#fff', border: '1px solid #e8ecf0', borderRadius: 10,
                    padding: '16px 12px', textDecoration: 'none', display: 'flex',
                    flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4b5fd'; e.currentTarget.style.background = '#faf9ff' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8ecf0'; e.currentTarget.style.background = '#fff' }}>
                  <span style={{ fontSize: 26 }}>{cat.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{cat.label}</span>
                  {count !== undefined && <span style={{ fontSize: 11, color: '#94a3b8' }}>{count.toLocaleString()}</span>}
                </a>
              )
            })}
          </div>
        </section>

        {/* Platform section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#e8ecf0' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Supported platforms</span>
          <div style={{ flex: 1, height: 1, background: '#e8ecf0' }} />
        </div>

        <section aria-labelledby="plat-heading">
          <h2 id="plat-heading" className="sr-only">Supported platforms</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {Object.entries(PLATFORM_COLORS).map(([platform, color]) => {
              const count = stats?.platforms.find(p => p.platform === platform)?.market_count
              const label = platform.charAt(0).toUpperCase() + platform.slice(1)
              return (
                <a key={platform} href={`/markets?platform=${platform}`}
                  style={{
                    background: '#fff', border: '1px solid #e8ecf0', borderRadius: 10,
                    padding: '12px 14px', textDecoration: 'none', display: 'flex',
                    alignItems: 'center', gap: 10, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4b5fd' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8ecf0' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{label}</div>
                    {count !== undefined && <div style={{ fontSize: 11, color: '#94a3b8' }}>{count.toLocaleString()} markets</div>}
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