import type { Metadata } from 'next'
import ContentPage from '../../components/ContentPage'

export const metadata: Metadata = {
  title: 'How Prediction Market LP Rewards Work (Polymarket & Kalshi)',
  description:
    'A plain-English guide to liquidity provider (LP) rewards on prediction markets: how the daily reward pool works, why your share isn’t guaranteed, how to estimate your earnings, and the real risks of providing liquidity on Polymarket and Kalshi.',
  alternates: { canonical: '/guides/lp-rewards' },
  keywords: [
    'polymarket lp rewards',
    'prediction market liquidity provider',
    'maximize liquidity rewards',
    'how to provide liquidity polymarket',
    'kalshi liquidity rewards',
    'lp rewards calculator',
  ],
}

const sections: [string, string[]][] = [
  [
    'What are LP rewards?',
    [
      'Prediction markets like Polymarket and Kalshi want tight, liquid order books so traders can get in and out easily. To encourage that, they pay liquidity providers (LPs) — people who post resting buy and sell orders near a market’s midpoint — out of a daily reward pool. You earn a share of that pool for keeping orders on the book, whether or not those orders ever fill.',
      'It is a fundamentally different activity from betting. A bettor takes a directional position and wins or loses on the outcome. An LP is paid for providing the liquidity that makes the market function, and earns rewards continuously while their orders sit in the reward band.',
    ],
  ],
  [
    'How the reward pool works',
    [
      'Each eligible market has a daily reward pool (a fixed dollar amount per day on Polymarket) and a reward band — a spread around the midpoint within which your orders must sit to qualify. The pool is split among all LPs in proportion to how much qualifying liquidity each one is providing.',
      'That last point is the one everyone misses: the advertised number is the market’s total pool, not your guaranteed payout. If you provide 5% of the qualifying liquidity, you earn roughly 5% of the pool. The more capital other LPs bring, the thinner your slice.',
    ],
  ],
  [
    'Why your exact share is unknowable (and how to estimate it)',
    [
      'Polymarket does not publish the total in-band LP liquidity in a market, so no tool — free or paid — can tell you your exact share with certainty. Anyone promising a precise guaranteed APR is guessing and hiding it.',
      'The honest approach is to estimate a range. Predacle’s LP scanner infers how contested each pool is (from trading volume relative to the reward pool) and turns that into a conservative / typical / optimistic estimate of your daily reward and APR for a stake you choose. Use it on any Polymarket opportunity in the LP Rewards Scanner, or on an individual market page.',
    ],
  ],
  [
    'The real risks of providing liquidity',
    [
      'Inventory (directional) risk: your resting orders fill on whichever side the market moves. Near 50\u00a2 that stays roughly balanced; at extreme prices you can accumulate one-sided inventory you must hold until the market resolves — and if it resolves against you, that loss can dwarf the rewards.',
      'Spread and repricing: a wide or fast-moving book means you must actively re-post orders to stay in the reward band. LP rewards are not passive yield; they require attention.',
      'Time and eligibility: your capital is committed until you withdraw or the market resolves, and LP programs are region-restricted — always verify your eligibility and the live order book on the platform itself.',
    ],
  ],
  [
    'How to actually do it',
    [
      'Predacle is a research and decision-support tool — it does not hold funds, place orders, or trade on your behalf, and you should never give any site your wallet private key to “automate” LP rewards. Once you have found a market worth providing liquidity in and understand the risks, you place and manage the orders yourself on Polymarket or Kalshi.',
      'A sensible workflow: scan for high-reward, low-competition pools in the sweet-spot price band, estimate your range for the stake you have in mind, weigh the risk profile, then execute directly on the platform. Not financial advice.',
    ],
  ],
]

export default function LpRewardsGuide() {
  return (
    <ContentPage
      title="How Prediction Market LP Rewards Work"
      intro="Liquidity providers earn a share of a daily reward pool for posting resting orders near a market’s midpoint. Here is how the rewards work, how to estimate what you would earn, and the risks nobody advertises, for Polymarket and Kalshi."
    >
      {sections.map(([h, paras], i) => (
        <div key={i} style={{ marginBottom: 30 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{h}</h2>
          {paras.map((p, j) => (
            <p key={j} style={{ marginBottom: 12 }}>{p}</p>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 8, padding: '16px 18px', borderRadius: 12, background: 'rgba(0,82,255,0.06)', border: '1px solid rgba(0,82,255,0.18)' }}>
        <strong style={{ fontWeight: 700 }}>Try it:</strong>{' '}
        Open the <a href="/lp" style={{ color: '#0052ff', fontWeight: 600, textDecoration: 'none' }}>LP Rewards Scanner</a>{' '}
        to see ranked opportunities and estimate your reward range on any market.
      </div>
    </ContentPage>
  )
}
