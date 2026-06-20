import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ fontSize: '4rem', margin: 0 }}>404</h1>
      <p style={{ color: '#666', margin: '1rem 0' }}>Market not found</p>
      <Link href="/" style={{ color: '#0052ff', textDecoration: 'none' }}>
        ← Back to Predacle
      </Link>
    </div>
  )
}