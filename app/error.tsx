'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif'
    }}>
      <h2>Something went wrong</h2>
      <p style={{ color: '#666' }}>Failed to load market data</p>
      <button
        onClick={reset}
        style={{
          padding: '0.5rem 1rem',
          background: '#0052ff',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          marginTop: '1rem'
        }}
      >
        Try again
      </button>
    </div>
  )
}