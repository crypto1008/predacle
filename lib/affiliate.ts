// lib/affiliate.ts
// ---------------------------------------------------------------------------
// Central place to append affiliate / referral codes to outbound market links.
//
// Codes are read from NEXT_PUBLIC_* env vars so they:
//   1) work client-side (the Trade/View buttons open links in the browser), and
//   2) are flippable config — add, change, or remove a code by editing the env
//      var and redeploying, with no code change.
//
// A platform with no code configured passes through UNCHANGED, so this is safe
// to wire in everywhere now and activate per-platform as codes arrive.
// ---------------------------------------------------------------------------

// Per-platform referral config.
//   param = the query-string key that platform uses for referrals
//   code  = the value, pulled from env (undefined until you set it)
//
// NOTE: platform keys here must match the DB `platform` value. Bookmaker.xyz is
// stored as 'azuro' (only the UI label says "Bookmaker"), so its slot is 'azuro'.
const REF_CONFIG: Record<string, { param: string; code: string | undefined }> = {
  polymarket: { param: 'r',        code: process.env.NEXT_PUBLIC_POLYMARKET_REF },
  kalshi:     { param: 'referral', code: process.env.NEXT_PUBLIC_KALSHI_REF },

  // Bookmaker.xyz (Azuro) — fill in once they reply with how they want
  // referrals attributed. If it's a simple query param, just set param + the
  // NEXT_PUBLIC_AZURO_REF env var below and uncomment. If they use an Azuro
  // affiliate wallet address or a custom link/path instead, tell me and I'll
  // add a custom transform for it (a plain param won't fit that case).
  // azuro:   { param: 'ref',      code: process.env.NEXT_PUBLIC_AZURO_REF },
}

/**
 * Returns the outbound URL with the platform's referral code appended.
 * Falls back to the original URL whenever there's no code, no platform match,
 * or the URL can't be parsed — so it can never break a Trade button.
 */
export function affiliateUrl(
  platform: string | null | undefined,
  url: string | null | undefined,
): string {
  if (!url) return url || ''
  if (!platform) return url

  const cfg = REF_CONFIG[platform]
  if (!cfg || !cfg.code) return url // no code configured → pass through

  try {
    const u = new URL(url)
    if (u.searchParams.has(cfg.param)) return url // don't double-append
    u.searchParams.set(cfg.param, cfg.code)
    return u.toString()
  } catch {
    // Non-absolute / unparseable URL → manual append as a fallback.
    if (url.includes(`${cfg.param}=`)) return url
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}${cfg.param}=${encodeURIComponent(cfg.code)}`
  }
}

/** True if we currently have an active referral code for this platform. */
export function hasAffiliate(platform: string | null | undefined): boolean {
  if (!platform) return false
  const cfg = REF_CONFIG[platform]
  return !!(cfg && cfg.code)
}
