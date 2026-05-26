import type { NextConfig } from 'next'

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
}

export default nextConfig