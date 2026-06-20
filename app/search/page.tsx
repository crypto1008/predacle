import { Suspense } from 'react'
import type { Metadata } from 'next'
import Header from '../components/Header'
import Footer from '../components/Footer'
import AISearchClient from './AISearchClient'

export const metadata: Metadata = {
  title: 'AI Search — Predacle',
  description: 'Search prediction markets in plain English. Describe what you want — "cheap longshots closing this week", "liquid crypto markets" — and Predacle finds them across six platforms.',
}

export default function SearchPage() {
  return (
    <>
      <Suspense fallback={<div style={{ height: 64, borderBottom: '1px solid #eaecef' }} />}>
        <Header />
      </Suspense>
      <Suspense fallback={null}>
        <AISearchClient />
      </Suspense>
      <Footer />
    </>
  )
}
