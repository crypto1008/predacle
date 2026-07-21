import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { getPost } from '@/lib/blog'
import { getCalibration } from '@/lib/calibration'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
const SLUG = 'are-prediction-markets-accurate'

export const revalidate = 1800

const post = getPost(SLUG)!

export const metadata: Metadata = {
  title: { absolute: `${post.title} | Predacle` },
  description: post.description,
  alternates: { canonical: `${SITE}/blog/${SLUG}` },
  openGraph: {
    title: post.title,
    description: post.description,
    url: `${SITE}/blog/${SLUG}`,
    siteName: 'Predacle',
    locale: 'en_US',
    type: 'article',
    publishedTime: post.datePublished,
    authors: [post.author],
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle prediction market accuracy study' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@PredacleHQ',
    title: post.title,
    description: post.description,
    images: ['/opengraph-image'],
  },
}

function pctPts(x: number): string {
  return (x * 100).toFixed(1)
}

export default async function CalibrationPostPage() {
  let ece = '2.4'
  let n = '7,800'
  try {
    const cal = await getCalibration()
    if (cal.overall) {
      ece = pctPts((cal.overall as any).calibrationError as number)
      n = ((cal.totalCalibratable as number)).toLocaleString()
    }
  } catch {
    // fall back to the figures baked into the prose
  }

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.datePublished,
    dateModified: post.dateModified || post.datePublished,
    author: { '@type': 'Organization', name: post.author, url: SITE },
    publisher: {
      '@type': 'Organization',
      name: 'Predacle',
      url: SITE,
      logo: { '@type': 'ImageObject', url: `${SITE}/opengraph-image` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/blog/${SLUG}` },
    image: `${SITE}/opengraph-image`,
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE}/blog/${SLUG}` },
    ],
  }

  const H2 = { fontSize: 22, fontWeight: 700, margin: '36px 0 12px', letterSpacing: '-0.01em' } as const
  const P = { fontSize: 17, lineHeight: 1.7, margin: '0 0 18px' } as const

  return (
    <>
      <Suspense fallback={null}><Header /></Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <article style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px 64px' }}>
        <nav style={{ fontSize: 13, opacity: 0.6, marginBottom: 20 }}>
          <Link href="/blog" style={{ color: 'inherit' }}>Blog</Link>
        </nav>

        <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', margin: '0 0 14px' }}>
          We scored {n} prediction markets against reality. Here is how accurate they were.
        </h1>
        <p style={{ fontSize: 14, opacity: 0.6, margin: '0 0 32px' }}>
          By {post.author} · {new Date(post.datePublished).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <p style={P}>Prediction markets get talked about as if they are crystal balls. People quote them, argue with them, bet against them. Almost nobody checks whether they were actually right.</p>
        <p style={P}>So we did. We took {n} resolved markets across sports and politics, looked at the final price each one traded at before it closed, and compared that price against what really happened. Not a sample. Every binary market in those categories that we had clean resolution data for.</p>
        <p style={P}>The short version: the prices are good. When these markets said something was 20% likely, it happened close to 20% of the time. When they said 90%, it happened close to 90%. Across the whole set, the average gap between the priced probability and the real frequency was {ece} percentage points.</p>
        <p style={P}>That number, {ece} points, is the one worth remembering. It is not accuracy in the &ldquo;did the favorite win&rdquo; sense. It is calibration. It answers a sharper question: when the market puts a number on something, can you trust the number itself? Mostly, yes.</p>

        <h2 style={H2}>Why we lead with calibration, not accuracy</h2>
        <p style={P}>You will see prediction markets described as &ldquo;95% accurate&rdquo; and we could say that too. Our set comes out at 95.8% if you score every market by whether the favored side won.</p>
        <p style={P}>We are not going to lead with that, because it flatters the data. A huge share of these markets were near certainties. Think &ldquo;will this heavy favorite win a first-round match.&rdquo; Getting those right is easy, and there are thousands of them. Counting them pumps the accuracy figure up without telling you anything about the hard cases.</p>
        <p style={P}>Calibration is the honest test. It asks whether a 30% market really happens 30% of the time, and whether a 70% market really happens 70% of the time. That is the number that tells you if the price means what it says. So that is the one we put first.</p>

        <h2 style={H2}>The reliability curve, and the one flaw in it</h2>
        <p style={P}>Here is the interesting part. If you group every market by its final price and check how often each group actually came true, you get a clear shape.</p>
        <p style={P}>At the extremes, the markets are close to flawless. Markets priced under 10% happened 0.2% of the time. Markets priced above 90% happened 99.7% of the time. When a prediction market is confident, it has earned it.</p>
        <p style={P}>The middle is where it gets interesting. There is a consistent, mild bias, and it runs in a specific direction.</p>
        <p style={P}>Below 50%, things happened slightly less often than the price implied. A group of markets priced around 24% actually came true 14% of the time. The longshots were a little overpriced.</p>
        <p style={P}>Above 60%, the opposite. A group priced around 64% came true 76% of the time. The favorites were a little underpriced.</p>
        <p style={P}>Put those two together and you have what finance people call a favorite-longshot bias. The market is a touch too generous to underdogs and a touch too shy on favorites. This is not a Predacle finding. It shows up in racetrack betting and academic studies going back decades. What stands out is that it shows up here too, in modern real-money prediction markets, and that it is small. A few points, not a chasm.</p>
        <p style={P}>If you wanted to act on it, the reading is simple. When one of these markets prices something at 65 or 70%, the true odds are probably a little higher than that. The crowd underrates its own favorites.</p>

        <h2 style={H2}>How we measured it</h2>
        <p style={P}>No black box, so here is exactly what we did.</p>
        <p style={P}>We took the final price each market traded at before it resolved. That is the market&rsquo;s last, most informed guess. We compared it against the binary outcome, one for yes, zero for no.</p>
        <p style={P}>We used two standard measures. The Brier score, which is the mean squared error between price and outcome, came out at 0.033. Lower is sharper. For reference, always guessing 50% would give you 0.25, so 0.033 is a long way better than a coin flip. And expected calibration error, the average gap between priced probability and real frequency across ten buckets, which is the {ece} points.</p>
        <p style={P}>We left a lot out on purpose. Short-term automated crypto price markets, the kind that ask whether Bitcoin is above some number at 5pm, were excluded. There are tens of thousands of them, they resolve almost mechanically, and they would swamp the honest forecasting markets and inflate every number. We cut more than 11,000 of those. We also dropped price-ladder rungs and anything without a clean binary resolution. What is left is genuine event forecasting.</p>
        <p style={P}>Split by category, politics scored slightly better than sports. Politics came in at 1.3 points of calibration error. Sports at 2.5 points across a far larger set. Both are good. The politics sample is smaller, so treat that gap gently.</p>

        <h2 style={H2}>What this actually means for you</h2>
        <p style={P}>If you use these markets, the practical takeaway is short.</p>
        <p style={P}>The price is a real probability. Treat a 70% market as roughly a 70% thing, maybe a touch more. Do not treat it as a promise, and do not dismiss it as noise. It is a genuine, tradeable estimate that, across thousands of cases, held up against reality.</p>
        <p style={P}>The market is most trustworthy when it is confident. The extremes are where calibration is tightest. If a market is sitting at 95%, that 95% is about as honest a number as you will find anywhere.</p>
        <p style={P}>And the middle carries a small, exploitable tilt toward underdogs. Nothing dramatic. But it is there, it is consistent, and now you know which way it leans.</p>
        <p style={P}>
          These numbers update as new markets resolve. The{' '}
          <Link href="/track-record" style={{ color: '#2563eb' }}>live version, with the current reliability curve</Link>{' '}
          and the per-category breakdown, shows the latest figures. You can also{' '}
          <Link href="/odds" style={{ color: '#2563eb' }}>browse the markets themselves</Link>{' '}
          to see what is priced right now.
        </p>
      </article>
      <Footer />
    </>
  )
}
