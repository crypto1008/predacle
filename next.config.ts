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
    ],
  },
}

export default nextConfig