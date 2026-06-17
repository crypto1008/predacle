import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Platform accuracy leaderboard.
//
// For every resolved BINARY market we have the true outcome (resolved_outcome
// YES/NO) and the last pre-resolution price (final_probability = P(YES)). That
// lets us score each platform's forecasting quality:
//   - brier            mean (p - y)^2          lower = sharper       [primary rank]
//   - accuracy         P(favoured side won)    directional hit-rate  [intuitive]
//   - calibrationError ECE: how far "60%" is from actually hitting 60%
//   - curve            10 buckets of predicted vs actual, for the chart
// SCALAR / UNCLEAR resolutions are non-binary and excluded.

const MIN_SAMPLE = 100          // don't rank a platform until it has enough history
const NB = 10                   // calibration buckets (deciles)
const EPS = 1e-6

interface Row { platform: string; p: number; y: number }

export async function GET() {
  try {
    // Pull only the three fields we need, paginated past Supabase's 1k row cap.
    const rows: Row[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabaseAdmin
        .from('market_resolutions')
        .select('platform, final_probability, resolved_outcome')
        .in('resolved_outcome', ['YES', 'NO'])
        .not('final_probability', 'is', null)
        .range(from, from + PAGE - 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data || data.length === 0) break
      for (const r of data as any[]) {
        const p = Number(r.final_probability)
        if (!isFinite(p)) continue
        rows.push({ platform: r.platform, p, y: r.resolved_outcome === 'YES' ? 1 : 0 })
      }
      if (data.length < PAGE) break
    }

    const byPlatform = new Map<string, Row[]>()
    for (const r of rows) {
      if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, [])
      byPlatform.get(r.platform)!.push(r)
    }

    const platforms = []
    for (const [platform, arr] of byPlatform) {
      const n = arr.length
      if (n < MIN_SAMPLE) continue

      let brier = 0, logloss = 0, hits = 0, sumP = 0, sumY = 0
      const buckets = Array.from({ length: NB }, () => ({ sumP: 0, sumY: 0, n: 0 }))

      for (const { p, y } of arr) {
        brier += (p - y) ** 2
        const pc = Math.min(1 - EPS, Math.max(EPS, p))
        logloss += -(y * Math.log(pc) + (1 - y) * Math.log(1 - pc))
        if ((p >= 0.5 ? 1 : 0) === y) hits++
        sumP += p; sumY += y
        let bi = Math.floor(p * NB)
        if (bi >= NB) bi = NB - 1
        if (bi < 0) bi = 0
        buckets[bi].sumP += p; buckets[bi].sumY += y; buckets[bi].n++
      }

      let ece = 0
      const curve = buckets.map((b, i) => {
        const predicted = b.n ? b.sumP / b.n : null
        const actual = b.n ? b.sumY / b.n : null
        if (b.n) ece += Math.abs(predicted! - actual!) * (b.n / n)
        return {
          lo: i / NB,
          hi: (i + 1) / NB,
          n: b.n,
          predicted: predicted != null ? +predicted.toFixed(4) : null,
          actual: actual != null ? +actual.toFixed(4) : null,
        }
      })

      platforms.push({
        platform,
        n,
        brier: +(brier / n).toFixed(4),
        logloss: +(logloss / n).toFixed(4),
        accuracy: +(hits / n).toFixed(4),
        calibrationError: +ece.toFixed(4),
        avgPred: +(sumP / n).toFixed(4),
        yesRate: +(sumY / n).toFixed(4),
        curve,
      })
    }

    platforms.sort((a, b) => a.brier - b.brier)

    return NextResponse.json({
      platforms,
      totalResolved: rows.length,
      minSample: MIN_SAMPLE,
      method: 'final_probability (last pre-resolution price) vs resolved_outcome; binary markets only (SCALAR/UNCLEAR excluded); lower Brier = sharper',
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to build leaderboard', detail: error.message }, { status: 500 })
  }
}
