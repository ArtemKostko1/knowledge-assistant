import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  allowedDevOrigins: ['127.0.0.1'],
  logging: {
    incomingRequests: {
      ignore: [/\/auth\/recovery(?:\?.*)?$/],
    },
  },
};

export default nextConfig;
