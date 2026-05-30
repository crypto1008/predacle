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
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  }
}