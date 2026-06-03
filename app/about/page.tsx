import type { Metadata } from 'next'
import ContentPage from '../components/ContentPage'

export const metadata: Metadata = {
  title: 'About',
  description: 'Predacle is a prediction market aggregator bringing together live odds from Polymarket, Kalshi, Myriad, Manifold, Limitless and Azuro into one place.',
}

const paragraphs = [
  "Predacle is a prediction market aggregator. We bring together live markets from six platforms — Polymarket, Kalshi, Myriad, Manifold, Limitless, and Azuro — into a single place, so you can see what the world is forecasting without juggling six different sites.",
  "Prediction markets turn real money and real conviction into probabilities. When thousands of people put money behind their beliefs about an election, a sporting result, or a crypto price, the resulting odds are often a sharper signal than polls or pundits. The catch is that these markets are scattered across many platforms, each with its own interface and its own slice of the action. Predacle pulls them together.",
  "For every market we track, you can see the current probability, trading volume, how the same question is priced across different platforms, and an AI-generated summary of what is driving the odds. We do not take bets or hold funds — when you want to trade, we send you to the source platform.",
  "Predacle is built for traders comparing odds across venues, researchers and journalists looking for forecast data, and anyone curious about what the markets think will happen next.",
]

export default function AboutPage() {
  return (
    <ContentPage title="About Predacle" intro="The prediction market aggregator — every market, every platform, one place.">
      {paragraphs.map((p, i) => <p key={i} style={{ marginBottom: 18 }}>{p}</p>)}
    </ContentPage>
  )
}
