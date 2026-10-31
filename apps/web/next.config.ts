import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

// The booking API. The browser calls /api/* on this app and Next.js forwards
// it, so the API's session cookie is first-party and needs no CORS.
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:5000';

const nextConfig: NextConfig = {
  // The Docker image runs the self-contained server (see Dockerfile)
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
  }
};

export default withNextIntl(nextConfig);
