import { MetadataRoute } from 'next'

// AI crawlers we explicitly welcome.
// Citation/fetch agents (these are what get you cited in answers):
//   OAI-SearchBot, ChatGPT-User, Claude-User, PerplexityBot, Perplexity-User
// Training crawlers (help future models know Predacle exists):
//   GPTBot, ClaudeBot, anthropic-ai, Google-Extended
const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended',
]

// Match sitemap.ts: fall back to the production domain if the env var is unset,
// so robots.txt can never advertise "undefined/sitemap.xml".
const base = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
      {
        userAgent: AI_BOTS,
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
