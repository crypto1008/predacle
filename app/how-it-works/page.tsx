import type { Metadata } from 'next'
import ContentPage from '../components/ContentPage'

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'How Predacle aggregates live prediction market odds from six platforms, updates them continuously, and compares the same market across venues.',
}

const steps: [string, string][] = [
  ["We pull from six platforms", "Roughly every 30 minutes, Predacle fetches active markets from Polymarket, Kalshi, Myriad, Manifold, Limitless, and Azuro. Each platform exposes its markets differently, so we normalize them into one consistent format."],
  ["We match the same question across venues", "When the same event trades on more than one platform, we group those markets so you can compare the odds side by side and spot disagreements between venues."],
  ["We add context and analysis", "For each market we show trading volume, trader counts where available, closing dates, and an AI-generated summary that explains what the probability implies and whether the signal looks bullish or bearish."],
  ["You trade on the source platform", "Predacle is an aggregator, not a broker. We never hold funds or take bets. When you are ready to act, we link you straight to the market on its original platform."],
]

export default function HowItWorksPage() {
  return (
    <ContentPage title="How It Works" intro="Predacle reads the prediction markets so you do not have to check six sites.">
      {steps.map(([h, b], i) => (
        <div key={i} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>{`${i + 1}. ${h}`}</h2>
          <p>{b}</p>
        </div>
      ))}
    </ContentPage>
  )
}
