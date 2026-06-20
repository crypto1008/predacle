'use client'

import { useState, useEffect, Suspense, type ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'

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

export default function ContentPage(
  { title, intro, children }: { title: string; intro?: string; children: ReactNode }
) {
  const dark = useDark()
  const bg   = dark ? '#0a0b0d' : '#ffffff'
  const txt1 = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2 = dark ? '#8a919e' : '#5b616e'

  return (
    <>
      <Suspense fallback={<div style={{ height: 56 }} />}>
        <Header />
      </Suspense>
      <main id="main" style={{ background: bg, minHeight: '70vh' }}>
        <article style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px 64px' }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: txt1, marginBottom: intro ? 12 : 28, letterSpacing: '-0.5px' }}>
            {title}
          </h1>
          {intro && <p style={{ fontSize: 16, color: txt2, lineHeight: 1.7, marginBottom: 32 }}>{intro}</p>}
          <div style={{ fontSize: 15, color: txt1, lineHeight: 1.8 }}>{children}</div>
        </article>
      </main>
      <Footer />
    </>
  )
}
