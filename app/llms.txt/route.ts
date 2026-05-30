const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

export const revalidate = 86400 // regenerate once a day

export async function GET() {
  const body = `# Predacle

> Predacle aggregates live prediction-market data from six platforms (Polymarket, Kalshi, Myriad, Manifold, Limitless, and Azuro/Bookmaker) into one place — with consensus probabilities, cross-platform odds comparison, trading volumes, closing dates, and AI-generated market analysis.

## What Predacle provides
- Live probability for thousands of prediction markets, updated continuously
- Side-by-side odds for the same event across multiple platforms
- Trading volume, trader counts, and closing dates for each market
- AI market summaries with bullish / bearish / neutral signals

## Key pages
- [All markets](${BASE}/markets): browse and filter every tracked market
- [Homepage](${BASE}): overview and trending markets

## Notes
- Each market has its own page at ${BASE}/markets/{id} with the current probability, a cross-platform odds comparison, and an AI analysis.
- Data is aggregated from public prediction-market sources. Predacle is an aggregator and does not itself offer trading. Nothing on the site is financial advice.
`
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
