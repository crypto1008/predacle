'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import MarketCard from '../components/MarketCard'
import MarketCardSkeleton from '../components/MarketCardSkeleton'
import SearchAutocomplete from '../components/SearchAutocomplete'

interface Market {
  id: string; platform: string; question: string
  probability: number | null; volume: number | null
  volume_label: string | null; end_date: string | null
  end_date_label: string | null; traders: number | null
  category: string | null; url: string; status: string
  created_at?: string; probability_change?: number | null
  image_url?: string | null
}

interface SiteStats { totalMarkets: number; minutesAgo: number; platforms: number }

const CATEGORIES = [
  { label: 'All',              value: '' },
  { label: '₿ Crypto',        value: 'crypto' },
  { label: '🏆 Sports',       value: 'sports' },
  { label: '🗳️ Politics',     value: 'politics' },
  { label: '📈 Economics',    value: 'economics' },
  { label: '💻 Tech',         value: 'tech' },
  { label: '🔬 Science',      value: 'science' },
  { label: '🎬 Entertainment', value: 'entertainment' },
]

const PLATFORMS = [
  { label: 'All Platforms', value: '' },
  { label: 'Polymarket',    value: 'polymarket' },
  { label: 'Kalshi',        value: 'kalshi' },
  { label: 'Myriad',        value: 'myriad' },
  { label: 'Manifold',      value: 'manifold' },
  { label: 'Limitless',     value: 'limitless' },
  { label: 'Bookmaker',         value: 'azuro' },
]

const SORTS = [
  { label: 'Latest',       value: '' },
  { label: 'Volume',       value: 'volume' },
  { label: 'Probability',  value: 'probability' },
  { label: 'Closing Soon', value: 'end_date' },
  { label: 'Newest',       value: 'newest' },
]

const QUICK_FILTERS = [
  { label: '🔥 Hot',          sort: 'volume',      min_prob: '',    max_prob: '',    tip: 'Highest volume' },
  { label: '⏰ Closing Soon', sort: 'end_date',    min_prob: '',    max_prob: '',    tip: 'Resolving soon' },
  { label: '🆕 New',          sort: 'newest',      min_prob: '',    max_prob: '',    tip: 'Added recently' },
  { label: '🎯 Near Certain', sort: 'probability', min_prob: '0.8', max_prob: '0.97', tip: '80–97% — confident, not yet decided' },
  { label: '🎲 Toss-ups',     sort: 'probability', min_prob: '0.4', max_prob: '0.6', tip: '40–60% — genuinely uncertain' },
]

const LIMIT = 20

