'use client'

import { useState, useEffect } from 'react'

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

const FEATURES = [
  { icon: '🎯', title: 'Verified arbitrage', desc: 'Live order-book checks on the biggest gaps — fee-adjusted, not just raw price differences.' },
  { icon: '⚡', title: 'Real-time prices', desc: 'Live updates instead of the public 30-minute refresh.' },
  { icon: '🔔', title: 'Price & divergence alerts', desc: 'Get notified the moment a market moves or platforms start to disagree.' },
  { icon: '📈', title: 'Full divergence history', desc: 'Unlimited history and deeper cross-platform analytics.' },
  { icon: '🔌', title: 'API access', desc: 'Programmatic access to Predacle’s aggregated market data.' },
  { icon: '🚫', title: 'Ad-free', desc: 'A clean, distraction-free experience.' },
]

export default function ProWaitlist() {
  const dark = useDark()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const headClr = dark ? '#f5f6f8' : '#0a0b0d'
  const subClr = dark ? '#8a919e' : '#5b616e'
  const cardBg = dark ? '#16171a' : '#ffffff'
  const border = dark ? '#26282d' : '#eaecef'
  const inputBg = dark ? '#26282d' : '#f5f6f8'

  const submit = async () => {
    const clean = email.trim()
    if (!clean || !clean.includes('@')) {
      setState('error')
      setMsg('Please enter a valid email.')
      return
    }
    setState('loading')
    setMsg('')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean, source: 'pro_waitlist' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Something went wrong')
      setState('done')
      setMsg(
        data?.message === 'Already subscribed'
          ? "You're already on the list — we'll be in touch."
          : "You're on the list! We'll email you when Pro launches."
      )
    } catch (e: any) {
      setState('error')
      setMsg(e?.message || 'Something went wrong. Please try again.')
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px 72px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <span
          style={{
            display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px',
            textTransform: 'uppercase', color: '#0052ff',
            background: dark ? '#0f1d3d' : '#eaf0ff',
            border: `1px solid ${dark ? '#1d3563' : '#cdddff'}`,
            padding: '4px 12px', borderRadius: 999, marginBottom: 16,
          }}
        >
          Coming soon
        </span>
        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.6px', color: headClr, margin: '0 0 12px' }}>
          Predacle <span style={{ color: '#0052ff' }}>Pro</span>
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: subClr, maxWidth: 560, margin: '0 auto' }}>
          The aggregator stays free, forever. Pro adds the power tools for people who trade across
          platforms seriously — verified edges, real-time data, and alerts that surface opportunities
          for you. Join the waitlist for early access and founding pricing.
        </p>
      </div>

      {/* Waitlist form */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, padding: 24, marginBottom: 36 }}>
        {state === 'done' ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 30, marginBottom: 8, color: '#05a66b' }}>✓</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: headClr, margin: 0 }}>{msg}</p>
          </div>
        ) : (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: subClr, display: 'block', marginBottom: 8 }}>
              Get early access
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle') }}
                onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                placeholder="you@example.com"
                style={{
                  flex: 1, minWidth: 200, padding: '12px 14px', fontSize: 15,
                  border: `1px solid ${state === 'error' ? '#e5484d' : border}`, borderRadius: 10,
                  background: inputBg, color: headClr, outline: 'none', fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={submit}
                disabled={state === 'loading'}
                style={{
                  padding: '12px 24px', fontSize: 14, fontWeight: 700,
                  background: state === 'loading' ? (dark ? '#26282d' : '#8a919e') : '#0052ff',
                  color: '#fff', border: 'none', borderRadius: 10,
                  cursor: state === 'loading' ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >
                {state === 'loading' ? 'Joining…' : 'Join the waitlist'}
              </button>
            </div>
            {state === 'error' && (
              <p style={{ fontSize: 13, color: '#e5484d', margin: '10px 0 0' }}>{msg}</p>
            )}
            <p style={{ fontSize: 12, color: subClr, margin: '12px 0 0' }}>
              No spam — just one email when Pro is ready.
            </p>
          </>
        )}
      </div>

      {/* Feature teasers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {FEATURES.map((f) => (
          <div key={f.title} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{f.icon}</div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: headClr, margin: '0 0 4px' }}>{f.title}</h3>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: subClr, margin: 0 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: subClr, textAlign: 'center', marginTop: 28, lineHeight: 1.6 }}>
        Pro features are in development and will roll out after launch. Waitlist members get early
        access and founding pricing.
      </p>
    </main>
  )
}
