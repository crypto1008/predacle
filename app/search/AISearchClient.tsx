'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import MarketCard from '../components/MarketCard'
import MarketCardSkeleton from '../components/MarketCardSkeleton'

interface Market {
  id: string; platform: string; question: string
  probability: number | null; volume: number | null
  volume_label: string | null; end_date: string | null
  end_date_label: string | null; traders: number | null
  category: string | null; url: string; status: string
  created_at?: string; image_url?: string | null
}
interface SearchResponse {
  query: string
  chips: string[]
  markets: Market[]
  aiUsed: boolean
}

const EXAMPLES = [
  'cheap longshots closing this week',
  'liquid crypto markets on Polymarket',
  'likely political outcomes for 2026',
  'new sports markets',
]

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

export default function AISearchClient() {
  const router = useRouter()
  const params = useSearchParams()
  const dark = useDark()

  const [input, setInput] = useState('')
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const bg      = dark ? '#0a0b0d' : '#ffffff'
  const txt1    = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2    = dark ? '#8a919e' : '#5b616e'
  const txt3    = dark ? '#5b616e' : '#8a919e'
  const border  = dark ? '#26282d' : '#eaecef'
  const inputBg = dark ? '#16171a' : '#ffffff'
  const chipBg  = dark ? '#0f1d3d' : '#eaf0ff'

  const run = useCallback((q: string) => {
    const query = q.trim()
    if (query.length < 2) return
    setLoading(true)
    setErr(null)
    fetch(`/api/ai/search?q=${encodeURIComponent(query)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Request failed (${r.status})`))))
      .then((d: SearchResponse) => setData(d))
      .catch((e) => setErr(e?.message || 'Search failed'))
      .finally(() => setLoading(false))
  }, [])

  // Run on first load if ?q= is present, and keep the box in sync
  useEffect(() => {
    const q = params.get('q') || ''
    setInput(q)
    if (q.trim().length >= 2) run(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = () => {
    const q = input.trim()
    if (q.length < 2) return
    router.replace(`/search?q=${encodeURIComponent(q)}`)
    run(q)
  }

  const markets = data?.markets ?? []

  return (
    <main style={{ background: bg, minHeight: '70vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 20px 64px' }}>

        {/* Heading */}
        <div style={{ maxWidth: 680, marginBottom: 22 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.6px', color: txt1, margin: '0 0 8px' }}>
            ✨ AI Search
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: txt2, margin: 0 }}>
            Describe what you&apos;re looking for in plain English. Predacle reads the intent —
            topic, price, timing, platform — and finds matching markets across all six platforms.
          </p>
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 8, maxWidth: 680, marginBottom: 12 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            placeholder="e.g. cheap longshots closing this week"
            style={{
              flex: 1, fontSize: 15, padding: '12px 14px', borderRadius: 10,
              border: `1px solid ${border}`, background: inputBg, color: txt1,
              fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={submit}
            style={{
              fontSize: 14, fontWeight: 600, padding: '12px 20px', borderRadius: 10,
              border: 'none', background: '#0052ff', color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            Search
          </button>
        </div>

        {/* Examples */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 680, marginBottom: 28 }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => { setInput(ex); router.replace(`/search?q=${encodeURIComponent(ex)}`); run(ex) }}
              style={{
                fontSize: 12, color: txt2, background: dark ? '#26282d' : '#f5f6f8',
                border: `1px solid ${border}`, padding: '5px 11px', borderRadius: 20,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Interpretation chips */}
        {data && data.chips.length > 0 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: txt3 }}>
              {data.aiUsed ? 'Interpreted as' : 'Matching'}:
            </span>
            {data.chips.map((c, i) => (
              <span key={i} style={{
                fontSize: 12, fontWeight: 600, color: '#0052ff', background: chipBg,
                border: `1px solid ${dark ? '#1d3563' : '#c9dcff'}`, padding: '3px 10px', borderRadius: 20,
              }}>
                {c}
              </span>
            ))}
            {!data.aiUsed && (
              <span style={{ fontSize: 11, color: txt3 }}>· keyword match (AI unavailable)</span>
            )}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div style={gridStyle}>
            {Array.from({ length: 6 }).map((_, i) => <MarketCardSkeleton key={i} />)}
          </div>
        ) : err ? (
          <p style={{ fontSize: 14, color: '#e5484d' }}>{err}</p>
        ) : data && markets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: txt3 }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🔍</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: txt1, margin: '0 0 6px' }}>No markets matched</p>
            <p style={{ fontSize: 13, margin: 0 }}>Try a broader description, or remove a constraint like the timing or price.</p>
          </div>
        ) : data ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: txt1, marginBottom: 14 }}>
              {markets.length} market{markets.length === 1 ? '' : 's'}
            </div>
            <div style={gridStyle}>
              {markets.map((m) => (
                <MarketCard key={m.id} market={m} onClick={() => router.push(`/markets/${m.id}`)} />
              ))}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 14, color: txt3 }}>Start with a description above, or tap an example.</p>
        )}
      </div>
    </main>
  )
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 12,
}
