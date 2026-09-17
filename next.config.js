/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // App Hosting/Cloud Run builds in this mode; matching it locally lets `npm run build` +
  // `node .next/standalone/server.js` catch server-bundling issues before deploying.
  output: 'standalone',
  // pkpass generation uses node-forge / apn / googleapis — keep them server-only (Node runtime).
  experimental: {
    // Keep these as real node_modules requires (not webpack-bundled) so serverless build
    // tracing picks up their non-JS assets — Prisma's generated query engine binary above all.
    serverComponentsExternalPackages: ['node-forge', 'apn', 'jszip', 'googleapis', '@prisma/client', 'prisma', 'sharp', 'opentype.js'],
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/.prisma/client/**'],
    },
  },
};

module.exports = nextConfig;
