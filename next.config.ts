import type { NextConfig } from "next";
import path from "path";

const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3003';

const nextConfig: NextConfig = {
  transpilePackages: [
    "@solana/kit",
    "@solana/react-hooks",
    "@solana/client",
    "@solana/program-client-core",
  ],
  webpack(config) {
    // Force all @solana/* imports to resolve to the single top-level copy.
    // @solana/react-hooks bundles @solana/kit@5.5.1 internally while the
    // project uses 6.1.0 — having two copies causes "alphabet4 is not defined"
    // because webpack bundles both and their internal closure variables collide.
    const solanaRoot = path.resolve(__dirname, "node_modules/@solana");
    const aliases: Record<string, string> = {};
    for (const pkg of [
      "kit",
      "addresses",
      "codecs-core",
      "errors",
      "keys",
      "signers",
      "transaction-messages",
    ]) {
      aliases[`@solana/${pkg}`] = path.join(solanaRoot, pkg);
    }
    config.resolve.alias = { ...config.resolve.alias, ...aliases };
    return config;
  },
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
