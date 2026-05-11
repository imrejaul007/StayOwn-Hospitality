/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
];

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverActions: true,
  },
  // Only expose non-sensitive configuration to client
  env: {
    DATABASE_URL: process.env.DATABASE_URL, // Server-only, not exposed to client
    WALLET_API_URL: process.env.WALLET_API_URL,
    AUTH_API_URL: process.env.AUTH_API_URL,
    // NOTE: JWT_SECRET must NOT be exposed to client-side
    // It should only be used server-side in API routes
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
}

module.exports = nextConfig
