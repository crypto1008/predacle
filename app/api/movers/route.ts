import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RECENT_MS = 24 * 60 * 60 * 1000   // only surface sentiment from the last 24h
const CLUSTER_CAP = 3                    // max cards from one news cluster (e.g. the Iran story)

// Entities used to group near-duplicate markets into one "story". First match wins;
// markets matching none get their own cluster (never capped).
const TOPIC_ENTITIES = [
  'iran', 'israel', 'gaza', 'hezbollah', 'lebanon', 'hormuz', 'ukraine', 'russia',
  'china', 'taiwan', 'venezuela', 'north korea', 'korea', 'syria', 'sudan',
  'trump', 'biden', 'starmer', 'putin', 'zelensky', 'netanyahu', 'modi', 'maduro',
  'fed', 'inflation', 'recession', 'powell',
  'bitcoin', 'ethereum', 'solana', ' xrp', 'dogecoin',
  'openai', 'google', 'apple', 'tesla', 'nvidia', 'spacex',
  'election', 'senate', 'congress', 'supreme court', 'shutdown',
]
function clusterKey(question: string, id: string): string {
  const q = ' ' + question.toLowerCase() + ' '
  for (const e of TOPIC_ENTITIES) if (q.includes(e)) return e.trim()
  return id   // unique — its own cluster
}

// Sub-markets of one event (e.g. the several "where will the US-Iran meeting be"
// outcomes) share a single event URL — collapse them to the biggest mover.
function eventKey(url: string): string {
  try { return new URL(url).pathname.replace(/\/+$/, '') } catch { return url || Math.random().toString() }
}

// Belt-and-braces: drop any game/match rows that may predate the cron filter.
function looksLikeGame(q: string): boolean {
  return /\bvs\.?\b/i.test(q)
    || /\bwin on \d{4}-\d{2}-\d{2}/i.test(q)
    || /^\s*spread:/i.test(q)
    || /\(bo\d\)/i.test(q)
    || /\bto (score|assist)\b/i.test(q)
}

export async function GET() {
  const since = new Date(Date.now() - RECENT_MS).toISOString()

  const { data: sent } = await supabaseAdmin
    .from('market_sentiment')
    .select('market_id, stance, score, why, drivers, move_24h, headline_count, generated_at')
    .gte('generated_at', since)
    .order('generated_at', { ascending: false })
    .limit(40)
  if (!sent || sent.length === 0) return NextResponse.json({ movers: [], generatedAt: null })

  const ids = sent.map((s: any) => s.market_id)

  const { data: mkts } = await supabaseAdmin
    .from('markets')
    .select('id, platform, question, probability, category, url')
    .in('id', ids)
  const mById: Record<string, any> = {}
  for (const m of (mkts || [])) mById[m.id] = m

  const { data: news } = await supabaseAdmin
    .from('market_news')
    .select('market_id, title, source, url, published_at')
    .in('market_id', ids)
    .order('published_at', { ascending: false, nullsFirst: false })
  const newsByMarket: Record<string, any[]> = {}
  for (const n of (news || [])) {
    (newsByMarket[n.market_id] ||= [])
    if (newsByMarket[n.market_id].length < 3) newsByMarket[n.market_id].push(n)
  }

  const ranked = sent
    .map((s: any) => {
      const m = mById[s.market_id]
      if (!m) return null
      if ((m.category || '').toLowerCase() === 'sports' || looksLikeGame(m.question)) return null
      return {
        id: s.market_id,
        platform: m.platform,
        question: String(m.question || '').trim(),
        probability: m.probability,
        url: m.url,
        stance: s.stance,
        score: s.score,
        why: s.why,
        drivers: Array.isArray(s.drivers) ? s.drivers : [],
        move: s.move_24h,
        headlines: newsByMarket[s.market_id] || [],
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => Math.abs(b.move) - Math.abs(a.move))

  // 1) Collapse exact duplicate sub-markets of one event (they share an event URL).
  const seenEvent = new Set<string>()
  const deduped: any[] = []
  for (const m of ranked) {
    if (!m) continue
    const ek = eventKey(m.url)
    if (seenEvent.has(ek)) continue
    seenEvent.add(ek)
    deduped.push(m)
  }

  // 2) Cap how many cards one story can contribute, so a single mega-event
  //    can't fill the whole feed.
  const perCluster: Record<string, number> = {}
  const movers: any[] = []
  for (const m of deduped) {
    const key = clusterKey(m.question, m.id)
    if ((perCluster[key] || 0) >= CLUSTER_CAP) continue
    perCluster[key] = (perCluster[key] || 0) + 1
    movers.push(m)
    if (movers.length >= 9) break
  }

  return NextResponse.json({ movers, generatedAt: sent[0]?.generated_at || null })
}
