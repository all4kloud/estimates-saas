import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',            // imagen mínima para Cloud Run (ver Dockerfile)
  serverExternalPackages: ['jspdf'],
  images: { unoptimized: true },
};
export default nextConfig;
