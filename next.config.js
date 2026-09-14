/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pkpass generation uses node-forge / apn / googleapis — keep them server-only (Node runtime).
  experimental: {
    serverComponentsExternalPackages: ['node-forge', 'apn', 'jszip', 'googleapis'],
  },
};

module.exports = nextConfig;
