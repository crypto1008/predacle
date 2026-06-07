// arb-edge.mjs
// Drop-in replacement for the naive `100 - cheapestA - cheapestB` edge calc.
//
// Three principles the old version violated:
//   1. Use the ASK you'd actually PAY to buy each side. Never derive a side as (1 - p).
//      The (1 - p) complement is spread-free by construction and manufactures phantom edge.
//   2. Subtract each venue's fees, per leg.
//   3. Only report an edge after a slippage / safety buffer it must clear.

/** Fee models. Prices are dollars in [0,1] for a contract that pays $1 if it resolves YES.
 *  These change — VERIFY against each venue's current published schedule before trusting. */
export const FEES = {
  // Kalshi taker fee ≈ 0.07 * contracts * P * (1-P), rounded UP to the cent (per order).
  // Note the ceil-to-cent floor: on 1 contract any nonzero raw fee becomes $0.01,
  // which alone dwarfs a 0.5% "edge".
  kalshi: (price, contracts = 1) =>
    Math.ceil(0.07 * contracts * price * (1 - price) * 100) / 100,
  // Polymarket: no per-trade fee historically, but you still pay gas / settlement.
  // Model it as a small fixed cost if you want to be conservative.
  polymarket: (_price, _contracts = 1) => 0.0,
};

/**
 * @typedef {Object} Quote
 * @property {string}  venue      "kalshi" | "polymarket" | ...
 * @property {number}  ask        REAL cost to BUY this side, dollars in [0,1]. Required.
 * @property {number}  [askSize]  contracts available at that ask (top-of-book depth).
 * @property {boolean} [implied]  true if this was derived as (1 - otherSide).
 *                                Implied quotes are NOT executable and are excluded.
 */

/** Cheapest *executable* cost for one leg: real ask + per-contract fee, with depth check.
 *  Returns null if no tradeable (non-implied, deep-enough) ask exists. */
function bestLeg(quotes, contracts) {
  let best = null;
  for (const q of quotes) {
    if (q.implied || q.ask == null) continue;                 // never "trade" a 1-p synthetic
    if (q.askSize != null && q.askSize < contracts) continue; // not enough depth at top
    const feeFn = FEES[q.venue] ?? (() => 0);
    const cost = q.ask + feeFn(q.ask, contracts) / contracts; // per-contract, fee included
    if (best === null || cost < best.cost) best = { ...q, cost };
  }
  return best;
}

/**
 * Real arbitrage edge for a binary matchup (player A vs player B).
 * You buy one A and one B; exactly one resolves, paying $1. Arb exists iff total cost < $1.
 *
 * @param {Quote[]} sideA  real asks for A across venues
 * @param {Quote[]} sideB  real asks for B across venues
 * @param {{contracts?: number, slippage?: number}} [opts]
 *        contracts: size you actually intend to fill (affects depth + fee rounding)
 *        slippage : safety margin in dollars the gross edge must beat (0.01 = 1%)
 */
export function arbEdge(sideA, sideB, { contracts = 1, slippage = 0.01 } = {}) {
  const a = bestLeg(sideA, contracts);
  const b = bestLeg(sideB, contracts);
  if (!a || !b) return { tradeable: false, reason: "no real ask on one/both sides" };

  const totalCost = a.cost + b.cost; // dollars to own one of each
  const grossEdge = 1 - totalCost;   // profit per contract before buffer
  const netEdge = grossEdge - slippage;

  return {
    tradeable: netEdge > 0,
    grossEdge,                                   // 0.005 = 0.5%
    netEdge,
    totalCost,
    legA: a,
    legB: b,
    venues: a.venue === b.venue ? "same-venue" : "cross-platform",
  };
}

// ---------------------------------------------------------------------------
// Demo with your two flagged matchups, using REAL asks for both sides
// (no 1-p complement). Replace these literals with live order-book asks.
if (import.meta.url === `file://${process.argv[1]}`) {
  const fmt = (r) =>
    r.tradeable
      ? `TRADE  net=${(r.netEdge * 100).toFixed(2)}%  (${r.venues})`
      : `skip   gross=${((r.grossEdge ?? -1) * 100).toFixed(2)}%  ${r.reason ?? r.venues}`;

  // Mensik vs Zverev — poly quotes BOTH tokens for real; they sum to ~1.01 (the spread).
  console.log("mensik/zverev :",
    fmt(arbEdge(
      [{ venue: "polymarket", ask: 0.02 }, { venue: "kalshi", ask: 0.02 }], // mensik
      [{ venue: "polymarket", ask: 0.99 }, { venue: "kalshi", ask: 0.99 }], // zverev
    )));

  // Arnaldi vs Cobolli
  console.log("arnaldi/cobolli:",
    fmt(arbEdge(
      [{ venue: "kalshi", ask: 0.32 }, { venue: "polymarket", ask: 0.33 }], // arnaldi
      [{ venue: "kalshi", ask: 0.69 }, { venue: "polymarket", ask: 0.68 }], // cobolli
    )));
}
