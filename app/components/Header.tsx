'use client'

import { useState, useEffect, useRef } from 'react'
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

// The analytical tool pages — grouped under the desktop "Tools" dropdown.
const TOOLS = [
  { href: '/arbitrage',   icon: '⇄',  label: 'Divergence', desc: 'Cross-platform price gaps' },
  { href: '/lp',          icon: '💧', label: 'LP Rewards', desc: 'Liquidity reward scanner' },
  { href: '/signals',     icon: '⚡', label: 'Signals',    desc: 'Smart-money moves' },
  { href: '/leaderboard', icon: '🎯', label: 'Leaderboard', desc: 'Platform accuracy' },
  { href: '/odds',        icon: '📊', label: 'Odds',       desc: 'Aggregated event odds' },
]

export default function Header() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const pathname     = usePathname()
  const [menuOpen, setMenuOpen]   = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [dark, setDark]           = useState(false)
  const [scrolled, setScrolled]   = useState(false)
  const toolsRef = useRef<HTMLDivElement>(null)

  const activeCategory = searchParams?.get('category') || ''
  const onTool = TOOLS.some(t => pathname === t.href || pathname?.startsWith(t.href + '/'))

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') { setDark(true); document.documentElement.classList.add('dark') }
    const onScroll = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the Tools dropdown on outside-click or Escape.
  useEffect(() => {
    if (!toolsOpen) return
    const onDoc = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setToolsOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [toolsOpen])

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
          background: dark ? '#0a0b0d' : '#ffffff',
          borderColor: dark ? '#26282d' : '#eaecef',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 64, gap: 14 }}>

            {/* Logo */}
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
              <div style={{
                width: 26, height: 26, background: '#0052ff', borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 700,
              }}>
                P
              </div>
              <span className="font-display" style={{ fontWeight: 800, fontSize: 20, color: dark ? '#f5f6f8' : '#0a0b0d', letterSpacing: '-0.03em' }}>
                Predacle
              </span>
            </Link>

            {/* Tools dropdown — desktop */}
            <div className="tools-dropdown" ref={toolsRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setToolsOpen(v => !v)}
                aria-haspopup="menu" aria-expanded={toolsOpen}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '8px 12px', fontSize: 14, fontWeight: 600, borderRadius: 8,
                  cursor: 'pointer', whiteSpace: 'nowrap', color: '#0052ff', fontFamily: 'inherit',
                  background: (onTool || toolsOpen) ? (dark ? '#0f1d3d' : '#eaf0ff') : 'transparent',
                  border: `1px solid ${dark ? '#1d3563' : '#cdddff'}`,
                  transition: 'all 0.15s',
                }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>🛠️</span> Tools
                <span style={{ fontSize: 9, marginLeft: 1, transform: toolsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
              </button>

              {toolsOpen && (
                <div role="menu"
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60,
                    minWidth: 232, padding: 6, borderRadius: 12,
                    background: dark ? '#16171a' : '#ffffff',
                    border: `1px solid ${dark ? '#26282d' : '#eaecef'}`,
                    boxShadow: dark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(15,23,42,0.12)',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                  {TOOLS.map(t => {
                    const active = pathname === t.href
                    return (
                      <Link key={t.href} href={t.href} role="menuitem" onClick={() => setToolsOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '9px 10px', borderRadius: 8, textDecoration: 'none',
                          background: active ? (dark ? '#0f1d3d' : '#eaf0ff') : 'transparent',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = dark ? '#141518' : '#f5f6f8' }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                        <span style={{ fontSize: 16, lineHeight: 1.3, flexShrink: 0 }}>{t.icon}</span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: active ? '#0052ff' : (dark ? '#f5f6f8' : '#0a0b0d') }}>{t.label}</span>
                          <span style={{ fontSize: 11, color: dark ? '#5b616e' : '#8a919e', lineHeight: 1.3 }}>{t.desc}</span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pro link — desktop */}
            <Link href="/pro" className="pro-link"
              style={{
                display: 'flex', alignItems: 'center', flexShrink: 0,
                padding: '8px 12px', fontSize: 14, fontWeight: 600, borderRadius: 8,
                textDecoration: 'none', whiteSpace: 'nowrap', color: '#0052ff',
                background: pathname === '/pro' ? (dark ? '#0f1d3d' : '#eaf0ff') : 'transparent',
                transition: 'all 0.15s',
              }}
              aria-current={pathname === '/pro' ? 'page' : undefined}>
              Pro
            </Link>

            {/* Category tabs — desktop */}
            <nav className="scroll-x" style={{ display: 'flex', gap: 6, flex: 1, overflowX: 'auto' }} aria-label="Market categories">
              {CATEGORIES.map(cat => {
                const isActive = activeCategory === cat.value && !onTool
                return (
                  <button key={cat.value} onClick={() => handleCategory(cat.value)}
                    style={{
                      padding: '8px 14px', fontSize: 14.5,
                      fontWeight: isActive ? 600 : 500,
                      borderRadius: 8, border: 'none', cursor: 'pointer',
                      whiteSpace: 'nowrap', transition: 'all 0.15s',
                      background: isActive ? (dark ? '#0f1d3d' : '#eaf0ff') : 'transparent',
                      color: isActive ? '#0052ff' : (dark ? '#e6e8eb' : '#1a1b1f'),
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = dark ? '#141518' : '#f5f6f8' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                    aria-current={isActive ? 'page' : undefined}>
                    {cat.label}
                  </button>
                )
              })}
            </nav>

            {/* Dark mode toggle */}
            <button onClick={toggleDark}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ padding: 8, border: `1px solid ${dark ? '#1d3563' : '#cdddff'}`, borderRadius: 8, cursor: 'pointer', background: dark ? '#0f1d3d' : '#eaf0ff', color: '#0052ff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

            {/* Search with autocomplete — desktop */}
            <div className="desktop-search" style={{ width: 200, flexShrink: 0 }}>
              <SearchAutocomplete placeholder="Search markets..." />
            </div>

            {/* Mobile hamburger */}
            <button onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              style={{ display: 'none', padding: 8, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: dark ? '#5b616e' : '#8a919e' }}
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

          {/* Mobile menu */}
          {menuOpen && (
            <div style={{ borderTop: `1px solid ${dark ? '#26282d' : '#eaecef'}`, padding: '12px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Link href="/pro" onClick={() => setMenuOpen(false)}
                style={{
                  padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 20,
                  textDecoration: 'none', display: 'flex', alignItems: 'center',
                  background: dark ? '#0f1d3d' : '#eaf0ff', color: '#0052ff',
                }}>
                Pro
              </Link>
              {TOOLS.map(t => (
                <Link key={t.href} href={t.href} onClick={() => setMenuOpen(false)}
                  style={{
                    padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 20,
                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
                    background: dark ? '#0f1d3d' : '#eaf0ff', color: '#0052ff',
                  }}>
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{t.icon}</span> {t.label}
                </Link>
              ))}
              {CATEGORIES.map(cat => {
                const isActive = activeCategory === cat.value && !onTool
                return (
                  <button key={cat.value} onClick={() => handleCategory(cat.value)}
                    style={{
                      padding: '6px 12px', fontSize: 13, fontWeight: isActive ? 600 : 500,
                      borderRadius: 20, border: 'none', cursor: 'pointer',
                      background: isActive ? '#eaf0ff' : dark ? '#16171a' : '#f5f6f8',
                      color: isActive ? '#0052ff' : dark ? '#5b616e' : '#5b616e',
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
          .mobile-menu-btn  { display: flex !important; }
          .desktop-search   { display: none !important; }
          .pro-link         { display: none !important; }
          .tools-dropdown   { display: none !important; }
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
