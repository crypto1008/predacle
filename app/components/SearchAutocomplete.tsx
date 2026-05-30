'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  id: string; platform: string; question: string
  probability: number | null; volume_label: string | null
}

const PLATFORM_COLORS: Record<string, string> = {
  polymarket: '#6d28d9', kalshi: '#059669', myriad: '#7e22ce',
  manifold:   '#dc2626', limitless: '#d97706', azuro: '#0891b2',
}

const PLATFORM_SHORT: Record<string, string> = {
  polymarket: 'POLY', kalshi: 'KALS', myriad: 'MYRI',
  manifold:   'MANI', limitless: 'LIMI', azuro: 'BOOK',
}

function getProbColor(p: number | null) {
  if (p === null) return '#94a3b8'
  if (p >= 0.65) return '#10b981'
  if (p >= 0.35) return '#f59e0b'
  return '#ef4444'
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

interface Props {
  placeholder?: string
  initialValue?: string
  size?: 'normal' | 'large'
  onSearch?: (q: string) => void
}

export default function SearchAutocomplete({
  placeholder  = 'Search markets...',
  initialValue = '',
  size         = 'normal',
  onSearch,
}: Props) {
  const router        = useRouter()
  const dark          = useDark()
  const [query,   setQuery]   = useState(initialValue)
  const [results, setResults] = useState<SearchResult[]>([])
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(-1)
  const inputRef    = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Dark palette
  const bg      = dark ? '#111318' : '#ffffff'
  const inputBg = dark ? '#1e2330' : '#f8fafc'
  const border  = dark ? '#1e2330' : '#e8ecf0'
  const divider = dark ? '#1e2330' : '#f1f5f9'
  const txt1    = dark ? '#f1f5f9' : '#0f172a'
  const txt2    = dark ? '#64748b' : '#94a3b8'
  const hoverBg = dark ? '#1a1f2e' : '#f8fafc'
  const footBg  = dark ? '#0d1117' : '#f8fafc'

  const isLarge = size === 'large'

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/markets/search?q=${encodeURIComponent(q)}&limit=6`)
      const data = await res.json()
      setResults(data.markets || [])
      setOpen((data.markets || []).length > 0)
    } catch {}
    finally { setLoading(false) }
  }, [])

  const handleChange = (val: string) => {
    setQuery(val)
    setFocused(-1)
    clearTimeout(debounceRef.current)
    if (val.length < 2) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const navigate = (q: string) => {
    setOpen(false)
    if (onSearch) onSearch(q)
    else router.push(`/markets?q=${encodeURIComponent(q)}`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    navigate(query.trim())
  }

  const handleSelect = (m: SearchResult) => {
    setOpen(false)
    router.push(`/markets/${m.id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, results.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(f => Math.max(f - 1, -1)) }
    else if (e.key === 'Enter' && focused >= 0 && focused < results.length) {
      e.preventDefault(); handleSelect(results[focused])
    } else if (e.key === 'Enter' && focused === results.length) {
      e.preventDefault(); navigate(query)
    } else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex' }}>
        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1,
          background: inputBg, border: `1.5px solid ${border}`,
          borderRadius: isLarge ? '12px 0 0 12px' : '8px 0 0 8px',
          padding: isLarge ? '10px 16px' : '7px 12px',
        }}>
          {loading ? (
            <div style={{
              width: 14, height: 14, border: `2px solid ${border}`,
              borderTopColor: '#5f5cf0', borderRadius: '50%',
              animation: 'ac-spin 0.8s linear infinite', flexShrink: 0,
            }} />
          ) : (
            <svg width="14" height="14" fill="none" stroke={txt2} strokeWidth={2} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (query.length >= 2 && results.length > 0) setOpen(true) }}
            placeholder={placeholder}
            autoComplete="off"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: isLarge ? 14 : 13, color: txt1, fontFamily: 'inherit',
            }}
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: txt2, fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>
              ×
            </button>
          )}
        </div>
        {/* Button */}
        <button type="submit" style={{
          padding: isLarge ? '10px 20px' : '7px 16px',
          background: '#5f5cf0', color: '#fff', border: 'none',
          borderRadius: isLarge ? '0 12px 12px 0' : '0 8px 8px 0',
          fontSize: isLarge ? 14 : 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>
          Search
        </button>
      </form>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: bg, border: `1px solid ${border}`, borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)', zIndex: 200, overflow: 'hidden',
        }}>
          {results.map((m, i) => {
            const pct    = m.probability !== null ? Math.round(m.probability * 100) : null
            const pColor = getProbColor(m.probability)
            const dotClr = PLATFORM_COLORS[m.platform] || '#94a3b8'
            const isActive = focused === i

            return (
              <button key={m.id} onClick={() => handleSelect(m)}
                onMouseEnter={() => setFocused(i)}
                onMouseLeave={() => setFocused(-1)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: 10, padding: '10px 14px', border: 'none',
                  borderBottom: `1px solid ${divider}`,
                  background: isActive ? hoverBg : bg,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotClr, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: txt1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.question}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 5px',
                  borderRadius: 4, textTransform: 'uppercase', flexShrink: 0,
                  background: dotClr + '22', color: dotClr,
                }}>
                  {PLATFORM_SHORT[m.platform] || m.platform}
                </span>
                {pct !== null && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: pColor, flexShrink: 0, minWidth: 32, textAlign: 'right' }}>
                    {pct}%
                  </span>
                )}
              </button>
            )
          })}

          {/* See all */}
          <button
            onClick={() => navigate(query)}
            onMouseEnter={() => setFocused(results.length)}
            onMouseLeave={() => setFocused(-1)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', border: 'none',
              background: focused === results.length ? hoverBg : footBg,
              cursor: 'pointer', fontFamily: 'inherit',
              color: '#5f5cf0', fontSize: 12, fontWeight: 600,
              transition: 'background 0.1s',
            }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            See all results for "{query}"
          </button>
        </div>
      )}

      <style>{`@keyframes ac-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}