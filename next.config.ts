import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'polymarket.com' },
      { protocol: 'https', hostname: 'kalshi.com' },
      { protocol: 'https', hostname: 'myriad.markets' },
      { protocol: 'https', hostname: 'manifold.markets' },
      { protocol: 'https', hostname: 'limitless.exchange' },
      { protocol: 'https', hostname: 'azuro.org' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'cdn.polkamarkets.com' },
      { protocol: 'https', hostname: 'cdn.limitless.exchange' },
      { protocol: 'https', hostname: 'polymarket-upload.s3.us-east-2.amazonaws.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
