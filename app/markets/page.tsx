'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import MarketCard from '../components/MarketCard'
import MarketCardSkeleton from '../components/MarketCardSkeleton'

interface Market {
  id: string; platform: string; question: string
  probability: number | null; volume: number | null
  volume_label: string | null; end_date: string | null
  end_date_label: string | null; traders: number | null
  category: string | null; url: string; status: string
  created_at?: string; probability_change?: number | null
  image_url?: string | null
}

interface SiteStats {
  totalMarkets: number
  minutesAgo: number
  platforms: number
}

const CATEGORIES = [
  { label: 'All',           value: '' },
  { label: '₿ Crypto',      value: 'crypto' },
  { label: '🏆 Sports',     value: 'sports' },
  { label: '🗳️ Politics',   value: 'politics' },
  { label: '📈 Economics',  value: 'economics' },
  { label: '💻 Tech',       value: 'tech' },
  { label: '🔬 Science',    value: 'science' },
  { label: '🎬 Entertainment', value: 'entertainment' },
]

const PLATFORMS = [
  { label: 'All Platforms', value: '' },
  { label: 'Polymarket',    value: 'polymarket' },
  { label: 'Kalshi',        value: 'kalshi' },
  { label: 'Myriad',        value: 'myriad' },
  { label: 'Manifold',      value: 'manifold' },
  { label: 'Limitless',     value: 'limitless' },
  { label: 'Azuro',         value: 'azuro' },
]

const SORTS = [
  { label: 'Latest',        value: '' },
  { label: 'Volume',        value: 'volume' },
  { label: 'Probability',   value: 'probability' },
  { label: 'Closing Soon',  value: 'end_date' },
  { label: 'Newest',        value: 'newest' },
]

const QUICK_FILTERS = [
  { label: '🔥 Hot',          sort: 'volume',      min_prob: '',    tip: 'Highest trading volume' },
  { label: '⏰ Closing Soon', sort: 'end_date',    min_prob: '',    tip: 'Resolving within 7 days' },
  { label: '🆕 New',          sort: 'newest',      min_prob: '',    tip: 'Added in last 3 days' },
  { label: '🎯 Near Certain', sort: 'probability', min_prob: '0.8', tip: 'Probability above 80%' },
]

const LIMIT = 20

// ── Stats Bar ────────────────────────────────────────────────────
function StatsBar() {
  const [stats, setStats] = useState<SiteStats | null>(null)

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setStats({
        totalMarkets: d.overall?.totalMarkets || 0,
        minutesAgo:   d.overall?.minutesAgo   || 0,
        platforms:    d.platforms?.length     || 6,
      }))
      .catch(() => {})
  }, [])

  if (!stats) return null

  return (
    <div style={{
      background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
      padding: '7px 20px',
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12, color: '#64748b', flexWrap: 'wrap',
      }}>
        <span>📊</span>
        <strong style={{ color: '#0f172a' }}>
          {stats.totalMarkets.toLocaleString()}
        </strong>
        <span>active markets</span>
        <span style={{ color: '#e2e8f0' }}>·</span>
        <strong style={{ color: '#0f172a' }}>{stats.platforms}</strong>
        <span>platforms</span>
        <span style={{ color: '#e2e8f0' }}>·</span>
        <span>updated</span>
        <strong style={{ color: '#0f172a' }}>{stats.minutesAgo}m ago</strong>
        <span style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center',
          gap: 4, color: '#10b981', fontWeight: 600,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#10b981', display: 'inline-block',
            animation: 'pulse 2s infinite',
          }} />
          All platforms live
        </span>
      </div>
    </div>
  )
}

