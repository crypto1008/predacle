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

export default function MarketCardSkeleton() {
  const dark = useDark()
  return (
    <div style={{
      background:   dark ? '#111318' : '#fff',
      border:       `1px solid ${dark ? '#1e2330' : '#e8ecf0'}`,
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 14px 12px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <div className="skeleton" style={{ width: 72, height: 18, borderRadius: 5 }} />
          <div className="skeleton" style={{ width: 50, height: 18, borderRadius: 5 }} />
        </div>
        <div className="skeleton" style={{ width: '100%', height: 13, marginBottom: 6, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: '85%',  height: 13, marginBottom: 6, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: '60%',  height: 13, marginBottom: 16, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 80, height: 28, marginBottom: 8, borderRadius: 6 }} />
        <div className="skeleton" style={{ width: '100%', height: 3, borderRadius: 2 }} />
      </div>
      <div style={{
        padding: '9px 14px',
        background:  dark ? '#0d1117' : '#fafbfc',
        borderTop:   `1px solid ${dark ? '#1e2330' : '#f1f5f9'}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div className="skeleton" style={{ width: 60, height: 13, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 70, height: 26, borderRadius: 6 }} />
      </div>
    </div>
  )
}