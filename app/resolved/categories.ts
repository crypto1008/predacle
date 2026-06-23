// Categories that actually have a resolved dataset worth a dedicated archive page.
// (science/entertainment have ~0 resolved; 'other' is a junk-drawer label.)
export const RESOLVED_CATS: { slug: string; name: string; emoji: string }[] = [
  { slug: 'crypto', name: 'Crypto', emoji: '₿' },
  { slug: 'sports', name: 'Sports', emoji: '🏆' },
  { slug: 'politics', name: 'Politics', emoji: '🗳️' },
  { slug: 'economics', name: 'Economics', emoji: '📈' },
  { slug: 'tech', name: 'Tech', emoji: '💻' },
]

export function resolvedCat(slug: string) {
  return RESOLVED_CATS.find((c) => c.slug === slug) || null
}
