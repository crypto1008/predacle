'use client'

import Link from 'next/link'
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

export default function Footer() {
  const dark = useDark()
  const [email,  setEmail]  = useState('')
  const [status, setStatus] = useState<'idle'|'loading'|'done'|'error'>('idle')
  const [msg,    setMsg]    = useState('')

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    try {
      const res  = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) { setStatus('done');  setMsg(data.message || 'Subscribed!'); setEmail('') }
      else        { setStatus('error'); setMsg(data.error   || 'Something went wrong') }
    } catch {
      setStatus('error'); setMsg('Something went wrong')
    }
  }

  // Dark palette
  const bg     = dark ? '#0b0d12' : '#ffffff'
  const border = dark ? '#1e2330' : '#e8ecf0'
  const txt1   = dark ? '#f1f5f9' : '#0f172a'
  const txt2   = dark ? '#64748b' : '#64748b'
  const inputBg = dark ? '#111318' : '#f5f7fa'
  const inputBorder = dark ? '#1e2330' : '#e8ecf0'

  const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 }
  const lnk: React.CSSProperties = { fontSize: 13, color: txt2, textDecoration: 'none' }
  const head: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: dark ? '#475569' : '#94a3b8',
    letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 12,
  }

  return (
    <footer style={{ background: bg, borderTop: `1px solid ${border}`, marginTop: 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 20px 24px' }}>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 40, marginBottom: 40,
        }}>

          {/* Brand */}
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 26, height: 26, background: '#5f5cf0', borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 700,
              }}>P</div>
              <span style={{ fontWeight: 700, fontSize: 15, color: txt1 }}>Predacle</span>
            </div>
            <p style={{ fontSize: 13, color: txt2, lineHeight: 1.6, marginBottom: 20, maxWidth: 280 }}>
              The prediction market aggregator. Browse 1,200+ markets across 6 platforms, updated every 30 minutes.
            </p>
            <p style={{ fontSize: 12, fontWeight: 600, color: txt1, marginBottom: 8 }}>
              Weekly market highlights
            </p>
            {status === 'done' ? (
              <p style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>✓ {msg}</p>
            ) : (
              <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required
                  style={{
                    flex: 1, minWidth: 160, padding: '8px 12px', fontSize: 13,
                    border: `1px solid ${inputBorder}`, borderRadius: 8, outline: 'none',
                    fontFamily: 'inherit', background: inputBg, color: txt1,
                  }}
                />
                <button type="submit" disabled={status === 'loading'}
                  style={{
                    padding: '8px 14px', fontSize: 13, fontWeight: 600,
                    background: status === 'loading' ? '#94a3b8' : '#5f5cf0',
                    color: '#fff', border: 'none', borderRadius: 8,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {status === 'loading' ? '...' : 'Subscribe'}
                </button>
              </form>
            )}
            {status === 'error' && (
              <p style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>{msg}</p>
            )}
          </div>

          {/* Markets */}
          <div>
            <p style={head}>Markets</p>
            <ul style={{ listStyle: 'none', ...col }}>
              <li><Link href="/markets" style={lnk}>All Markets</Link></li>
              <li><Link href="/markets?category=crypto"    style={lnk}>Crypto</Link></li>
              <li><Link href="/markets?category=sports"    style={lnk}>Sports</Link></li>
              <li><Link href="/markets?category=politics"  style={lnk}>Politics</Link></li>
              <li><Link href="/markets?category=economics" style={lnk}>Economics</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <p style={head}>Company</p>
            <ul style={{ listStyle: 'none', ...col }}>
              <li><Link href="/about"        style={lnk}>About</Link></li>
              <li><Link href="/how-it-works" style={lnk}>How it works</Link></li>
              <li><Link href="/faq"          style={lnk}>FAQ</Link></li>
              <li><Link href="/privacy"      style={lnk}>Privacy Policy</Link></li>
              <li><Link href="/terms"        style={lnk}>Terms of Use</Link></li>
            </ul>
          </div>

          {/* Platforms */}
          <div>
            <p style={head}>Platforms</p>
            <ul style={{ listStyle: 'none', ...col }}>
              {[
                ['https://polymarket.com',    'Polymarket'],
                ['https://kalshi.com',        'Kalshi'],
                ['https://myriad.markets',    'Myriad'],
                ['https://manifold.markets',  'Manifold'],
                ['https://limitless.exchange','Limitless'],
                ['https://azuro.org',         'Azuro'],
              ].map(([href, label]) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" style={lnk}>
                    ● {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          borderTop: `1px solid ${border}`, paddingTop: 20,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <p style={{ fontSize: 12, color: dark ? '#475569' : '#94a3b8' }}>
            © {new Date().getFullYear()} Predacle · Not financial advice
          </p>
          <p style={{ fontSize: 12, color: dark ? '#475569' : '#94a3b8' }}>
            Live · 6 platforms · updates every 30 min
          </p>
        </div>

      </div>
    </footer>
  )
}