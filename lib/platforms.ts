// lib/platforms.ts
// -----------------------------------------------------------------------------
// Curated, verified facts about each prediction-market platform, used to compose
// /compare/[a]-vs-[b] pages. Two correctness rules keep these pages trustworthy
// as the space changes:
//
//   1. DURABLE facts only are hardcoded here — structural things that rarely
//      change (regulator, settlement rail, money type, what a platform is for).
//   2. VOLATILE facts (exact fee %, current volume, valuations, per-state
//      availability) are deliberately NOT pinned to precise numbers, because
//      they move quickly. We state them qualitatively and let the live page pull
//      real-time counts from our own database. A stale precise number is worse
//      than an honest qualitative one.
//
// `platform` keys MUST match the DB `platform` value. Note azuro displays as
// "Bookmaker" in the UI but its key/value stays `azuro`.
//
// Sources: own vetted compare page (2026) + public reporting (CFTC filings,
// Congressional Research Service, platform docs) as of mid-2026. Review before
// relying on any single line; the space shifts.
// -----------------------------------------------------------------------------

export type PlatformKey =
  | 'polymarket' | 'kalshi' | 'manifold' | 'myriad' | 'limitless' | 'azuro'

export interface PlatformFacts {
  key: PlatformKey
  /** UI display name (azuro -> "Bookmaker"). */
  label: string
  /** One-line positioning. */
  tagline: string
  /** Real money or play money — the single most important distinction. */
  money: 'real' | 'play'
  /** Durable structural facts (regulator / legal posture). */
  regulation: string
  /** How you fund and settle. */
  funding: string
  /** What the platform is known for / its coverage lean. */
  coverage: string
  /** Fees — qualitative, never a pinned percentage that can rot. */
  fees: string
  /** Who it suits best. */
  bestFor: string
  /** External site for "verify current details". */
  site: string
  /** If true, this platform appears in "vs" comparison pages. */
  comparable: boolean
  /** Optional prominent warning the template must surface (e.g. play money). */
  caveat?: string
}

export const PLATFORMS: Record<PlatformKey, PlatformFacts> = {
  polymarket: {
    key: 'polymarket',
    label: 'Polymarket',
    tagline: 'The largest crypto-native prediction market, now with a US regulated path.',
    money: 'real',
    regulation:
      'Crypto-native and originally offshore; acquired the CFTC-licensed exchange QCEX to re-enter the US, giving it a dual structure (a global platform plus a CFTC-regulated US venue).',
    funding: 'USDC stablecoin, settled on the Polygon blockchain (global); USD-style flow on the US venue.',
    coverage:
      'Deep liquidity on major political, macro, crypto and cultural events; broad and fast-moving market creation.',
    fees:
      'Historically low, especially on the global platform, with some categories fee-free and others fee-bearing; structure has changed over time, so check current rates on-platform.',
    bestFor: 'Crypto-comfortable and experienced traders who want depth and breadth of events.',
    site: 'https://polymarket.com',
    comparable: true,
  },

  kalshi: {
    key: 'kalshi',
    label: 'Kalshi',
    tagline: 'A US-regulated event-contract exchange built on traditional financial rails.',
    money: 'real',
    regulation:
      'CFTC-regulated as a Designated Contract Market (DCM), with an affiliated clearing organization — the same regulatory footing as conventional futures exchanges. Some sports/event categories still face state-level legal challenges.',
    funding: 'US dollars via bank/ACH, debit card, or wire; customer funds held in segregated US accounts.',
    coverage:
      'Strong economic, financial and political coverage (CPI, rates, elections) and heavy sports volume; markets cleared through CFTC review.',
    fees:
      'Tied to the contract price (a maker–taker model); peaks for mid-probability contracts and falls toward the extremes. Check current rates on-platform.',
    bestFor: 'Beginners, US bank users, and anyone who values regulatory clarity and USD custody.',
    site: 'https://kalshi.com',
    comparable: true,
  },

  myriad: {
    key: 'myriad',
    label: 'Myriad',
    tagline: 'A media-linked prediction market tied to news and current events.',
    money: 'real',
    regulation: 'Crypto-native prediction market; not a CFTC-regulated US exchange.',
    funding: 'On-chain settlement.',
    coverage: 'News-driven and current-events markets, often tied to media coverage.',
    fees: 'See platform for current details.',
    bestFor: 'Readers who want to trade on the news cycle.',
    site: 'https://myriad.markets',
    comparable: true,
  },

  limitless: {
    key: 'limitless',
    label: 'Limitless',
    tagline: 'Fast, automated short-term crypto price markets.',
    money: 'real',
    regulation: 'Crypto-native, on-chain; not a CFTC-regulated US exchange.',
    funding: 'On-chain settlement.',
    coverage:
      'Primarily short-term, automated crypto price markets (e.g. whether a coin is above a level at a set time) rather than longer-horizon events.',
    fees: 'See platform for current details.',
    bestFor: 'Traders focused on short-horizon crypto price moves.',
    site: 'https://limitless.exchange',
    comparable: true,
  },

  azuro: {
    key: 'azuro',
    // Displayed as "Bookmaker" in the UI; DB key stays 'azuro'.
    label: 'Bookmaker',
    tagline: 'On-chain sports and event markets via the Azuro protocol.',
    money: 'real',
    regulation: 'Decentralized, on-chain betting protocol; not a CFTC-regulated US exchange.',
    funding: 'On-chain settlement.',
    coverage: 'Sports and event markets sourced through the Azuro protocol.',
    fees: 'See platform for current details.',
    bestFor: 'On-chain users who want sports and event coverage.',
    site: 'https://azuro.org',
    comparable: true,
  },

  manifold: {
    key: 'manifold',
    label: 'Manifold',
    tagline: 'A play-money prediction market where anyone can create a question.',
    money: 'play',
    regulation: 'Play-money platform — not a financial exchange and not CFTC-regulated.',
    funding: 'Uses play-money "mana", not real currency, so positions carry no monetary value.',
    coverage:
      'A huge, user-created long tail of questions across every topic, plus forecasting-community markets.',
    fees: 'No real-money fees — it is a play-money platform.',
    bestFor: 'Forecasters and hobbyists who want to test calibration without risking money.',
    site: 'https://manifold.markets',
    comparable: true,
    caveat:
      'Manifold uses play-money "mana", not real currency. Prices reflect forecasting interest, not money at risk, so a head-to-head with a real-money platform is not a like-for-like trading choice — treat it as a forecasting signal, not a place to put real capital against the other.',
  },
}

/** Ordered list for building pair routes. */
export const PLATFORM_KEYS: PlatformKey[] = [
  'polymarket', 'kalshi', 'myriad', 'limitless', 'azuro', 'manifold',
]

export function getPlatform(key: string): PlatformFacts | null {
  return (PLATFORMS as Record<string, PlatformFacts>)[key] || null
}

/** Display label for a platform key (azuro -> "Bookmaker"). */
export function platformLabel(key: string): string {
  return getPlatform(key)?.label || key
}
