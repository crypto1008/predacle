import type { Metadata } from 'next'
import Link from 'next/link'
import ContentPage from '../../components/ContentPage'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

const DESC =
  'How liquidity provider rewards actually work on Polymarket and Kalshi: the payout formula, the quadratic spread penalty, the $1 daily floor, what you can realistically earn, and the risks — adverse selection, inventory, program risk — that most guides leave out.'

export const metadata: Metadata = {
  title: { absolute: 'Polymarket & Kalshi LP Rewards: How Liquidity Rewards Actually Work | Predacle' },
  description: DESC,
  alternates: { canonical: `${SITE}/guides/lp-rewards` },
  keywords: [
    'polymarket liquidity rewards',
    'kalshi liquidity rewards',
    'prediction market liquidity provider',
    'how do polymarket liquidity rewards work',
    'how much can you earn polymarket liquidity rewards',
    'is providing liquidity on polymarket profitable',
    'polymarket lp rewards calculator',
    'polymarket market making guide',
    'kalshi liquidity incentive program',
    'prediction market reward farming risks',
  ],
  openGraph: {
    title: 'How Prediction Market LP Rewards Actually Work',
    description: DESC,
    url: `${SITE}/guides/lp-rewards`,
    siteName: 'Predacle',
    locale: 'en_US',
    type: 'article',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@PredacleHQ',
    title: 'How Prediction Market LP Rewards Actually Work',
    description: DESC,
    images: ['/opengraph-image'],
  },
}

