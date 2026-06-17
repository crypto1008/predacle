'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import SearchAutocomplete from './SearchAutocomplete'

const CATEGORIES = [
  { label: 'All',       value: '' },
  { label: 'Crypto',    value: 'crypto' },
  { label: 'Sports',    value: 'sports' },
  { label: 'Politics',  value: 'politics' },
  { label: 'Economics', value: 'economics' },
  { label: 'Tech',      value: 'tech' },
  { label: 'Science',   value: 'science' },
]

export default function Header() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const pathname     = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark]         = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const activeCategory = searchParams?.get('category') || ''
  const onDivergence   = pathname === '/arbitrage'
  const onLp           = pathname === '/lp'

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') { setDark(true); document.documentElement.classList.add('dark') }
    const onScroll = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const handleCategory = (value: string) => {
    setMenuOpen(false)
    router.push(value ? `/markets?category=${value}` : '/markets')
  }

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b transition-shadow ${scrolled ? 'shadow-sm' : ''}`}
        style={{
          background: dark ? '#0b0d12' : '#ffffff',
          borderColor: dark ? '#1e2330' : '#e8ecf0',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 56, gap: 10 }}>

            {/* Logo */}
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
              <div style={{
                width: 26, height: 26, background: '#5f5cf0', borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 700,
              }}>
                P
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: dark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.3px' }}>
                Predacle
              </span>
            </Link>

            {/* Divergence link — desktop */}
            <Link href="/arbitrage" className="divergence-link"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                padding: '6px 10px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                textDecoration: 'none', whiteSpace: 'nowrap', color: '#5f5cf0',
                background: onDivergence ? (dark ? '#1e1b4b' : '#ede9fe') : 'transparent',
                border: `1px solid ${dark ? '#312e81' : '#ddd6fe'}`,
                transition: 'all 0.15s',
              }}
              aria-current={onDivergence ? 'page' : undefined}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>⇄</span> Divergence
            </Link>

            {/* LP Rewards link — desktop */}
            <Link href="/lp" className="lp-link"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                padding: '6px 10px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                textDecoration: 'none', whiteSpace: 'nowrap', color: '#5f5cf0',
                background: onLp ? (dark ? '#1e1b4b' : '#ede9fe') : 'transparent',
                border: `1px solid ${dark ? '#312e81' : '#ddd6fe'}`,
                transition: 'all 0.15s',
              }}
              aria-current={onLp ? 'page' : undefined}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>💧</span> LP Rewards
            </Link>

            {/* Signals link — desktop */}
            <Link href="/signals" className="signals-link"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                padding: '6px 10px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                textDecoration: 'none', whiteSpace: 'nowrap', color: '#5f5cf0',
                background: pathname === '/signals' ? (dark ? '#1e1b4b' : '#ede9fe') : 'transparent',
                border: `1px solid ${dark ? '#312e81' : '#ddd6fe'}`,
                transition: 'all 0.15s',
              }}
              aria-current={pathname === '/signals' ? 'page' : undefined}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>⚡</span> Signals
            </Link>

            {/* Leaderboard link — desktop */}
            <Link href="/leaderboard" className="leaderboard-link"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                padding: '6px 10px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                textDecoration: 'none', whiteSpace: 'nowrap', color: '#5f5cf0',
                background: pathname === '/leaderboard' ? (dark ? '#1e1b4b' : '#ede9fe') : 'transparent',
                border: `1px solid ${dark ? '#312e81' : '#ddd6fe'}`,
                transition: 'all 0.15s',
              }}
              aria-current={pathname === '/leaderboard' ? 'page' : undefined}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>🎯</span> Leaderboard
            </Link>

            {/* Pro link - desktop */}
            <Link href="/pro" className="pro-link"
              style={{
                display: 'flex', alignItems: 'center', flexShrink: 0,
                padding: '6px 10px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                textDecoration: 'none', whiteSpace: 'nowrap', color: '#5f5cf0',
                background: pathname === '/pro' ? (dark ? '#1e1b4b' : '#ede9fe') : 'transparent',
                transition: 'all 0.15s',
              }}
              aria-current={pathname === '/pro' ? 'page' : undefined}>
              Pro
            </Link>

            {/* Category tabs — desktop */}
            <nav className="scroll-x" style={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto' }} aria-label="Market categories">
              {CATEGORIES.map(cat => {
                const isActive = activeCategory === cat.value && !onDivergence && !onLp
                return (
                  <button key={cat.value} onClick={() => handleCategory(cat.value)}
                    style={{
                      padding: '6px 12px', fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      borderRadius: 8, border: 'none', cursor: 'pointer',
                      whiteSpace: 'nowrap', transition: 'all 0.15s',
                      background: isActive ? (dark ? '#1e1b4b' : '#ede9fe') : 'transparent',
                      color: isActive ? '#5f5cf0' : dark ? '#64748b' : '#64748b',
                    }}
                    aria-current={isActive ? 'page' : undefined}>
                    {cat.label}
                  </button>
                )
              })}
            </nav>

            {/* Search with autocomplete — desktop */}
            <div className="desktop-search" style={{ width: 200, flexShrink: 0 }}>
              <SearchAutocomplete placeholder="Search markets..." />
            </div>

            {/* Dark mode toggle */}
            <button onClick={toggleDark}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ padding: 8, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: dark ? '#64748b' : '#94a3b8', flexShrink: 0 }}>
              {dark ? (
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              ) : (
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>

            {/* Mobile hamburger */}
            <button onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              style={{ display: 'none', padding: 8, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: dark ? '#64748b' : '#94a3b8' }}
              className="mobile-menu-btn">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}/>
              </svg>
            </button>
          </div>

          {/* Mobile search */}
          <div className="mobile-search" style={{ paddingBottom: 10 }}>
            <SearchAutocomplete placeholder="Search — Bitcoin, Elections, FIFA..." />
          </div>

          {/* Mobile category menu */}
          {menuOpen && (
            <div style={{ borderTop: `1px solid ${dark ? '#1e2330' : '#e8ecf0'}`, padding: '12px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Link href="/pro" onClick={() => setMenuOpen(false)}
                style={{
                  padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 20,
                  textDecoration: 'none', display: 'flex', alignItems: 'center',
                  background: dark ? '#1e1b4b' : '#ede9fe', color: '#5f5cf0',
                }}>
                Pro
              </Link>
              <Link href="/arbitrage" onClick={() => setMenuOpen(false)}
                style={{
                  padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 20,
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
                  background: onDivergence ? '#ede9fe' : (dark ? '#1e1b4b' : '#ede9fe'),
                  color: '#5f5cf0',
                }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>⇄</span> Divergence
              </Link>
              <Link href="/lp" onClick={() => setMenuOpen(false)}
                style={{
                  padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 20,
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
                  background: onLp ? '#ede9fe' : (dark ? '#1e1b4b' : '#ede9fe'),
                  color: '#5f5cf0',
                }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>💧</span> LP Rewards
              </Link>
              <Link href="/leaderboard" onClick={() => setMenuOpen(false)}
                style={{
                  padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 20,
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
                  background: pathname === '/leaderboard' ? '#ede9fe' : (dark ? '#1e1b4b' : '#ede9fe'),
                  color: '#5f5cf0',
                }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>🎯</span> Leaderboard
              </Link>
              <Link href="/signals" onClick={() => setMenuOpen(false)}
                style={{
                  padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 20,
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
                  background: pathname === '/signals' ? '#ede9fe' : (dark ? '#1e1b4b' : '#ede9fe'),
                  color: '#5f5cf0',
                }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>⚡</span> Signals
              </Link>
              {CATEGORIES.map(cat => {
                const isActive = activeCategory === cat.value && !onDivergence && !onLp
                return (
                  <button key={cat.value} onClick={() => handleCategory(cat.value)}
                    style={{
                      padding: '6px 12px', fontSize: 13, fontWeight: isActive ? 600 : 500,
                      borderRadius: 20, border: 'none', cursor: 'pointer',
                      background: isActive ? '#ede9fe' : dark ? '#111318' : '#f5f7fa',
                      color: isActive ? '#5f5cf0' : dark ? '#64748b' : '#64748b',
                    }}>
                    {cat.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </header>

      <style>{`
        @media (max-width: 768px) {
          .leaderboard-link { display: none !important; }
          .mobile-menu-btn  { display: flex !important; }
          .desktop-search   { display: none !important; }
          .pro-link        { display: none !important; }
          .divergence-link  { display: none !important; }
          .lp-link          { display: none !important; }
          .signals-link     { display: none !important; }
          nav[aria-label="Market categories"] { display: none !important; }
          .mobile-search    { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-search { display: none !important; }
        }
      `}</style>
    </>
  )
}