// ── Main markets page ────────────────────────────────────────────
function MarketsContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [markets,     setMarkets]     = useState<Market[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search,      setSearch]      = useState(searchParams?.get('q') || '')

  const category = searchParams?.get('category') || ''
  const platform = searchParams?.get('platform') || ''
  const sort     = searchParams?.get('sort')     || ''
  const q        = searchParams?.get('q')        || ''
  const min_prob = searchParams?.get('min_prob') || ''

  const buildUrl = useCallback((params: Record<string, string>) => {
    const p = new URLSearchParams()
    if (params.category) p.set('category', params.category)
    if (params.platform) p.set('platform', params.platform)
    if (params.sort)     p.set('sort',     params.sort)
    if (params.q)        p.set('q',        params.q)
    if (params.min_prob) p.set('min_prob', params.min_prob)
    const qs = p.toString()
    return `/markets${qs ? `?${qs}` : ''}`
  }, [])

  const fetchMarkets = useCallback(async (pageNum: number, append = false) => {
    if (!append) setLoading(true)
    else         setLoadingMore(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(LIMIT))
      params.set('page',  String(pageNum))
      if (category) params.set('category', category)
      if (platform) params.set('platform', platform)
      if (sort)     params.set('sort',     sort)
      if (q)        params.set('q',        q)
      if (min_prob) params.set('min_prob', min_prob)

      const res  = await fetch(`/api/markets?${params}`)
      const data = await res.json()

      if (append) setMarkets(prev => [...prev, ...(data.markets || [])])
      else        setMarkets(data.markets || [])
      setTotal(data.total || 0)
    } catch (e) { console.error(e) }
    finally { setLoading(false); setLoadingMore(false) }
  }, [category, platform, sort, q, min_prob])

  useEffect(() => {
    setPage(1)
    fetchMarkets(1, false)
  }, [fetchMarkets])

  const handleLoadMore = () => {
    const next = page + 1
    setPage(next)
    fetchMarkets(next, true)
  }

  const setParam = (key: string, val: string) =>
    router.push(buildUrl({ category, platform, sort, q, min_prob, [key]: val }))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(buildUrl({ category, platform, sort, q: search, min_prob }))
  }

  // Quick filter: detect active state
  const activeQuickFilter = QUICK_FILTERS.findIndex(
    f => f.sort === sort && f.min_prob === min_prob
  )

  const handleQuickFilter = (idx: number) => {
    if (activeQuickFilter === idx) {
      // Deactivate — go back to default
      router.push(buildUrl({ category, platform, q, sort: '', min_prob: '' }))
    } else {
      const f = QUICK_FILTERS[idx]
      router.push(buildUrl({ category, platform, q, sort: f.sort, min_prob: f.min_prob }))
    }
  }

  const hasMore = markets.length < total

  const selStyle: React.CSSProperties = {
    padding: '7px 12px', fontSize: 13, border: '1px solid #e8ecf0',
    borderRadius: 8, background: '#fff', color: '#0f172a',
    cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
  }

  // Page title
  const pageTitle =
    category ? `${category.charAt(0).toUpperCase() + category.slice(1)} Markets`
    : platform ? `${platform.charAt(0).toUpperCase() + platform.slice(1)} Markets`
    : q       ? `Results for "${q}"`
    : activeQuickFilter >= 0 ? QUICK_FILTERS[activeQuickFilter].label + ' Markets'
    : 'All Markets'

  return (
    <div>
      {/* Stats bar */}
      <StatsBar />

      {/* Page header */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e8ecf0',
        padding: '20px 20px 0',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>

          {/* Title + controls */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16, flexWrap: 'wrap', gap: 12,
          }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>
                {pageTitle}
              </h1>
              <p style={{ fontSize: 13, color: '#94a3b8' }}>
                {loading ? 'Loading...' : `${total.toLocaleString()} markets found`}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Search */}
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#f5f7fa', border: '1px solid #e8ecf0',
                  borderRadius: '8px 0 0 8px', padding: '7px 12px',
                }}>
                  <svg width="14" height="14" fill="none" stroke="#94a3b8" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    type="search" value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search markets..."
                    style={{
                      background: 'none', border: 'none', outline: 'none',
                      fontSize: 13, color: '#0f172a', fontFamily: 'inherit', width: 160,
                    }}
                    aria-label="Search markets"
                  />
                </div>
                <button type="submit" style={{
                  padding: '7px 14px', background: '#5f5cf0', color: '#fff',
                  border: 'none', borderRadius: '0 8px 8px 0', fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Go
                </button>
              </form>

              {/* Platform filter */}
              <select
                value={platform}
                onChange={e => setParam('platform', e.target.value)}
                style={selStyle}
                aria-label="Filter by platform"
              >
                {PLATFORMS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>

              {/* Sort */}
              <select
                value={sort}
                onChange={e => {
                  router.push(buildUrl({
                    category, platform, q,
                    sort: e.target.value,
                    min_prob: '',
                  }))
                }}
                style={selStyle}
                aria-label="Sort markets"
              >
                {SORTS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category tabs */}
          <div className="scroll-x" style={{ display: 'flex', gap: 2, marginBottom: 0 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setParam('category', cat.value)}
                style={{
                  background: 'transparent',
                  color: category === cat.value ? '#5f5cf0' : '#64748b',
                  border: 'none',
                  borderBottom: category === cat.value
                    ? '2px solid #5f5cf0'
                    : '2px solid transparent',
                  padding: '8px 14px 10px',
                  fontSize: 13,
                  fontWeight: category === cat.value ? 600 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                }}
                aria-current={category === cat.value ? 'page' : undefined}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick filter pills */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #f1f5f9',
        padding: '10px 20px',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
            Quick filters:
          </span>
          {QUICK_FILTERS.map((f, i) => {
            const isActive = activeQuickFilter === i
            return (
              <button
                key={f.sort + f.min_prob}
                onClick={() => handleQuickFilter(i)}
                title={f.tip}
                style={{
                  padding: '5px 12px', fontSize: 12, fontWeight: 600,
                  borderRadius: 20, border: `1px solid ${isActive ? '#5f5cf0' : '#e8ecf0'}`,
                  background: isActive ? '#5f5cf0' : '#fff',
                  color: isActive ? '#fff' : '#64748b',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                  boxShadow: isActive ? '0 2px 8px rgba(95,92,240,0.25)' : 'none',
                }}
              >
                {f.label}
              </button>
            )
          })}

          {/* Clear all filters */}
          {(category || platform || q || sort || min_prob) && (
            <button
              onClick={() => {
                setSearch('')
                router.push('/markets')
              }}
              style={{
                padding: '5px 12px', fontSize: 12, fontWeight: 500,
                borderRadius: 20, border: '1px solid #e8ecf0',
                background: 'transparent', color: '#94a3b8',
                cursor: 'pointer', marginLeft: 'auto',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              ✕ Clear all
            </button>
          )}
        </div>
      </div>

      {/* Markets grid */}
      <main id="main" style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px 48px' }}>

        {/* Active filter chips */}
        {(category || platform || q) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {category && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                background: '#ede9fe', color: '#5f5cf0',
                padding: '3px 10px', borderRadius: 20, fontWeight: 500,
              }}>
                {category}
                <button
                  onClick={() => setParam('category', '')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f5cf0', fontSize: 14, lineHeight: 1, padding: 0 }}
                >×</button>
              </span>
            )}
            {platform && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                background: '#ede9fe', color: '#5f5cf0',
                padding: '3px 10px', borderRadius: 20, fontWeight: 500,
              }}>
                {platform}
                <button
                  onClick={() => setParam('platform', '')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f5cf0', fontSize: 14, lineHeight: 1, padding: 0 }}
                >×</button>
              </span>
            )}
            {q && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                background: '#ede9fe', color: '#5f5cf0',
                padding: '3px 10px', borderRadius: 20, fontWeight: 500,
              }}>
                &ldquo;{q}&rdquo;
                <button
                  onClick={() => { setSearch(''); setParam('q', '') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5f5cf0', fontSize: 14, lineHeight: 1, padding: 0 }}
                >×</button>
              </span>
            )}
          </div>
        )}

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12, marginBottom: 32,
        }}>
          {loading
            ? Array.from({ length: 9 }).map((_, i) => <MarketCardSkeleton key={i} />)
            : markets.length === 0
            ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
                <p style={{ fontSize: 16, color: '#94a3b8', marginBottom: 8 }}>No markets found</p>
                <p style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 20 }}>
                  Try a different search term or filter
                </p>
                <button
                  onClick={() => router.push('/markets')}
                  style={{
                    padding: '8px 20px', background: '#5f5cf0', color: '#fff',
                    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Clear all filters
                </button>
              </div>
            )
            : markets.map(m => (
              <MarketCard
                key={m.id}
                market={m}
                onClick={() => router.push(`/markets/${m.id}`)}
              />
            ))
          }

          {loadingMore && Array.from({ length: 3 }).map((_, i) => (
            <MarketCardSkeleton key={`more-${i}`} />
          ))}
        </div>

        {/* Load more */}
        {!loading && hasMore && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
              Showing {markets.length.toLocaleString()} of {total.toLocaleString()} markets
            </p>
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                padding: '10px 32px', fontSize: 14, fontWeight: 600,
                border: '1px solid #e8ecf0', borderRadius: 10,
                background: loadingMore ? '#f5f7fa' : '#fff',
                color: loadingMore ? '#94a3b8' : '#0f172a',
                cursor: loadingMore ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              {loadingMore ? 'Loading...' : 'Load 20 more'}
            </button>
          </div>
        )}

        {!loading && !hasMore && markets.length > 0 && (
          <p style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
            All {total.toLocaleString()} markets loaded
          </p>
        )}

      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export default function MarketsPage() {
  return (
    <>
      <Suspense fallback={
        <div style={{ height: 56, background: '#fff', borderBottom: '1px solid #e8ecf0' }} />
      }>
        <Header />
      </Suspense>
      <Suspense fallback={
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <MarketCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }>
        <MarketsContent />
      </Suspense>
      <Footer />
    </>
  )
}