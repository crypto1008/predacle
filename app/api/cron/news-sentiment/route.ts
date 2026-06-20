import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 60

// ─── Tunables ───
const MOVE_THRESHOLD = 0.07                 // a >=7pt probability move over ~24h = a "mover"
const CANDIDATE_POOL = 300                  // top active markets by volume to consider
const MAX_MOVERS     = 20                   // cap sentiment work per run
const NEWS_PER_MARKET = 5
const NEWS_FRESH_MS  = 6 * 60 * 60 * 1000   // re-pull news at most every 6h
const SENT_FRESH_MS  = 6 * 60 * 60 * 1000   // re-score sentiment at most every 6h
// v1 focuses on the two biggest real-money venues — best volume signal and best
// news coverage. Others can be added once this is proven.
const POOL_PLATFORMS = ['polymarket', 'kalshi']

interface NewsItem { title: string; url: string; source: string; published_at: string | null }

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim()
}

// Minimal Google News RSS parser (no XML lib needed).
function parseGoogleNewsRss(xml: string, limit: number): NewsItem[] {
  const items: NewsItem[] = []
  const blocks = xml.split('<item>').slice(1)
  for (const raw of blocks) {
    const end = raw.indexOf('</item>')
    const seg = end >= 0 ? raw.slice(0, end) : raw
    const title  = decodeEntities(seg.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '')
    const link   = decodeEntities(seg.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '')
    const pub    = (seg.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '').trim()
    const source = decodeEntities(seg.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || '')
    let cleanTitle = title
    if (source && cleanTitle.endsWith(` - ${source}`)) cleanTitle = cleanTitle.slice(0, -(source.length + 3)).trim()
    if (!cleanTitle || !link) continue
    let publishedAt: string | null = null
    if (pub) { const d = new Date(pub); if (!isNaN(d.getTime())) publishedAt = d.toISOString() }
    items.push({ title: cleanTitle, url: link, source: source || 'News', published_at: publishedAt })
    if (items.length >= limit) break
  }
  return items
}

