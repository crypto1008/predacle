import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

export const metadata: Metadata = {
  title: {
    default: 'Predacle — Prediction Market Aggregator',
    template: '%s | Predacle',
  },
  description: 'Browse prediction markets across Polymarket, Kalshi, Myriad, Manifold, Limitless and Azuro. Live probabilities, real trading volumes, all in one place.',
  keywords: ['prediction markets', 'polymarket', 'kalshi', 'manifold', 'prediction aggregator', 'crypto predictions', 'sports betting markets', 'myriad', 'limitless'],
  authors: [{ name: 'Predacle' }],
  creator: 'Predacle',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'Predacle',
    title: 'Predacle — Prediction Market Aggregator',
    description: 'Browse prediction markets across 6 platforms. Live probabilities, real trading volumes.',
  },
  twitter: {
    card: 'summary',
    title: 'Predacle — Prediction Market Aggregator',
    description: 'Browse prediction markets across Polymarket, Kalshi, Myriad and more.',
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
  manifest: '/site.webmanifest',
}

const themeScript = `try{var t=localStorage.getItem('theme'),d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d))document.documentElement.classList.add('dark')}catch(e){}`

// Sitewide structured data.
//   Organization → brand identity (name, logo, social profiles) for Google's
//     entity understanding and any knowledge-panel treatment.
//   WebSite      → feeds Google's site-name feature, so listings show
//     "Predacle" rather than a bare URL.
// Deliberately NO SearchAction: Google retired the sitelinks search box in
// November 2024, so that markup no longer renders anything.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Predacle',
      url: SITE_URL,
      logo: `${SITE_URL}/apple-touch-icon.png`,
      description: 'Prediction market aggregator spanning Polymarket, Kalshi, Myriad, Manifold, Limitless and Azuro.',
      sameAs: ['https://x.com/predacle'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: 'Predacle',
      url: SITE_URL,
      description: 'Browse prediction markets across six platforms with live probabilities and real trading volumes.',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
