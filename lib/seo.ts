// lib/seo.ts
// -----------------------------------------------------------------------------
// Single source of truth for page metadata.
//
// WHY THIS EXISTS
// Next.js merges `metadata` SHALLOWLY. If a page defines its own `openGraph`
// object, it REPLACES the root layout's entirely — it does not merge field by
// field. On 2026-07-13 we found that nine pages had each hand-rolled a partial
// `openGraph` block, and every one of them had silently dropped the
// file-convention og:image from app/opengraph-image.tsx. Result: every odds,
// category, compare, resolved, track-record and home page had been sharing on
// social with NO preview card at all. Nothing in any SEO tool surfaces that.
//
// Those nine pages are now fixed. This helper exists so it can never happen
// again: buildMetadata() always returns a COMPLETE metadata object, so a field
// cannot be forgotten. New pages (starting with the blog) should call this
// instead of assembling a Metadata object by hand.
//
// It also fixes the second bug found the same day: the root layout applies a
// '%s | Predacle' title template, so a page whose own title already ends in
// '— Predacle' renders as "Foo — Predacle | Predacle". Using `title.absolute`
// bypasses the template, and callers pass the full title they want.
//
// NOT USED BY: app/markets/[id]/ — those pages have their own
// opengraph-image.tsx generating per-market cards. Forcing the generic image
// there would clobber them. Leave that route alone.
// -----------------------------------------------------------------------------
import type { Metadata } from 'next'

export const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

/** The site-wide OG image (app/opengraph-image.tsx). Relative — resolved via
 *  `metadataBase` in the root layout, the same way guides/lp-rewards already
 *  resolves its canonical. */
export const DEFAULT_OG_IMAGE = '/opengraph-image'

export const OG_IMAGE_ALT = 'Predacle — Every prediction market, one place'

export interface BuildMetadataArgs {
  /** The FULL <title>. Rendered verbatim — do not append "| Predacle" yourself. */
  title: string
  description: string
  /** Path only: '/blog/my-post', or '/' for home. */
  path: string
  /** 'article' for posts and guides; 'website' for hubs and listings. */
  type?: 'website' | 'article'
  keywords?: string[]
  /** Override the share image. Omit for the site default. */
  image?: string
  /** Shorter title for social cards. Falls back to `title`. */
  socialTitle?: string
  /** ISO date. Article pages only — feeds og:published_time. */
  publishedTime?: string
  /** ISO date. Article pages only — feeds og:modified_time. */
  modifiedTime?: string
  robots?: Metadata['robots']
}

export function buildMetadata({
  title,
  description,
  path,
  type = 'website',
  keywords,
  image = DEFAULT_OG_IMAGE,
  socialTitle,
  publishedTime,
  modifiedTime,
  robots,
}: BuildMetadataArgs): Metadata {
  const url = path === '/' ? SITE : `${SITE}${path.startsWith('/') ? path : `/${path}`}`
  const ogTitle = socialTitle || title

  return {
    // `absolute` bypasses the root layout's '%s | Predacle' template so the brand
    // is never doubled. Callers own the whole title string.
    title: { absolute: title },
    description,
    ...(keywords && keywords.length ? { keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      // EVERY field restated. Next.js will not merge these with the root layout's
      // — omitting one drops it entirely. `images` is the one that got forgotten.
      title: ogTitle,
      description,
      url,
      siteName: 'Predacle',
      locale: 'en_US',
      type,
      images: [{ url: image, width: 1200, height: 630, alt: OG_IMAGE_ALT }],
      ...(type === 'article' && publishedTime ? { publishedTime } : {}),
      ...(type === 'article' && modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      site: '@PredacleHQ',
      creator: '@PredacleHQ',
      title: ogTitle,
      description,
      images: [image],
    },
    ...(robots ? { robots } : {}),
  }
}

// -----------------------------------------------------------------------------
// Schema helpers. Kept here so JSON-LD is built the same way everywhere.
// -----------------------------------------------------------------------------

export interface Crumb {
  name: string
  path: string
}

export function breadcrumbLd(crumbs: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.path === '/' ? SITE : `${SITE}${c.path}`,
    })),
  }
}

export interface ArticleLdArgs {
  headline: string
  description: string
  path: string
  datePublished: string
  dateModified?: string
  image?: string
  author?: string
}

/** BlogPosting JSON-LD. Use for /blog/[slug].
 *  Note: do NOT also emit FAQPage on a blog post. Google restricted FAQ rich
 *  results to government/health sites in Aug 2023, so it earns nothing for us —
 *  confirmed on 2026-07-13 (schema.org validator passes, Rich Results Test shows
 *  nothing). Featured snippets are the real target and they are markup-independent. */
export function articleLd({
  headline,
  description,
  path,
  datePublished,
  dateModified,
  image = DEFAULT_OG_IMAGE,
  author = 'Predacle',
}: ArticleLdArgs) {
  const url = `${SITE}${path}`
  return {
    '@type': 'BlogPosting',
    headline,
    description,
    datePublished,
    dateModified: dateModified || datePublished,
    image: image.startsWith('http') ? image : `${SITE}${image}`,
    author: { '@type': 'Organization', name: author, url: SITE },
    publisher: { '@id': `${SITE}/#organization` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
  }
}

/** Wrap one or more schema nodes into the @graph envelope the site already uses. */
export function jsonLdGraph(...nodes: object[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  }
}
