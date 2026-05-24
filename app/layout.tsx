import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Predacle — Prediction Market Aggregator',
    template: '%s | Predacle',
  },
  description: 'Browse 16,000+ prediction markets across Polymarket, Kalshi, Myriad, Manifold, Limitless and Azuro. Live probabilities, real trading volumes, all in one place.',
  keywords: ['prediction markets', 'polymarket', 'kalshi', 'manifold', 'prediction aggregator', 'crypto predictions', 'sports betting markets'],
  authors: [{ name: 'Predacle' }],
  creator: 'Predacle',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com',
    siteName: 'Predacle',
    title: 'Predacle — Prediction Market Aggregator',
    description: 'Browse 16,000+ prediction markets across 6 platforms. Live probabilities, real trading volumes.',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Predacle' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Predacle — Prediction Market Aggregator',
    description: 'Browse 16,000+ prediction markets across Polymarket, Kalshi, Myriad and more.',
    creator: '@predacle',
    images: ['/og-default.png'],
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
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

const themeScript = `try{var t=localStorage.getItem('theme'),d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d))document.documentElement.classList.add('dark')}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={jakarta.variable}>
        <a href="#main" className="sr-only">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  )
}