// Turn a market question into a focused news search query.
function newsQuery(question: string): string {
  return question
    .replace(/^will\s+/i, '')
    .replace(/\?+\s*$/g, '')
    .replace(/\s+by\b[\s\S]*$/i, '')        // drop trailing "by <date>" — too specific for news
    .replace(/\s+at their\b[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ').slice(0, 10).join(' ')
}

async function fetchNews(question: string): Promise<NewsItem[]> {
  const q = newsQuery(question)
  if (!q) return []
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
    if (!r.ok) return []
    const xml = await r.text()
    const items = parseGoogleNewsRss(xml, NEWS_PER_MARKET)
    const cutoff = Date.now() - 10 * 86400000   // keep last ~10 days only
    return items.filter(i => !i.published_at || new Date(i.published_at).getTime() >= cutoff)
  } catch { return [] }
}

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const apiKey = process.env.GEMINI_API_KEY
  const now = Date.now()

  // 1) Candidate pool — top active markets by volume on the big real-money venues.
  const { data: cands, error: candErr } = await supabaseAdmin
    .from('markets')
    .select('id, platform, question, probability, category, volume')
    .eq('status', 'active')
    .in('platform', POOL_PLATFORMS)
    .not('probability', 'is', null)
    .order('volume', { ascending: false, nullsFirst: false })
    .limit(500)
  if (candErr) return NextResponse.json({ error: candErr.message }, { status: 500 })
  // Drop sports — in-play game markets swing for game reasons, not news.
  const candidates = (cands || [])
    .filter((c: any) => (c.category || '').toLowerCase() !== 'sports')
    .slice(0, CANDIDATE_POOL)
  const ids = candidates.map((c: any) => c.id)

  // 2) ~24h-ago snapshot per candidate (closest to 24h within an 18–30h window).
  const past: Record<string, { p: number; t: number }> = {}
  if (ids.length) {
    const lo = new Date(now - 30 * 3600 * 1000).toISOString()
    const hi = new Date(now - 18 * 3600 * 1000).toISOString()
    const { data: snaps } = await supabaseAdmin
      .from('price_snapshots')
      .select('market_id, probability, captured_at')
      .in('market_id', ids)
      .gte('captured_at', lo)
      .lte('captured_at', hi)
      .not('probability', 'is', null)
      .limit(1000)
    const target = now - 24 * 3600 * 1000
    for (const s of (snaps || []) as any[]) {
      const t = new Date(s.captured_at).getTime()
      const cur = past[s.market_id]
      if (!cur || Math.abs(t - target) < Math.abs(cur.t - target)) {
        past[s.market_id] = { p: Number(s.probability), t }
      }
    }
  }

  // 3) Movers — biggest absolute probability change over ~24h.
  const movers = candidates
    .map((c: any) => {
      const p0 = past[c.id]?.p
      if (p0 == null) return null
      return { ...c, delta: Number(c.probability) - p0 }
    })
    .filter((m: any) => m && Math.abs(m.delta) >= MOVE_THRESHOLD)
    .sort((a: any, b: any) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, MAX_MOVERS) as any[]

  if (movers.length === 0) {
    return NextResponse.json({
      ok: true, candidates: candidates.length, movers: 0,
      note: 'no qualifying movers — needs ~24h snapshot history and a >=7pt move',
    })
  }
  const moverIds = movers.map(m => m.id)

  // 4) Pull news for movers we haven't refreshed in the last 6h.
  const { data: recentNews } = await supabaseAdmin
    .from('market_news')
    .select('market_id, fetched_at')
    .in('market_id', moverIds)
    .gte('fetched_at', new Date(now - NEWS_FRESH_MS).toISOString())
  const freshNews = new Set((recentNews || []).map((r: any) => r.market_id))
  const needNews = movers.filter(m => !freshNews.has(m.id))

  let newsFetched = 0
  for (let i = 0; i < needNews.length; i += 6) {
    const batch = needNews.slice(i, i + 6)
    const results = await Promise.all(
      batch.map(m => fetchNews(m.question).then(items => ({ m, items })))
    )
    for (const { m, items } of results) {
      if (!items.length) continue
      const rows = items.map(it => ({
        market_id: m.id, title: it.title, url: it.url,
        source: it.source, published_at: it.published_at,
      }))
      const { error } = await supabaseAdmin
        .from('market_news')
        .upsert(rows, { onConflict: 'market_id,url', ignoreDuplicates: true })
      if (!error) newsFetched += rows.length
    }
  }

  // 5) Latest headlines per mover (from DB) for the sentiment pass.
  const { data: allNews } = await supabaseAdmin
    .from('market_news')
    .select('market_id, title, published_at')
    .in('market_id', moverIds)
    .order('published_at', { ascending: false, nullsFirst: false })
  const headlines: Record<string, string[]> = {}
  for (const n of (allNews || []) as any[]) {
    (headlines[n.market_id] ||= [])
    if (headlines[n.market_id].length < 5) headlines[n.market_id].push(n.title)
  }

  // Only score movers that have headlines and aren't already freshly scored.
  const { data: recentSent } = await supabaseAdmin
    .from('market_sentiment')
    .select('market_id, generated_at')
    .in('market_id', moverIds)
    .gte('generated_at', new Date(now - SENT_FRESH_MS).toISOString())
  const freshSent = new Set((recentSent || []).map((r: any) => r.market_id))
  const toScore = movers.filter(m => (headlines[m.id]?.length) && !freshSent.has(m.id))

  // 6) One batched Gemini call for all movers needing a score.
  let scored = 0
  const debug: any = { hasApiKey: !!apiKey, toScore: toScore.length, geminiStatus: null, finishReason: null, parsed: 0, rawLen: 0 }
  if (toScore.length && apiKey) {
    const list = toScore.map((m, idx) => {
      const dir = m.delta > 0
        ? `up ${Math.round(m.delta * 100)} pts`
        : `down ${Math.round(Math.abs(m.delta) * 100)} pts`
      const heads = headlines[m.id].map(h => `- ${h}`).join('\n')
      return `[${idx}] Q: ${m.question}\nYES odds moved ${dir} over ~24h.\nHeadlines:\n${heads}`
    }).join('\n\n')

    const prompt = `You are a prediction-market analyst. For each market below, read the recent headlines and judge whether the news flow is bullish, bearish, or neutral FOR THE "YES" OUTCOME of that specific question. Ignore headlines that are not actually about the question.

${list}

Return ONLY a JSON array, one object per market, in the same order:
[{"i":0,"stance":"bullish|bearish|neutral","score":-100..100,"why":"<=18 words, plain English, do NOT restate the odds","drivers":["<=4 word phrase","..."]}]
Rules: score sign must match stance (positive = bullish for YES, negative = bearish for YES). drivers = up to 3 short phrases naming the real news drivers. If headlines are off-topic or thin, use "neutral" with score near 0.`

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 8192,
              temperature: 0.3,
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      )
      if (res.ok) {
        const gem   = await res.json()
        debug.geminiStatus = res.status
        debug.finishReason = gem.candidates?.[0]?.finishReason ?? null
        const parts = gem.candidates?.[0]?.content?.parts || []
        const text  = parts.filter((p: any) => !p.thought).map((p: any) => p.text || '').join('').trim()
        debug.rawLen = text.length
        let arr: any[] = []
        try { arr = JSON.parse(text) } catch { const mm = text.match(/\[[\s\S]*\]/); arr = mm ? JSON.parse(mm[0]) : [] }
        debug.parsed = arr.length

        const rows: any[] = []
        for (const o of arr) {
          const m = toScore[Number(o.i)]
          if (!m) continue
          const stance = ['bullish', 'bearish', 'neutral'].includes(o.stance) ? o.stance : 'neutral'
          const score  = Math.max(-100, Math.min(100, Math.round(Number(o.score) || 0)))
          rows.push({
            market_id: m.id,
            stance,
            score,
            why: String(o.why || '').slice(0, 220),
            drivers: Array.isArray(o.drivers) ? o.drivers.slice(0, 3).map((d: any) => String(d).slice(0, 40)) : [],
            move_24h: Math.round(m.delta * 100),
            headline_count: headlines[m.id].length,
            generated_at: new Date().toISOString(),
          })
        }
        if (rows.length) {
          const { error } = await supabaseAdmin
            .from('market_sentiment')
            .upsert(rows, { onConflict: 'market_id' })
          if (!error) scored = rows.length
        }
      } else {
        debug.geminiStatus = res.status
        console.error('Gemini sentiment error:', await res.text())
      }
    } catch (e: any) {
      console.error('sentiment error:', e?.message)
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    movers: movers.length,
    newsFetched,
    scored,
    debug,
    sample: movers.slice(0, 8).map(m => ({
      move: Math.round(m.delta * 100),
      headlines: headlines[m.id]?.length || 0,
      q: m.question.slice(0, 70),
    })),
  })
}
