'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import MarketCard from './MarketCard'
import MarketCardSkeleton from './MarketCardSkeleton'
import SearchAutocomplete from './SearchAutocomplete'
import MarketBrief from './MarketBrief'
import MoversFeed from './MoversFeed'

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
  { label: 'Bookmaker',  value: 'azuro' },
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
  polymarket: '#4f46e5', kalshi: '#00b16a', myriad: '#7e22ce',
  manifold: '#cf202f', limitless: '#d97706', azuro: '#0891b2',
}

const PLATFORM_DISPLAY: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  manifold: 'Manifold', limitless: 'Limitless', azuro: 'Bookmaker',
}

const BRAND = '#0052ff'

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

  // ── Theme palette (Coinbase-style) ──
  const bg      = dark ? '#0a0b0d' : '#ffffff'
  const bg2     = dark ? '#0d0e10' : '#f5f6f8'
  const border  = dark ? '#26282d' : '#eaecef'
  const txt1    = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2    = dark ? '#8a919e' : '#5b616e'
  const txt3    = dark ? '#5b616e' : '#8a919e'
  const cardBg  = dark ? '#16171a' : '#ffffff'

  // Top markets for the hero panel (always rendered on a dark surface, Coinbase-style).
  const panelMarkets = allMarkets.slice(0, 5)

  return (
    <div style={{ background: bg }}>
      <style>{`
        .hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 48px; align-items: center; }
        .hero-cta-row { display: flex; gap: 10px; flex-wrap: wrap; }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr; gap: 32px; }
          .hero-panel { order: 2; }
          .hero-headline { font-size: 44px !important; }
        }
        @media (max-width: 560px) {
          .hero-headline { font-size: 36px !important; }
        }
      `}</style>

      {/* ───────── Hero ───────── */}
      <section style={{ background: bg, borderBottom: `1px solid ${border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 20px 56px' }}>
          <div className="hero-grid">

            {/* Left — copy + search + CTAs */}
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: dark ? '#04291b' : '#e7f8f0',
                border: `1px solid ${dark ? '#0a5235' : '#bfeed8'}`,
                borderRadius: 100, padding: '5px 13px', marginBottom: 22,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#05a66b', display: 'inline-block' }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: dark ? '#2bd97c' : '#04794e' }}>
                  Live · {total ? total.toLocaleString() : '16,000+'} active markets
                </span>
              </div>

              <h1 className="font-display hero-headline" style={{
                fontSize: 56, fontWeight: 800, lineHeight: 1.04,
                color: txt1, marginBottom: 20, letterSpacing: '-0.03em',
              }}>
                Every prediction<br />market, one place.
              </h1>

              <p style={{
                fontSize: 18, color: txt2, lineHeight: 1.55,
                marginBottom: 28, maxWidth: 480,
              }}>
                Search and compare live odds across Polymarket, Kalshi, Myriad,
                Manifold, Limitless and Bookmaker — refreshed every 30 minutes.
              </p>

              <div style={{ maxWidth: 520, marginBottom: 16 }}>
                <SearchAutocomplete
                  placeholder="Search — Bitcoin, FIFA, Elections, AI…"
                  size="large"
                />
              </div>

              <div className="hero-cta-row" style={{ marginBottom: 22 }}>
                <button
                  onClick={() => router.push('/markets')}
                  style={{
                    padding: '13px 26px', fontSize: 15, fontWeight: 600,
                    background: BRAND, color: '#fff', border: 'none',
                    borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0043ce' }}
                  onMouseLeave={e => { e.currentTarget.style.background = BRAND }}>
                  Browse markets
                </button>
                <button
                  onClick={() => router.push('/how-it-works')}
                  style={{
                    padding: '13px 24px', fontSize: 15, fontWeight: 600,
                    background: 'transparent', color: txt1,
                    border: `1px solid ${dark ? '#33363d' : '#dfe1e6'}`,
                    borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = dark ? '#4a4e57' : '#0a0b0d' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = dark ? '#33363d' : '#dfe1e6' }}>
                  How it works
                </button>
              </div>

              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {[
                  { label: 'Bitcoin',        query: 'Bitcoin' },
                  { label: 'FIFA World Cup', query: 'FIFA' },
                  { label: 'US Elections',   query: 'election' },
                  { label: 'AI',             query: 'OpenAI' },
                ].map(tag => (
                  <button key={tag.label}
                    onClick={() => router.push(`/markets?q=${encodeURIComponent(tag.query)}`)}
                    style={{
                      fontSize: 12.5, color: txt2, fontWeight: 500,
                      background: dark ? '#16171a' : '#f5f6f8',
                      border: `1px solid ${border}`,
                      padding: '6px 13px', borderRadius: 100,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right — dark live-markets panel (Coinbase price-list style) */}
            <div className="hero-panel">
              <div style={{
                background: '#0a0b0d',
                borderRadius: 24,
                padding: '22px 22px 14px',
                boxShadow: '0 24px 60px rgba(10,11,13,0.22)',
                border: '1px solid #1c1e22',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Trending now</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#2bd97c',
                    background: '#0c2b1c', borderRadius: 100, padding: '4px 10px',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2bd97c' }} />
                    Live
                  </span>
                </div>

                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? '1px solid #16181c' : 'none' }}>
                      <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
                      <div className="skeleton" style={{ height: 12, flex: 1, borderRadius: 4 }} />
                      <div className="skeleton" style={{ width: 44, height: 14, borderRadius: 4 }} />
                    </div>
                  ))
                ) : (
                  panelMarkets.map((m, i) => {
                    const pct = m.probability !== null ? Math.round(m.probability * 100) : null
                    const chg = m.probability_change ?? null
                    const up  = chg !== null && chg > 0
                    const chgPct = chg !== null ? Math.round(Math.abs(chg) * 100) : null
                    return (
                      <Link key={m.id} href={`/markets/${m.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '13px 8px', margin: '0 -8px', borderRadius: 12,
                          textDecoration: 'none', borderTop: i ? '1px solid #16181c' : 'none',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#141518' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <span style={{
                          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                          background: PLATFORM_COLORS[m.platform] || '#3b3f47',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 13, fontWeight: 700,
                        }}>
                          {(PLATFORM_DISPLAY[m.platform] || m.platform).charAt(0)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13.5, fontWeight: 600, color: '#fff',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {m.question}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#7a818c', marginTop: 2 }}>
                            {PLATFORM_DISPLAY[m.platform] || m.platform}
                            {m.volume_label ? ` · ${m.volume_label}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>
                            {pct !== null ? `${pct}%` : '—'}
                          </div>
                          {chgPct !== null && chgPct > 0 && (
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: up ? '#2bd97c' : '#ff6b6b', marginTop: 1 }}>
                              {up ? '↗' : '↘'} {chgPct}%
                            </div>
                          )}
                        </div>
                      </Link>
                    )
                  })
                )}

                <Link href="/markets" style={{
                  display: 'block', textAlign: 'center', marginTop: 12,
                  padding: '11px', fontSize: 13.5, fontWeight: 600,
                  color: '#fff', background: '#16181c', borderRadius: 12,
                  textDecoration: 'none',
                }}>
                  See all markets →
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ───────── Stats strip ───────── */}
      <div style={{ background: bg2, borderBottom: `1px solid ${border}` }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '18px 20px',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8,
        }}>
          {[
            { num: total ? total.toLocaleString() : '16,000+', lbl: 'Active markets' },
            { num: '6',      lbl: 'Platforms aggregated' },
            { num: '$140M+', lbl: 'Top market volume' },
            { num: '30 min', lbl: 'Data refresh' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '4px 8px' }}>
              <div className="font-display" style={{ fontSize: 22, fontWeight: 800, color: txt1, letterSpacing: '-0.02em' }}>{s.num}</div>
              <div style={{ fontSize: 12.5, color: txt2, marginTop: 2 }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ───────── Main ───────── */}
      <main id="main" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px 56px' }}>

        <MoversFeed />

        <MarketBrief />

        {/* Trending markets */}
        <section style={{ marginBottom: 52 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <h2 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: txt1, letterSpacing: '-0.02em' }}>Trending markets</h2>
              <p style={{ fontSize: 14, color: txt2, marginTop: 4 }}>The most active markets across every platform, right now.</p>
            </div>
            <Link href="/markets" style={{ fontSize: 14, fontWeight: 600, color: BRAND, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              View all →
            </Link>
          </div>

          <div className="scroll-x" style={{ display: 'flex', gap: 8, marginBottom: 22, paddingBottom: 4 }}>
            {TABS.map(tab => {
              const on = activeTab === tab.value
              return (
                <button key={tab.value} onClick={() => handleTab(tab.value)}
                  style={{
                    padding: '7px 16px', fontSize: 13.5, fontWeight: on ? 600 : 500,
                    borderRadius: 100, border: `1px solid ${on ? BRAND : border}`,
                    background: on ? BRAND : cardBg,
                    color: on ? '#fff' : txt2,
                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}>
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <MarketCardSkeleton key={i} />)
              : markets.length === 0
              ? <p style={{ gridColumn: '1/-1', textAlign: 'center', color: txt3, padding: '48px 0', fontSize: 14 }}>
                  No markets available for this platform right now
                </p>
              : markets.slice(0, 9).map(m => (
                <MarketCard key={m.id} market={m} onClick={() => router.push(`/markets/${m.id}`)} />
              ))
            }
          </div>
        </section>

        {/* Browse by category */}
        <section style={{ marginBottom: 52 }}>
          <h2 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: txt1, marginBottom: 18, letterSpacing: '-0.02em' }}>Browse by category</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {CATEGORIES.map(cat => {
              const count = stats?.categories.find(c => c.name === cat.name)?.count
              return (
                <Link key={cat.name} href={`/markets?category=${cat.name}`}
                  style={{
                    background: cardBg, border: `1px solid ${border}`,
                    borderRadius: 16, padding: '20px 16px', textDecoration: 'none',
                    display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = 'translateY(0)' }}>
                  <span style={{ fontSize: 28 }}>{cat.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: txt1 }}>{cat.label}</span>
                  {count !== undefined && <span style={{ fontSize: 12.5, color: txt3 }}>{count.toLocaleString()} markets</span>}
                </Link>
              )
            })}
          </div>
        </section>

        {/* Supported platforms */}
        <section>
          <h2 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: txt1, marginBottom: 18, letterSpacing: '-0.02em' }}>Supported platforms</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {Object.entries(PLATFORM_COLORS).map(([platform, color]) => {
              const count = stats?.platforms.find(p => p.platform === platform)?.market_count
              const label = PLATFORM_DISPLAY[platform] || platform
              return (
                <Link key={platform} href={`/markets?platform=${platform}`}
                  style={{
                    background: cardBg, border: `1px solid ${border}`,
                    borderRadius: 16, padding: '16px 18px', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = border }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 10, background: color, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 15, fontWeight: 700,
                  }}>{label.charAt(0)}</span>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: txt1 }}>{label}</div>
                    {count !== undefined && <div style={{ fontSize: 12, color: txt3 }}>{count.toLocaleString()} markets</div>}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

      </main>
    </div>
  )
}
