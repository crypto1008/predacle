// Blog post registry. Same single-source pattern as lib/odds-topics.ts: add an
// entry here and it appears in the index, the sitemap, and its own page.
// Posts render as server components under app/blog/[slug]; this holds the metadata.

export interface BlogPost {
  slug: string
  title: string          // <title> / h1 headline
  description: string     // meta description + card blurb
  datePublished: string   // ISO date
  dateModified?: string
  author: string
  readingMinutes: number
}

export const BLOG_POSTS: Record<string, BlogPost> = {
  'are-prediction-markets-accurate': {
    slug: 'are-prediction-markets-accurate',
    title: 'We scored 7,800 prediction markets against reality. Here is how accurate they were.',
    description:
      'We compared the final price of nearly 7,800 resolved prediction markets against what actually happened. The prices land within 2.4 points of reality on average, with a mild favorite-longshot bias in the middle of the range.',
    datePublished: '2026-07-15',
    author: 'Predacle',
    readingMinutes: 6,
  },
}

export const BLOG_SLUGS = Object.keys(BLOG_POSTS)

export function getPost(slug: string): BlogPost | null {
  return BLOG_POSTS[slug] ?? null
}

export function allPostsNewestFirst(): BlogPost[] {
  return Object.values(BLOG_POSTS).sort((a, b) =>
    b.datePublished.localeCompare(a.datePublished),
  )
}