function useDarkMode() {
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

function StatsBar({ dark }: { dark: boolean }) {
  const [stats, setStats] = useState<SiteStats | null>(null)
  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setStats({ totalMarkets: d.overall?.totalMarkets || 0, minutesAgo: d.overall?.minutesAgo || 0, platforms: d.platforms?.length || 6 }))
      .catch(() => {})
  }, [])
  if (!stats) return null
  const bg     = dark ? '#0b0d12' : '#f8fafc'
  const border = dark ? '#1e2330' : '#f1f5f9'
  const txt    = dark ? '#94a3b8' : '#64748b'
  const strong = dark ? '#f1f5f9' : '#0f172a'
  return (
    <div style={{ background: bg, borderBottom: `1px solid ${border}`, padding: '7px 20px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: txt, flexWrap: 'wrap' }}>
        <span>📊</span>
        <strong style={{ color: strong }}>{stats.totalMarkets.toLocaleString()}</strong>
        <span>markets</span>
        <span style={{ color: dark ? '#2d3748' : '#e2e8f0' }}>·</span>
        <strong style={{ color: strong }}>{stats.platforms}</strong>
        <span>platforms</span>
        <span style={{ color: dark ? '#2d3748' : '#e2e8f0' }}>·</span>
        <span>updated</span>
        <strong style={{ color: strong }}>{stats.minutesAgo}m ago</strong>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: '#10b981', fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          All live
        </span>
      </div>
    </div>
  )
}

function MarketsContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const dark         = useDarkMode()

  const [markets,     setMarkets]     = useState<Market[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const category = searchParams?.get('category') || ''
  const platform = searchParams?.get('platform') || ''
  const sort     = searchParams?.get('sort')     || ''
  const q        = searchParams?.get('q')        || ''
  const min_prob = searchParams?.get('min_prob') || ''
  const max_prob = searchParams?.get('max_prob') || ''

  const buildUrl = useCallback((params: Record<string, string>) => {
    const p = new URLSearchParams()
    if (params.category) p.set('category', params.category)
    if (params.platform) p.set('platform', params.platform)
    if (params.sort)     p.set('sort',     params.sort)
    if (params.q)        p.set('q',        params.q)
    if (params.min_prob) p.set('min_prob', params.min_prob)
    if (params.max_prob) p.set('max_prob', params.max_prob)
    const qs = p.toString()
    return `/markets${qs ? `?${qs}` : ''}`
  }, [])

  const fetchMarkets = useCallback(async (pageNum: number, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(LIMIT))
      params.set('page',  String(pageNum))
      if (category) params.set('category', category)
      if (platform) params.set('platform', platform)
      if (sort)     params.set('sort',     sort)
      if (q)        params.set('q',        q)
      if (min_prob) params.set('min_prob', min_prob)
      if (max_prob) params.set('max_prob', max_prob)
      const res  = await fetch(`/api/markets?${params}`)
      const data = await res.json()
      if (append) setMarkets(prev => [...prev, ...(data.markets || [])])
      else        setMarkets(data.markets || [])
      setTotal(data.total || 0)
    } catch (e) { console.error(e) }
    finally { setLoading(false); setLoadingMore(false) }
  }, [category, platform, sort, q, min_prob, max_prob])

  useEffect(() => { setPage(1); fetchMarkets(1, false) }, [fetchMarkets])

  const handleLoadMore = () => { const next = page + 1; setPage(next); fetchMarkets(next, true) }
  const setParam = (key: string, val: string) =>
    router.push(buildUrl({ category, platform, sort, q, min_prob, max_prob, [key]: val }))

  const activeQuickFilter = QUICK_FILTERS.findIndex(f => f.sort === sort && f.min_prob === min_prob && (f.max_prob || '') === max_prob)
  const handleQuickFilter = (idx: number) => {
    if (activeQuickFilter === idx) router.push(buildUrl({ category, platform, q, sort: '', min_prob: '', max_prob: '' }))
    else { const f = QUICK_FILTERS[idx]; router.push(buildUrl({ category, platform, q, sort: f.sort, min_prob: f.min_prob, max_prob: f.max_prob || '' })) }
  }

  const hasMore = markets.length < total

  const bg      = dark ? '#0b0d12' : '#ffffff'
  const bg2     = dark ? '#111318' : '#f5f7fa'
  const border  = dark ? '#1e2330' : '#e8ecf0'
  const border2 = dark ? '#1e2330' : '#f1f5f9'
  const txt1    = dark ? '#f1f5f9' : '#0f172a'
  const txt2    = dark ? '#94a3b8' : '#64748b'
  const txt3    = dark ? '#475569' : '#94a3b8'

  const selStyle: React.CSSProperties = {
    padding: '7px 12px', fontSize: 13, border: `1px solid ${border}`,
    borderRadius: 8, background: bg, color: txt1,
    cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
  }

  const pageTitle =
    category ? `${category.charAt(0).toUpperCase() + category.slice(1)} Markets`
    : platform ? `${platform.charAt(0).toUpperCase() + platform.slice(1)} Markets`
    : q       ? `Results for "${q}"`
    : activeQuickFilter >= 0 ? QUICK_FILTERS[activeQuickFilter].label + ' Markets'
    : 'All Markets'

  return (
    <div>
      <StatsBar dark={dark} />

      {/* Page header */}
      <div style={{ background: bg, borderBottom: `1px solid ${border}`, padding: '20px 20px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: txt1, marginBottom: 2 }}>{pageTitle}</h1>
              <p style={{ fontSize: 13, color: txt3 }}>
                {loading ? 'Loading...' : `${total.toLocaleString()} markets found`}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search with autocomplete */}
              <div style={{ width: 300 }}>
                <SearchAutocomplete
                  placeholder="Search markets..."
                  initialValue={q}
                  onSearch={(newQ) => router.push(buildUrl({ category, platform, sort, q: newQ, min_prob, max_prob }))}
                />
              </div>

              <select value={platform} onChange={e => setParam('platform', e.target.value)} style={selStyle}>
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>

              <select value={sort}
                onChange={e => router.push(buildUrl({ category, platform, q, sort: e.target.value, min_prob: '', max_prob: '' }))}
                style={selStyle}>
                {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Category tabs */}
          <div className="scroll-x" style={{ display: 'flex', gap: 2 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.value} onClick={() => setParam('category', cat.value)}
                style={{
                  background: 'transparent',
                  color: category === cat.value ? '#5f5cf0' : txt2,
                  border: 'none',
                  borderBottom: category === cat.value ? '2px solid #5f5cf0' : '2px solid transparent',
                  padding: '8px 14px 10px', fontSize: 13,
                  fontWeight: category === cat.value ? 600 : 500,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick filter pills */}
      <div style={{ background: bg, borderBottom: `1px solid ${border2}`, padding: '10px 20px' }}>
        <div className="scroll-x" style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: txt3, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase', flexShrink: 0 }}>
            Quick:
          </span>
          {QUICK_FILTERS.map((f, i) => {
            const isActive = activeQuickFilter === i
            return (
              <button key={f.sort + f.min_prob} onClick={() => handleQuickFilter(i)} title={f.tip}
                style={{
                  padding: '5px 12px', fontSize: 12, fontWeight: 600,
                  borderRadius: 20, border: `1px solid ${isActive ? '#5f5cf0' : border}`,
                  background: isActive ? '#5f5cf0' : bg,
                  color: isActive ? '#fff' : txt2,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'all 0.15s', fontFamily: 'inherit',
                  boxShadow: isActive ? '0 2px 8px rgba(95,92,240,0.25)' : 'none',
                }}>
                {f.label}
              </button>
            )
          })}
          {(category || platform || q || sort || min_prob || max_prob) && (
            <button onClick={() => router.push('/markets')}
              style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, borderRadius: 20, border: `1px solid ${border}`, background: 'transparent', color: txt3, cursor: 'pointer', marginLeft: 'auto', flexShrink: 0, fontFamily: 'inherit' }}>
              × Clear
            </button>
          )}
        </div>
      </div>

      {/* Markets grid */}
      <main id="main" style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px 48px', background: dark ? '#0b0d12' : 'transparent', minHeight: '60vh' }}>

        {/* Active chips */}
        {(category || platform || q) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {category && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, background: dark ? '#1e1b4b' : '#ede9fe', color: '#5f5cf0', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                {category}
                <button onClick={() => setParam('category', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f5cf0', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            )}
            {platform && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, background: dark ? '#1e1b4b' : '#ede9fe', color: '#5f5cf0', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                {platform}
                <button onClick={() => setParam('platform', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f5cf0', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            )}
            {q && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, background: dark ? '#1e1b4b' : '#ede9fe', color: '#5f5cf0', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>
                "{q}"
                <button onClick={() => router.push(buildUrl({ category, platform, sort, q: '', min_prob, max_prob }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f5cf0', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            )}
          </div>
        )}

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 32 }}>
          {loading
            ? Array.from({ length: 9 }).map((_, i) => <MarketCardSkeleton key={i} />)
            : markets.length === 0
            ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
                <p style={{ fontSize: 16, color: txt3, marginBottom: 8 }}>No markets found</p>
                <p style={{ fontSize: 13, color: txt3, marginBottom: 20 }}>Try a different search term or filter</p>
                <button onClick={() => router.push('/markets')}
                  style={{ padding: '8px 20px', background: '#5f5cf0', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Clear all filters
                </button>
              </div>
            )
            : markets.map(m => <MarketCard key={m.id} market={m} onClick={() => router.push(`/markets/${m.id}`)} />)
          }
          {loadingMore && Array.from({ length: 3 }).map((_, i) => <MarketCardSkeleton key={`more-${i}`} />)}
        </div>

        {!loading && hasMore && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: txt3, marginBottom: 12 }}>
              Showing {markets.length.toLocaleString()} of {total.toLocaleString()} markets
            </p>
            <button onClick={handleLoadMore} disabled={loadingMore}
              style={{ padding: '10px 32px', fontSize: 14, fontWeight: 600, border: `1px solid ${border}`, borderRadius: 10, background: loadingMore ? bg2 : bg, color: loadingMore ? txt3 : txt1, cursor: loadingMore ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {loadingMore ? 'Loading...' : 'Load 20 more'}
            </button>
          </div>
        )}

        {!loading && !hasMore && markets.length > 0 && (
          <p style={{ textAlign: 'center', fontSize: 13, color: txt3 }}>
            All {total.toLocaleString()} markets loaded
          </p>
        )}
      </main>
    </div>
  )
}

export default function MarketsPage() {
  return (
    <>
      <Suspense fallback={<div style={{ height: 56, background: '#fff', borderBottom: '1px solid #e8ecf0' }} />}>
        <Header />
      </Suspense>
      <Suspense fallback={
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {Array.from({ length: 9 }).map((_, i) => <MarketCardSkeleton key={i} />)}
          </div>
        </div>
      }>
        <MarketsContent />
      </Suspense>
      <Footer />
    </>
  )
}