// ---------------------------------------------------------------------------
// FAQ — emitted as FAQPage schema AND rendered visibly. Every figure below is
// sourced from Polymarket/Kalshi documentation or reported program data; none
// of it is estimated. This is YMYL (financial) content: no guaranteed-return
// language, and the downside is stated as plainly as the upside.
// ---------------------------------------------------------------------------
const faqs: [string, string][] = [
  [
    'What are liquidity provider (LP) rewards?',
    'Polymarket and Kalshi pay you for posting resting limit orders near a market\u2019s midpoint. You earn a share of a daily reward pool for keeping the order book tight \u2014 whether or not your orders are ever filled. You are not being paid to predict the outcome; you are being paid to be the counterparty other traders can trade against.',
  ],
  [
    'How much can you realistically earn from Polymarket liquidity rewards?',
    'Far less than the headline numbers suggest. Cumulative LP earnings of $100 place a wallet in roughly the top 6% of all Polymarket wallets, and $650 puts it inside the top thousand. Early bot-run LPs reported 200\u2013300 USDC per day on about 10,000 USDC of capital, but those figures are years out of date. A detailed 2026 postmortem concluded rewards are now \u201Ca thin bonus on top of real trading edge rather than a standalone money printer\u201D, with roughly 10% annualised a realistic target on calm, long-dated markets.',
  ],
  [
    'Is providing liquidity risk-free?',
    'No. You face adverse selection \u2014 informed traders hit your resting order the moment news breaks, before you can pull it. You face inventory risk \u2014 fills leave you holding a position, and at extreme prices that position can lose far more than the rewards pay. Polymarket\u2019s own documentation gives the example of $100 committed at a 90\u00a2 YES price collapsing to 50\u00a2. Providing liquidity can lose you money.',
  ],
  [
    'How is the reward split calculated?',
    'Your payout is your score divided by the total score of everyone else in that market, multiplied by the market\u2019s daily pool. The advertised pool is what everyone splits, not what you receive. If you provide 5% of the qualifying liquidity, you earn roughly 5% of the pool.',
  ],
  [
    'What is the $1 minimum on Polymarket?',
    'If a day\u2019s earnings come to less than $1, nothing is paid. It does not roll over and does not add to another day. Each day stands alone. On a crowded market with a small pool, a small stake can earn zero repeatedly.',
  ],
  [
    'Do I need to quote both sides of the market?',
    'Usually yes, and sometimes strictly. On Polymarket, when the midpoint sits outside the 10\u00a2\u201390\u00a2 band, single-sided orders score nothing at all. On Kalshi, order-book snapshots taken without two-sided liquidity meeting the target size are discarded entirely.',
  ],
  [
    'Can Predacle tell me exactly what I will earn?',
    'No, and neither can anyone else. Polymarket does not publish total in-band LP liquidity for a market, so no tool can know your exact share in advance. Predacle estimates a conservative / typical / optimistic range instead. Any service promising a precise guaranteed APR is hiding an assumption.',
  ],
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE}/guides/lp-rewards` },
        { '@type': 'ListItem', position: 3, name: 'LP Rewards', item: `${SITE}/guides/lp-rewards` },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    },
  ],
}

const h2: React.CSSProperties = { fontSize: 22, fontWeight: 700, marginTop: 36, marginBottom: 12 }
const h3: React.CSSProperties = { fontSize: 17, fontWeight: 600, marginTop: 22, marginBottom: 8 }
const p: React.CSSProperties = { marginBottom: 14, lineHeight: 1.7 }
const li: React.CSSProperties = { marginBottom: 8, lineHeight: 1.65 }
const linkStyle: React.CSSProperties = { color: '#0052ff', fontWeight: 600, textDecoration: 'none' }

export default function LpRewardsGuide() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <ContentPage
        title="How Prediction Market LP Rewards Actually Work"
        intro="Polymarket and Kalshi pay you to keep their order books tight. Here is the payout maths, what you can realistically expect to earn, and the ways people lose money doing it."
      >
        {/* ---- Hook ---- */}
        <p style={p}>
          There is a way to make money on Polymarket and Kalshi without predicting anything.
        </p>
        <p style={p}>
          You post limit orders near a market&rsquo;s midpoint. You leave them there. The platform pays you a slice of a
          daily reward pool for keeping the book tight &mdash; whether or not anyone ever fills your orders. No opinion
          required on who wins the election or the ballgame.
        </p>
        <p style={p}>
          That is the pitch, and it is real. Polymarket paid out over $5 million in liquidity rewards on sports and
          esports markets in April 2026 alone. A single Premier League match can carry a $10,000 pool.
        </p>
        <p style={p}>
          Here is the part nobody puts in the headline: <strong>most people who try this earn almost nothing.</strong>{' '}
          Cumulative LP earnings of $100 put you in the top 6% of all Polymarket wallets. $650 puts you in the top
          thousand. Out of roughly 3.1 million wallets, only about 52,000 have ever farmed rewards at all.
        </p>
        <p style={p}>
          That is not a reason to skip it. It is a reason to understand it properly before you commit capital.
        </p>

        {/* ---- What an LP does ---- */}
        <h2 style={h2}>What an LP actually does (and why it isn&rsquo;t betting)</h2>
        <p style={p}>
          A bettor takes a side. They buy YES at 40&cent; because they think the true probability is higher, and they
          win or lose on the outcome.
        </p>
        <p style={p}>
          A liquidity provider doesn&rsquo;t take a side &mdash; or rather, takes both. You post a bid to buy at
          39&cent; and an ask to sell at 41&cent;. You are not expressing a view. You are offering to be the
          counterparty for anyone who wants to trade right now, and you are paid a fee for standing there.
        </p>
        <p style={p}>
          This matters because prediction markets are useless without it. If nobody posts resting orders, the spread
          between YES and NO blows out. A trader who wants in has to cross a ten-cent gap, which destroys their edge
          before they have started. Volume dries up. Prices stop being informative. Both platforms understand this,
          which is why they pay people to keep books tight.
        </p>
        <p style={p}>
          <strong>You are not paid to be right. You are paid to be present.</strong>
        </p>

        {/* ---- Polymarket ---- */}
        <h2 style={h2}>How Polymarket pays you</h2>
        <h3 style={h3}>The pool</h3>
        <p style={p}>
          Each reward-eligible market has a daily pool &mdash; a fixed amount Polymarket distributes across everyone
          providing qualifying liquidity in that market that day. Some are tiny. Some, on major sports events, run into
          thousands.
        </p>
        <h3 style={h3}>The formula</h3>
        <p style={p}>
          Your payout is <strong>your score, divided by the total score of everyone in that market, multiplied by the
          pool.</strong> So the pool figure you see is what <em>everyone</em> splits, not what you get. This single
          misunderstanding is why so many people are disappointed by their first payout.
        </p>
        <p style={p}>Your score is roughly <strong>order size &times; time factor &times; price-quality factor</strong>:</p>
        <ul style={{ paddingLeft: 22, marginBottom: 16 }}>
          <li style={li}><strong>Size</strong> &mdash; bigger qualifying orders score more.</li>
          <li style={li}>
            <strong>Time</strong> &mdash; the fraction of the day your order actually sat on the book. Post for two
            hours and you earn roughly 8% of what a full-day order earns. Get filled early and fail to replace, and your
            score collapses.
          </li>
          <li style={li}>
            <strong>Price quality</strong> &mdash; how close to the midpoint you quote. This one is <em>not linear</em>.
            Polymarket applies a quadratic penalty to orders further from the mid, so quoting one cent away and three
            cents away are not remotely the same. The formula deliberately drags liquidity toward the part of the book
            where trades actually happen &mdash; which is also, not coincidentally, the riskiest part.
          </li>
        </ul>
        <p style={p}>
          Scores are recalculated every minute. At midnight UTC the day&rsquo;s scores are normalised and rewards paid.
        </p>
        <h3 style={h3}>The rules that catch people out</h3>
        <ul style={{ paddingLeft: 22, marginBottom: 16 }}>
          <li style={li}>
            <strong>The $1 floor.</strong> Earn less than a dollar on a given day and you are paid nothing. It does not
            roll over. Each day stands alone. On a crowded market with a small pool, a small stake can earn zero, day
            after day.
          </li>
          <li style={li}>
            <strong>Both sides, or nothing, at the extremes.</strong> When the midpoint sits outside the
            10&cent;&ndash;90&cent; band, single-sided orders score nothing. Polymarket wants depth on both sides of a
            lopsided book.
          </li>
          <li style={li}>
            <strong>Max spread and minimum size.</strong> Each market defines how far from the midpoint an order can sit
            and still qualify, and how small it can be. Outside those, you are not an LP &mdash; you are just someone
            with an order in the book.
          </li>
        </ul>

        {/* ---- Kalshi ---- */}
        <h2 style={h2}>How Kalshi pays you</h2>
        <p style={p}>
          Kalshi&rsquo;s Liquidity Incentive Program runs on similar logic with different plumbing. Instead of scoring
          per minute, Kalshi takes a snapshot of the order book roughly once per second, timed randomly so the sampling
          cannot be gamed. Each snapshot scores your resting orders on size and how close they sit to the best bid or
          ask, and those scores accumulate through the day.
        </p>
        <p style={p}>
          The payout has the same shape: your score over everyone&rsquo;s score, times that market&rsquo;s daily pool.
          Kalshi&rsquo;s own worked example &mdash; hold 500 contracts at best bid across half the snapshots, end up
          representing 20% of qualifying liquidity in a $100 reward period, and you earn $20. Daily pools run roughly
          $10 to $1,000 per market.
        </p>
        <p style={p}>Two things worth knowing:</p>
        <ul style={{ paddingLeft: 22, marginBottom: 16 }}>
          <li style={li}>
            <strong>One-sided snapshots are thrown out.</strong> If there isn&rsquo;t enough resting size on both sides
            to meet the target at the moment of the snapshot, that snapshot counts for nobody. Two-sided quoting is not
            optional.
          </li>
          <li style={li}>
            <strong>The program has an end date.</strong> As it stands it runs to 1 September 2026, and the terms let
            Kalshi amend or terminate it at any time. Do not build a business model on it.
          </li>
        </ul>

        {/* ---- Realistic earnings ---- */}
        <h2 style={h2}>What you can realistically earn</h2>
        <p style={p}>
          This is where most guides start lying to you, so let us be concrete.
        </p>
        <p style={p}>
          The early days were genuinely lucrative. Open-source LPs running bots reported 200&ndash;300 USDC per day on
          roughly 10,000 USDC of capital at peak. Those numbers still get quoted constantly. They are years out of date.
        </p>
        <p style={p}>
          What it looks like now: one trader&rsquo;s detailed two-week postmortem concluded that rewards have become
          <em> a thin bonus on top of real trading edge rather than a standalone money printer</em>, and that a realistic
          target &mdash; running calm, long-dated markets with no imminent catalyst &mdash; is around{' '}
          <strong>10% annualised</strong>, assuming nothing dramatic happens to the position.
        </p>
        <p style={p}>
          That is a real return. It is not a get-rich scheme, and anyone quoting a guaranteed APR is either guessing or
          selling something.
        </p>
        <p style={p}>
          <strong>Why the number moved:</strong> rewards are split proportionally, so every new LP in a market makes
          everyone else&rsquo;s slice thinner. A pool that looks juicy is often juicy <em>because it is already
          crowded</em> &mdash; and a quiet pool with a small headline number can pay better simply because you are one of
          three people in it. This is the most counterintuitive thing about reward farming, and it is exactly what the{' '}
          <Link href="/lp" style={linkStyle}>LP Rewards Scanner</Link>&rsquo;s Competition flag exists to surface.
        </p>

        {/* ---- Risks ---- */}
        <h2 style={h2}>The risks nobody advertises</h2>
        <h3 style={h3}>Adverse selection</h3>
        <p style={p}>
          Your orders sit in the book. When news breaks, informed traders hit your stale quote before you can pull it.
          You get filled at exactly the wrong moment, by definition. This is not bad luck &mdash; it is structural. You
          are the person offering to trade with anyone, including the person who knows something you do not.
        </p>
        <h3 style={h3}>Inventory risk</h3>
        <p style={p}>
          Fills leave you holding a position. Near 50&cent; the two sides roughly balance. At the extremes they do not.
          Polymarket&rsquo;s own documentation gives the example: commit $100 when YES is at 90&cent;, watch YES fall to
          50&cent;, and your inventory is worth a fraction of what you paid.{' '}
          <strong>That loss can dwarf months of reward income.</strong> The rewards are small and steady. The tail risk
          is not.
        </p>
        <h3 style={h3}>It is not passive</h3>
        <p style={p}>
          A fast-moving book pushes your orders out of the qualifying band, where they stop earning. Staying in the band
          means re-posting, constantly. Anyone describing this as passive yield has not done it.
        </p>
        <h3 style={h3}>Capital lock-up and program risk</h3>
        <p style={p}>
          Money in resting orders is money doing nothing else &mdash; weigh the reward against what that capital would
          earn elsewhere, including simply holding stablecoins. And these are promotional programs, not obligations.
          Kalshi&rsquo;s terms reserve the right to terminate; Polymarket adjusts pools continuously. The return you
          model today can be a third of that next quarter because the platform changed the numbers. Both programs are
          also region-restricted &mdash; check your eligibility before planning anything.
        </p>

        {/* ---- Finding a market ---- */}
        <h2 style={h2}>How to find a market worth providing liquidity in</h2>
        <p style={p}>
          The mechanics above tell you how you get paid. Choosing <em>where</em> to post is the whole game, and it comes
          down to five variables:
        </p>
        <ul style={{ paddingLeft: 22, marginBottom: 16 }}>
          <li style={li}><strong>Pool size</strong> &mdash; how much is paid out daily.</li>
          <li style={li}>
            <strong>Competition</strong> &mdash; how many people split it. High volume relative to the pool is a warning
            sign, not a green light.
          </li>
          <li style={li}>
            <strong>Price band</strong> &mdash; markets nearer the middle let you quote both sides without accumulating
            brutal one-sided inventory. The extremes are where LPs get hurt.
          </li>
          <li style={li}>
            <strong>Spread health</strong> &mdash; a book that is already tight leaves little room to earn; a book that
            is wildly wide is wide <em>for a reason</em>, usually volatility.
          </li>
          <li style={li}>
            <strong>Time to resolution</strong> &mdash; long-dated, low-catalyst markets move slowly, which means fewer
            adverse fills and less re-posting.
          </li>
        </ul>
        <p style={p}>
          Checking all five by hand, across hundreds of markets, is not realistic. That is what the{' '}
          <Link href="/lp" style={linkStyle}>Predacle LP Rewards Scanner</Link> does. It pulls every reward-eligible
          market, drops the ones no LP should touch, and ranks what is left by an LP Score built from exactly those
          variables. It flags contested pools so you do not walk into a crowded one, and it estimates a range for a
          stake you choose rather than inventing a precise APR.
        </p>
        <p style={p}>
          One thing it deliberately does <strong>not</strong> do is promise you a number. Polymarket does not publish
          total in-band LP liquidity, which means nobody &mdash; no tool, free or paid &mdash; can tell you your exact
          share in advance.
        </p>

        {/* ---- Workflow ---- */}
        <h2 style={h2}>A sane workflow</h2>
        <ol style={{ paddingLeft: 22, marginBottom: 16 }}>
          <li style={li}>
            Scan for a decent pool with <strong>low competition</strong>, in a middle price band, with weeks rather than
            hours to run.
          </li>
          <li style={li}>
            Estimate your range for the stake you actually intend to post. Be honest about the $1 daily floor &mdash; a
            small stake in a busy market can earn nothing at all.
          </li>
          <li style={li}>
            Check the live order book <em>on the platform</em> before committing. Predacle refreshes every 30 minutes; a
            book moves faster than that.
          </li>
          <li style={li}>Post both sides. Keep them in the band. Expect to re-post.</li>
          <li style={li}>Size so that an adverse fill you have to hold to resolution is survivable.</li>
        </ol>
        <p style={p}>
          Predacle is a research tool. It does not hold funds, place orders, or trade on your behalf &mdash; and you
          should never give any site your wallet&rsquo;s private key to &ldquo;automate&rdquo; LP rewards. Once you have
          found the market, you execute on Polymarket or Kalshi yourself.
        </p>

        {/* ---- FAQ (visible; also emitted as FAQPage schema above) ---- */}
        <h2 style={h2}>Frequently asked questions</h2>
        {faqs.map(([q, a], i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{q}</h3>
            <p style={{ lineHeight: 1.7, opacity: 0.9 }}>{a}</p>
          </div>
        ))}

        {/* ---- CTA ---- */}
        <div style={{ marginTop: 28, padding: '18px 20px', borderRadius: 12, background: 'rgba(0,82,255,0.06)', border: '1px solid rgba(0,82,255,0.18)' }}>
          <strong style={{ fontWeight: 700 }}>Find a market:</strong>{' '}
          Open the <Link href="/lp" style={linkStyle}>LP Rewards Scanner</Link> to see reward-eligible markets ranked by
          pool size, competition, price band, spread health and time to resolution &mdash; and estimate a realistic range
          for the stake you have in mind.
        </div>

        <p style={{ marginTop: 22, fontSize: 13, opacity: 0.7, lineHeight: 1.6 }}>
          Not financial advice. Providing liquidity involves a real risk of loss, including losses larger than the
          rewards you earn. Figures cited reflect Polymarket and Kalshi program documentation and reported data at the
          time of writing; both programs can change at any time.
        </p>
      </ContentPage>
    </>
  )
}
