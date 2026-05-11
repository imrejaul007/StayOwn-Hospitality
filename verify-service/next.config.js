/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverActions: true,
  },
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    WALLET_API_URL: process.env.WALLET_API_URL,
    AUTH_API_URL: process.env.AUTH_API_URL,
  },
}

module.exports = nextConfig
