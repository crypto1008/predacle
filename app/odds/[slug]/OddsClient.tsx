'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { platformLabel } from '@/lib/platforms'
import type { TopicOdds, SimpleTopicOdds, OddsSection, CandidateRow, NominationSplit } from '@/lib/odds-data'

function useDarkMode() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

export default function OddsClient({
  topic,
  data,
  structure,
}: {
  topic: { question: string; intro: string; slug: string }
  data: TopicOdds | SimpleTopicOdds | null
  structure: 'election' | 'simple'
}) {
  const dark = useDarkMode()

  const bg     = dark ? '#0a0b0d' : '#ffffff'
  const panel  = dark ? '#16171a' : '#ffffff'
  const soft   = dark ? '#0d0e10' : '#f5f6f8'
  const border = dark ? '#26282d' : '#eaecef'
  const txt1   = dark ? '#f5f6f8' : '#0a0b0d'
  const txt2   = dark ? '#8a919e' : '#5b616e'
  const txt3   = dark ? '#5b616e' : '#8a919e'
  const blue   = '#0052ff'

  const h2 = { fontSize: 18, fontWeight: 700, color: txt1, margin: '0 0 4px' } as const

  function Row({ c }: { c: CandidateRow }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${border}`, background: panel }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: txt1, lineHeight: 1.35 }}>{c.name}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
            {c.prices.map((p) => (
              <Link key={p.id} href={`/markets/${p.id}`} style={{ fontSize: 12.5, color: txt2, textDecoration: 'none' }}>
                {platformLabel(p.platform)} <strong style={{ color: blue }}>{p.probability}%</strong>
                {p.platform === 'manifold' && (
                  <span style={{ fontSize: 10, color: dark ? '#f0d98a' : '#7a5b00', marginLeft: 4 }}>(play)</span>
                )}
              </Link>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: txt1, letterSpacing: '-0.02em' }}>
          {c.topProbability}%
        </div>
      </div>
    )
  }

  function Section({ title, blurb, section }: { title: string; blurb: string; section: OddsSection | undefined }) {
    if (!section || section.rows.length === 0) return null
    return (
      <section style={{ marginBottom: 30 }}>
        <h2 style={h2}>{title}</h2>
        <p style={{ fontSize: 13, color: txt2, margin: '0 0 12px' }}>{blurb}</p>
        <div style={{ border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
          {section.rows.map((c, i) => <Row key={i} c={c} />)}
        </div>
        {section.hiddenCount > 0 && (
          <p style={{ fontSize: 12.5, color: txt3, margin: '8px 2px 0' }}>
            {`+${section.hiddenCount} more long-shot ${section.hiddenCount === 1 ? 'candidate' : 'candidates'} priced below ${data?.threshold ?? 4}% (not shown).`}
          </p>
        )}
      </section>
    )
  }

  // One party's nomination race: a labelled, bordered ranked list with its own
  // long-shot count. Renders nothing if the party has no shown candidates.
  function SubList({ label, section }: { label: string; section: OddsSection }) {
    if (!section || section.rows.length === 0) return null
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: txt2, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
          {section.rows.map((c, i) => <Row key={i} c={c} />)}
        </div>
        {section.hiddenCount > 0 && (
          <p style={{ fontSize: 12.5, color: txt3, margin: '8px 2px 0' }}>
            {`+${section.hiddenCount} more long-shot ${section.hiddenCount === 1 ? 'candidate' : 'candidates'} priced below ${data?.threshold ?? 4}% (not shown).`}
          </p>
        )}
      </div>
    )
  }

  // Nomination is two separate contests, so render the Democratic and
  // Republican races as distinct ranked lists under one heading.
  function NominationBlock({ split }: { split: NominationSplit | undefined }) {
    if (!split) return null
    const total = split.democratic.rows.length + split.republican.rows.length + split.other.rows.length
    if (total === 0) return null
    return (
      <section style={{ marginBottom: 30 }}>
        <h2 style={h2}>Nomination odds</h2>
        <p style={{ fontSize: 13, color: txt2, margin: '0 0 14px' }}>
          Who becomes each party&rsquo;s nominee — shown as two separate races. (A candidate&rsquo;s nomination odds differ from their odds of winning the election.)
        </p>
        <SubList label="Democratic nomination" section={split.democratic} />
        <SubList label="Republican nomination" section={split.republican} />
        {split.other.rows.length > 0 && <SubList label="Party unclear" section={split.other} />}
      </section>
    )
  }

  return (
    <div style={{ background: bg, minHeight: '100vh' }}>
      <main style={{ maxWidth: 820, margin: '0 auto', padding: '24px 20px 64px' }}>
        <nav style={{ fontSize: 13, color: txt2, marginBottom: 16 }} aria-label="Breadcrumb">
          <Link href="/" style={{ color: txt2, textDecoration: 'none' }}>Home</Link>
          <span style={{ margin: '0 8px', color: txt3 }}>&rsaquo;</span>
          <span style={{ color: txt1 }}>Odds</span>
        </nav>

        <h1 style={{ fontSize: 30, fontWeight: 800, color: txt1, letterSpacing: '-0.02em', margin: '0 0 14px', lineHeight: 1.15 }}>
          {topic.question}
        </h1>

        {/* Data-derived headline answer */}
        {data?.headline && (
          <div style={{ background: soft, border: `1px solid ${border}`, borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: txt1, margin: 0, fontWeight: 500 }}>{data.headline}</p>
          </div>
        )}

        <p style={{ fontSize: 15, lineHeight: 1.6, color: txt2, margin: '0 0 28px' }}>{topic.intro}</p>

        {!data && (
          <p style={{ color: txt2, fontSize: 14 }}>Live odds are momentarily unavailable — please refresh in a moment.</p>
        )}

        {data && structure === 'election' && (
          <>
            <Section
              title="Party odds"
              blurb="Which party wins the presidency — the broadest market."
              section={(data as TopicOdds).sections.party}
            />
            <NominationBlock split={(data as TopicOdds).sections.nomination} />
            <Section
              title="Election winner odds"
              blurb="Who wins the presidency outright, across all candidates."
              section={(data as TopicOdds).sections.election}
            />
          </>
        )}

        {data && structure === 'simple' && (
          <section style={{ marginBottom: 30 }}>
            <div style={{ border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
              {(data as SimpleTopicOdds).contenders.map((c, i) => <Row key={i} c={c} />)}
            </div>
            {(data as SimpleTopicOdds).hiddenCount > 0 && (
              <p style={{ fontSize: 12.5, color: txt3, margin: '8px 2px 0' }}>
                {`+${(data as SimpleTopicOdds).hiddenCount} more long-shot ${(data as SimpleTopicOdds).hiddenCount === 1 ? 'contender' : 'contenders'} priced below ${data?.threshold ?? 4}% (not shown).`}
              </p>
            )}
          </section>
        )}

        {/* Interlinking */}
        <section style={{ background: soft, border: `1px solid ${border}`, borderRadius: 12, padding: '18px 20px', marginTop: 8 }}>
          <h2 style={{ ...h2, marginBottom: 8 }}>Go deeper</h2>
          {structure === 'election' ? (
            <p style={{ fontSize: 14, lineHeight: 1.7, color: txt2, margin: 0 }}>
              See how accurate prediction markets have been on our{' '}
              <Link href="/track-record" style={{ color: blue, textDecoration: 'none' }}>track record</Link>
              {' '}page, compare platforms on{' '}
              <Link href="/compare/polymarket-vs-kalshi" style={{ color: blue, textDecoration: 'none' }}>Polymarket vs Kalshi</Link>
              , or browse all{' '}
              <Link href="/category/politics" style={{ color: blue, textDecoration: 'none' }}>politics markets</Link>.
            </p>
          ) : (
            <p style={{ fontSize: 14, lineHeight: 1.7, color: txt2, margin: 0 }}>
              See how accurate prediction markets have been on our{' '}
              <Link href="/track-record" style={{ color: blue, textDecoration: 'none' }}>track record</Link>
              {' '}page, see more{' '}
              <Link href="/odds" style={{ color: blue, textDecoration: 'none' }}>aggregated odds</Link>
              , or browse all{' '}
              <Link href="/category/sports" style={{ color: blue, textDecoration: 'none' }}>sports markets</Link>.
            </p>
          )}
        </section>

        <p style={{ fontSize: 12, color: txt3, marginTop: 22, lineHeight: 1.6 }}>
          {/* The play-money sentences describe data this page may not contain. When
              playOnlyCount is 0 no Manifold price is displayed at all (always true
              for realMoneyOnly topics such as the price ladders), so stating that
              Manifold "is used only when no real-money market exists" is describing
              something the reader cannot see. Derive it from the data instead. */}
          {(() => {
            const noun = structure === 'simple' ? 'contender' : 'candidate'
            const playOnly = (data as SimpleTopicOdds | null)?.playOnlyCount ?? 0
            const base = `Odds are aggregated from live prediction markets and update continuously. A ${noun}\u2019s number is its best real-money price across the platforms shown. Markets below ${data?.threshold ?? 4}% are summarised as a count to keep the page readable.`
            const money = playOnly > 0
              ? ` Play-money (Manifold) is used only when no real-money market exists, and those prices are shown for forecasting signal only.`
              : ` Every price on this page is a real-money price; play-money (Manifold) markets are excluded.`
            return `${base}${money} Not financial advice.`
          })()}
        </p>
      </main>
    </div>
  )
}
