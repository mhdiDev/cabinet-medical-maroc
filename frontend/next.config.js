/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Requis par le Dockerfile (copie de .next/standalone)
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  },
};

module.exports = nextConfig;
