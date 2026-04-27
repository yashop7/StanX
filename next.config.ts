import type { NextConfig } from "next";

const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3003';

const nextConfig: NextConfig = {
  transpilePackages: [
    "@solana/kit",
    "@solana/react-hooks",
    "@solana/client",
    "@solana/program-client-core",
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'gateway.irys.xyz' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  serverExternalPackages: [
    "ws",
    "@metaplex-foundation/umi-bundle-defaults",
    "@metaplex-foundation/umi-uploader-irys",
  ],

  // Proxy all /api/backend/* requests to the backend server.
  // This avoids CORS: browser calls /api/backend/... → Next.js server proxies to localhost:3003/...
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${BACKEND_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
