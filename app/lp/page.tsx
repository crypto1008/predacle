import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
import LpClient from './LpClient'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

const DESC =
  'Find the best Polymarket and Kalshi liquidity-provider reward opportunities. Ranked by the Predacle LP Score — daily reward pool, competition, price band, spread health and time to resolution.'

export const metadata: Metadata = {
  // NOTE: the root layout applies a '%s | Predacle' template. The brand must NOT
  // be repeated here — 'LP Rewards Scanner — Predacle' rendered as
  // "LP Rewards Scanner — Predacle | Predacle".
  title: 'LP Rewards Scanner',
  description: DESC,
  alternates: { canonical: `${SITE}/lp` },
  keywords: [
    'polymarket liquidity rewards',
    'kalshi liquidity rewards',
    'lp rewards scanner',
    'best polymarket liquidity rewards markets',
    'prediction market liquidity provider',
    'polymarket lp rewards calculator',
  ],
  openGraph: {
    title: 'LP Rewards Scanner — Find the Best Liquidity Reward Markets',
    description: DESC,
    url: `${SITE}/lp`,
    siteName: 'Predacle',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@PredacleHQ',
    title: 'LP Rewards Scanner — Predacle',
    description: DESC,
    images: ['/opengraph-image'],
  },
}

// ---------------------------------------------------------------------------
// Server-rendered SEO content, below <LpClient>. LpClient is a client component,
// so the scanner itself gives Google almost nothing to read. This block is the
// page's actual crawlable content and explains what the LP Score is built from —
// which is the one thing no competitor can copy, because it is our algorithm.
// ---------------------------------------------------------------------------
const SCORE_FACTORS: [string, string][] = [
  [
    'Daily reward pool',
    'How much the market pays out per day. Polymarket publishes an exact figure. Kalshi runs a liquidity-incentive program but does not publish per-market pools, so its markets are scored on book health and shown as eligible — verify the pool on Kalshi itself.',
  ],
  [
    'Competition',
    'The pool is split proportionally, so the headline number is what everyone shares, not what you earn. A pool that looks generous is often generous because it is already crowded. Competition infers how contested a pool is from trading volume relative to its size — a quiet pool with a smaller number frequently pays better per dollar staked.',
  ],
  [
    'Price band',
    'Markets nearer the middle let you quote both sides without accumulating brutal one-sided inventory. At the extremes, fills leave you holding a position that can lose far more than the rewards pay. On Polymarket, single-sided orders score nothing at all once the midpoint leaves the 10¢–90¢ band.',
  ],
  [
    'Spread health',
    'A book that is already tight leaves little room to earn. A book that is wildly wide is usually wide for a reason — volatility, or nobody willing to stand in front of it. Neither extreme is where you want to be.',
  ],
  [
    'Time to resolution',
    'Long-dated, low-catalyst markets move slowly, which means fewer adverse fills and less constant re-posting. Short-dated markets ask you to babysit orders against news you cannot see coming.',
  ],
]

const h2: React.CSSProperties = { fontSize: 22, fontWeight: 700, marginTop: 34, marginBottom: 12 }
const p: React.CSSProperties = { marginBottom: 14, lineHeight: 1.7, fontSize: 15 }
const linkStyle: React.CSSProperties = { color: '#0052ff', fontWeight: 600, textDecoration: 'none' }

export default function LpPage() {
  return (
    <>
      <Suspense fallback={null}>
        <Header />
      </Suspense>

      <LpClient />

      {/* Server JSX — outside the client boundary, so it lands in the SSR HTML. */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '8px 20px 48px' }}>
        <h2 style={h2}>What liquidity rewards are</h2>
        <p style={p}>
          Polymarket and Kalshi pay you to keep their order books tight. You post resting limit orders near a
          market&rsquo;s midpoint, and you earn a share of a daily reward pool for leaving them there &mdash; whether or
          not anyone ever fills them. You are not being paid to predict the outcome. You are being paid to be the
          counterparty other traders can trade against.
        </p>
        <p style={p}>
          It is a genuinely different activity from betting, and it carries genuinely different risks. Your resting
          orders get filled by whoever knows something you do not, precisely when the news breaks. An adverse fill you
          have to hold to resolution can cost more than months of rewards. This is not passive yield, and it is not free
          money.
        </p>
        <p style={p}>
          <Link href="/guides/lp-rewards" style={linkStyle}>
            Read the full guide to how LP rewards work &rarr;
          </Link>{' '}
          &mdash; the payout formula, the $1 daily floor, what you can realistically earn, and the risks most guides
          leave out.
        </p>

        <h2 style={h2}>What the LP Score is built from</h2>
        <p style={p}>
          Hundreds of markets are reward-eligible at any moment, and most of them are not worth your capital. The LP
          Score ranks them on the five things that actually decide whether a market is worth providing liquidity in.
        </p>
        {SCORE_FACTORS.map(([h, d], i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 5 }}>{h}</h3>
            <p style={{ lineHeight: 1.65, fontSize: 15, opacity: 0.88 }}>{d}</p>
          </div>
        ))}

        <h2 style={h2}>What this scanner will not tell you</h2>
        <p style={p}>
          It will not tell you exactly what you will earn. Polymarket does not publish total in-band LP liquidity for a
          market, which means no tool &mdash; free or paid &mdash; can know your precise share in advance. Anyone
          promising a guaranteed APR is hiding an assumption. Predacle estimates a conservative, typical and optimistic
          range instead, and tells you when a pool looks contested.
        </p>
        <p style={p}>
          Predacle is a research tool. It does not hold funds, place orders, or trade on your behalf, and you should
          never hand any site your wallet&rsquo;s private key to &ldquo;automate&rdquo; LP rewards. Always open the live
          order book on the platform before committing capital &mdash; a book moves faster than any aggregator refreshes.
          Access to both programs is region-restricted. Not financial advice.
        </p>
      </section>

      <Footer />
    </>
  )
}
