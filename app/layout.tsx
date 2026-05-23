import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Predacle — Prediction Market Aggregator',
    template: '%s | Predacle',
  },
  description: 'Browse 16,000+ prediction markets across Polymarket, Kalshi, Myriad, Manifold, Limitless and Azuro. Live probabilities, real trading volumes, all in one place.',
  keywords: ['prediction markets', 'polymarket', 'kalshi', 'prediction aggregator', 'crypto predictions', 'sports betting markets'],
  authors: [{ name: 'Predacle' }],
  creator: 'Predacle',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com',
    siteName: 'Predacle',
    title: 'Predacle — Prediction Market Aggregator',
    description: 'Browse 16,000+ prediction markets across Polymarket, Kalshi, Myriad, Manifold, Limitless and Azuro.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Predacle — Prediction Market Aggregator',
    description: 'Browse 16,000+ prediction markets across 6 platforms. Live probabilities, real volumes.',
    creator: '@predacle',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}