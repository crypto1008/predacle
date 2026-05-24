'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [menuOpen, setMenuOpen]   = useState(false)
  const [dark, setDark]           = useState(false)
  const [scrolled, setScrolled]   = useState(false)
  const [search, setSearch]       = useState('')

  const activeCategory = searchParams?.get('category') || ''

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    const onScroll = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('main-search')?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) router.push(`/markets?q=${encodeURIComponent(search.trim())}`)
  }

  return (
    <>
      <header
        className={`sticky top-0 z-50 bg-white border-b transition-shadow ${
          scrolled ? 'shadow-sm' : ''
        }`}
        style={{
          background: dark ? '#0b0d12' : '#ffffff',
          borderColor: dark ? '#1e2330' : '#e8ecf0',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 56, gap: 24 }}>

            {/* Logo */}
            <Link
              href="/"
              style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}
            >
              <div style={{
                width: 26, height: 26, background: '#5f5cf0',
                borderRadius: 7, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700,
              }}>
                P
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: dark ? '#f1f5f9' : '#0f172a', letterSpacing: '-0.3px' }}>
                Predacle
              </span>
            </Link>

            {/* Category tabs — desktop */}
            <nav
              className="scroll-x"
              style={{ display: 'flex', gap: 2, flex: 1, overflowX: 'auto' }}
              aria-label="Market categories"
            >
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.value
                return (
                  <button
                    key={cat.value}
                    onClick={() => handleCategory(cat.value)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      borderRadius: 8,
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                      background: isActive
                        ? dark ? '#1e1b4b' : '#ede9fe'
                        : 'transparent',
                      color: isActive
                        ? '#5f5cf0'
                        : dark ? '#64748b' : '#64748b',
                    }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </nav>

            {/* Search bar — desktop */}
            <form
              onSubmit={handleSearch}
              style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: dark ? '#111318' : '#f5f7fa',
                border: `1px solid ${dark ? '#1e2330' : '#e8ecf0'}`,
                borderRadius: 9, padding: '7px 12px', minWidth: 200,
                transition: 'border-color 0.15s',
              }}>
                <svg width="14" height="14" fill="none" stroke={dark ? '#475569' : '#94a3b8'} strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  id="main-search"
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search markets..."
                  style={{
                    background: 'none', border: 'none', outline: 'none',
                    fontSize: 13, color: dark ? '#f1f5f9' : '#0f172a',
                    width: '100%', fontFamily: 'inherit',
                  }}
                  aria-label="Search prediction markets"
                />
                <kbd style={{
                  fontSize: 10, color: dark ? '#475569' : '#94a3b8',
                  background: dark ? '#0b0d12' : '#fff',
                  border: `1px solid ${dark ? '#1e2330' : '#e2e8f0'}`,
                  borderRadius: 4, padding: '1px 5px',
                }}>
                  ⌘K
                </kbd>
              </div>
            </form>

            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                padding: 8, border: 'none', borderRadius: 8, cursor: 'pointer',
                background: 'transparent', color: dark ? '#64748b' : '#94a3b8',
                flexShrink: 0,
              }}
            >
              {dark ? (
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              ) : (
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              style={{
                display: 'none', padding: 8, border: 'none',
                borderRadius: 8, cursor: 'pointer', background: 'transparent',
                color: dark ? '#64748b' : '#94a3b8',
              }}
              className="mobile-menu-btn"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}/>
              </svg>
            </button>

          </div>

          {/* Mobile search */}
          <div className="mobile-search" style={{ paddingBottom: 10 }}>
            <form onSubmit={handleSearch}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: dark ? '#111318' : '#f5f7fa',
                border: `1px solid ${dark ? '#1e2330' : '#e8ecf0'}`,
                borderRadius: 9, padding: '8px 12px',
              }}>
                <svg width="14" height="14" fill="none" stroke={dark ? '#475569' : '#94a3b8'} strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search markets — Bitcoin, Elections, FIFA..."
                  style={{
                    background: 'none', border: 'none', outline: 'none',
                    fontSize: 14, color: dark ? '#f1f5f9' : '#0f172a',
                    width: '100%', fontFamily: 'inherit',
                  }}
                  aria-label="Search prediction markets"
                />
              </div>
            </form>
          </div>

          {/* Mobile category menu */}
          {menuOpen && (
            <div style={{
              borderTop: `1px solid ${dark ? '#1e2330' : '#e8ecf0'}`,
              padding: '12px 0', display: 'flex', flexWrap: 'wrap', gap: 6,
            }}>
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.value
                return (
                  <button
                    key={cat.value}
                    onClick={() => handleCategory(cat.value)}
                    style={{
                      padding: '6px 12px', fontSize: 13, fontWeight: isActive ? 600 : 500,
                      borderRadius: 20, border: 'none', cursor: 'pointer',
                      background: isActive ? '#ede9fe' : dark ? '#111318' : '#f5f7fa',
                      color: isActive ? '#5f5cf0' : dark ? '#64748b' : '#64748b',
                    }}
                  >
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
          .mobile-menu-btn { display: flex !important; }
          nav[aria-label="Market categories"] { display: none !important; }
          form:has(#main-search) { display: none !important; }
          .mobile-search { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-search { display: none !important; }
        }
      `}</style>
    </>
  )
}