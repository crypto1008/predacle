'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'

type Signal = {
  id: string
  question: string
  platform: string
  volume: string | null
  now: number
  prior: number
  move: number
  tag: string
}

const PLATFORM_LABEL: Record<string, string> = {
  polymarket: 'Polymarket', kalshi: 'Kalshi', myriad: 'Myriad',
  limitless: 'Limitless', azuro: 'Bookmaker', manifold: 'Manifold',
}

function useDarkMode() {
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

function SignalRow({ s, dark }: { s: Signal; dark: boolean }) {
  const card   = dark ? '#16171a' : '#ffffff'
  const border = dark ? '#26282d' : '#eaecef'
  const txt1   = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2   = dark ? '#8a919e' : '#5b616e'
  const txt3   = dark ? '#5b616e' : '#8a919e'
  const up = s.move >= 0
  const moveColor = up ? '#04794e' : '#cf202f'
  const pillBg = dark ? '#0f1d3d' : '#eaf0ff'

  return (
    <Link href={`/markets/${s.id}`} className="signal-row" style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: card, border: `1px solid ${border}`, borderRadius: 12,
        padding: '14px 16px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#0052ff', background: pillBg, padding: '2px 8px', borderRadius: 6 }}>
              {PLATFORM_LABEL[s.platform] || s.platform}
            </span>
            {s.tag === 'settling' && (
              <span style={{ fontSize: 11, fontWeight: 600, color: txt3, background: dark ? '#141518' : '#f5f6f8', padding: '2px 8px', borderRadius: 6 }}>
                settling
              </span>
            )}
          </div>
          <div style={{
            fontSize: 14, fontWeight: 600, color: txt1, lineHeight: 1.35,
            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {s.question}
          </div>
          <div style={{ fontSize: 12, color: txt3, marginTop: 4 }}>
            {s.volume || '—'} volume
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: moveColor, fontVariantNumeric: 'tabular-nums' }}>
            {up ? '+' : ''}{Math.round(s.move * 100)} pts
          </div>
          <div style={{ fontSize: 12, color: txt2, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(s.prior * 100)}% → <strong style={{ color: txt1 }}>{Math.round(s.now * 100)}%</strong>
          </div>
        </div>
      </div>
    </Link>
  )
}

function SignalsContent() {
  const dark = useDarkMode()
  const [signals, setSignals] = useState<Signal[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [showSettling, setShowSettling] = useState(false)

  useEffect(() => {
    fetch('/api/signals')
      .then(r => r.json())
      .then(d => setSignals(Array.isArray(d.signals) ? d.signals : []))
      .catch(() => setFailed(true))
  }, [])

  const bg     = dark ? '#0a0b0d' : '#ffffff'
  const listBg = dark ? '#0a0b0d' : '#f5f6f8'
  const border = dark ? '#26282d' : '#eaecef'
  const txt1   = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2   = dark ? '#8a919e' : '#5b616e'
  const txt3   = dark ? '#5b616e' : '#8a919e'

  const live     = (signals || []).filter(s => s.tag === 'live')
  const settling = (signals || []).filter(s => s.tag === 'settling')
  const shown    = showSettling ? [...live, ...settling] : live

  return (
    <div style={{ background: listBg, minHeight: '70vh' }}>
      {/* Page header */}
      <div style={{ background: bg, borderBottom: `1px solid ${border}`, padding: '22px 20px 18px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: txt1, letterSpacing: '-0.3px' }}>Signals</h2>
          </div>
          <p style={{ fontSize: 13.5, color: txt2, marginTop: 7, maxWidth: 640, lineHeight: 1.5 }}>
            Where real money is repricing right now — the biggest probability moves over the last 24 hours
            across real-money markets. Play money is excluded, and markets settling toward their result are
            separated out.
          </p>
        </div>
      </div>

      {/* List */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '20px 20px 48px' }}>
        {failed ? (
          <p style={{ fontSize: 14, color: txt2, textAlign: 'center', padding: '40px 0' }}>
            Couldn’t load signals. Please try again.
          </p>
        ) : signals === null ? (
          <p style={{ fontSize: 14, color: txt3, textAlign: 'center', padding: '40px 0' }}>Loading signals…</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: txt2 }}>
                <strong style={{ color: txt1 }}>{live.length}</strong> live{' '}
                <span style={{ color: txt3 }}>·</span>{' '}
                <strong style={{ color: txt1 }}>{settling.length}</strong> settling
              </span>
              <label style={{ marginLeft: 'auto', fontSize: 13, color: txt2, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={showSettling} onChange={e => setShowSettling(e.target.checked)} />
                Include settling
              </label>
            </div>

            {shown.length === 0 ? (
              <p style={{ fontSize: 14, color: txt3, textAlign: 'center', padding: '40px 0' }}>
                No live signals right now — check back soon.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {shown.map(s => <SignalRow key={s.id} s={s} dark={dark} />)}
              </div>
            )}
          </>
        )}
      </main>

      <style>{`
        .signal-row > div { transition: border-color 0.15s, transform 0.15s; }
        .signal-row:hover > div { border-color: #0052ff; transform: translateY(-1px); }
      `}</style>
    </div>
  )
}

export default function SignalsClient() {
  return (
    <>
      <Suspense fallback={<div style={{ height: 64 }} />}>
        <Header />
      </Suspense>
      <SignalsContent />
      <Footer />
    </>
  )
}
