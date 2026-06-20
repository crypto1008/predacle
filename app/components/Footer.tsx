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

// ── Social links — update these handles/URLs to your real accounts ──
const SOCIALS: { label: string; href: string; icon: React.ReactNode }[] = [
  { label: 'X',         href: 'https://x.com/predacle',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  { label: 'LinkedIn',  href: 'https://linkedin.com/company/predacle',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg> },
  { label: 'Instagram', href: 'https://instagram.com/predacle',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38C1.36 2.67.94 3.34.63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.8.72 1.47 1.38 2.13.66.66 1.33 1.08 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.8-.3 1.47-.72 2.13-1.38.66-.66 1.08-1.33 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.8-.72-1.47-1.38-2.13A5.92 5.92 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-10.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/></svg> },
  { label: 'TikTok',    href: 'https://tiktok.com/@predacle',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .59.05.86.13V9.4a6.33 6.33 0 0 0-.86-.06A6.34 6.34 0 0 0 5.6 20.76a6.34 6.34 0 0 0 10.86-4.43V8.86a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.64-.29z"/></svg> },
  { label: 'Discord',   href: 'https://discord.gg/predacle',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37A19.79 19.79 0 0 0 15.45 2.86a.07.07 0 0 0-.08.04c-.21.38-.44.87-.61 1.25a18.27 18.27 0 0 0-5.49 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04A19.74 19.74 0 0 0 3.7 4.37a.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .09-.03c.46-.63.87-1.29 1.23-1.99a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.89.08.08 0 0 1-.01-.13l.37-.29a.07.07 0 0 1 .08-.01 14.2 14.2 0 0 0 12.06 0 .07.07 0 0 1 .08.01l.37.29a.08.08 0 0 1-.01.13c-.6.35-1.22.64-1.87.89a.08.08 0 0 0-.04.11c.36.7.78 1.36 1.23 1.99a.08.08 0 0 0 .09.03 19.84 19.84 0 0 0 6-3.03.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.54-13.66a.06.06 0 0 0-.03-.03zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.09 2.16 2.42 0 1.34-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42s.96-2.42 2.16-2.42c1.21 0 2.18 1.09 2.16 2.42 0 1.34-.95 2.42-2.16 2.42z"/></svg> },
  { label: 'GitHub',    href: 'https://github.com/crypto1008/predacle',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.28 1.2-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.75.81 1.2 1.83 1.2 3.09 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z"/></svg> },
]

export default function Footer() {
  const dark = useDark()
  const [email,  setEmail]  = useState('')
  const [status, setStatus] = useState<'idle'|'loading'|'done'|'error'>('idle')
  const [msg,    setMsg]    = useState('')
  const [marketCount, setMarketCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setMarketCount(d.overall?.totalMarkets ?? null))
      .catch(() => {})
  }, [])

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

  // ── Theme palette ──
  const bg          = dark ? '#0a0b0d' : '#ffffff'
  const border      = dark ? '#26282d' : '#eaecef'
  const txt1        = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2        = dark ? '#8a919e' : '#5b616e'
  const txt3        = dark ? '#5b616e' : '#8a919e'
  const inputBg     = dark ? '#16171a' : '#f5f6f8'
  const inputBorder = dark ? '#26282d' : '#eaecef'
  const socialBg    = dark ? '#16171a' : '#f5f6f8'
  const socialBd    = dark ? '#26282d' : '#eaecef'

  const countLabel = marketCount && marketCount > 0
    ? `${(Math.floor(marketCount / 100) * 100).toLocaleString()}+`
    : '16,000+'

  const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 }
  const lnk: React.CSSProperties = { fontSize: 13.5, color: txt2, textDecoration: 'none' }
  const head: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: txt3,
    letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 14,
  }

  return (
    <footer style={{ background: bg, borderTop: `1px solid ${border}`, marginTop: 'auto' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 20px 28px' }}>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 44, marginBottom: 44,
        }}>

          {/* Brand + newsletter */}
          <div style={{ gridColumn: 'span 2', minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
              <div style={{
                width: 28, height: 28, background: '#0052ff', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14, fontWeight: 800,
              }}>P</div>
              <span className="font-display" style={{ fontWeight: 800, fontSize: 17, color: txt1, letterSpacing: '-0.02em' }}>Predacle</span>
            </div>
            <p style={{ fontSize: 13.5, color: txt2, lineHeight: 1.6, marginBottom: 22, maxWidth: 300 }}>
              The prediction market aggregator. Browse {countLabel} markets across 6 platforms, refreshed every 30 minutes.
            </p>

            <p style={{ fontSize: 13, fontWeight: 600, color: txt1, marginBottom: 10 }}>
              Weekly market highlights
            </p>
            {status === 'done' ? (
              <p style={{ fontSize: 13.5, color: '#05a66b', fontWeight: 600 }}>✓ {msg}</p>
            ) : (
              <form onSubmit={handleSubscribe} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 360 }}>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required
                  style={{
                    flex: 1, minWidth: 170, padding: '10px 14px', fontSize: 13.5,
                    border: `1px solid ${inputBorder}`, borderRadius: 100, outline: 'none',
                    fontFamily: 'inherit', background: inputBg, color: txt1,
                  }}
                />
                <button type="submit" disabled={status === 'loading'}
                  style={{
                    padding: '10px 20px', fontSize: 13.5, fontWeight: 600,
                    background: status === 'loading' ? '#8a919e' : '#0052ff',
                    color: '#fff', border: 'none', borderRadius: 100,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {status === 'loading' ? '…' : 'Subscribe'}
                </button>
              </form>
            )}
            {status === 'error' && (
              <p style={{ fontSize: 12.5, color: '#e5484d', marginTop: 8 }}>{msg}</p>
            )}

            {/* Social icons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              {SOCIALS.map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                  aria-label={s.label} title={s.label}
                  style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: socialBg, border: `1px solid ${socialBd}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: txt2, transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#0052ff'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#0052ff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = socialBg; e.currentTarget.style.color = txt2; e.currentTarget.style.borderColor = socialBd }}>
                  {s.icon}
                </a>
              ))}
            </div>
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
              <li><Link href="/compare/polymarket-vs-kalshi" style={lnk}>Polymarket vs Kalshi</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <p style={head}>Company</p>
            <ul style={{ listStyle: 'none', ...col }}>
              <li><Link href="/pro" style={{ ...lnk, color: '#0052ff', fontWeight: 600 }}>Predacle Pro</Link></li>
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
                ['https://azuro.org',         'Bookmaker'],
              ].map(([href, label]) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" style={lnk}>{label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: `1px solid ${border}`, paddingTop: 22,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <p style={{ fontSize: 12.5, color: txt3 }}>
            © {new Date().getFullYear()} Predacle · Not financial advice
          </p>
          <p style={{ fontSize: 12.5, color: txt3 }}>
            Live · 6 platforms · updates every 30 min
          </p>
        </div>

      </div>
    </footer>
  )
}
