import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config) => {
    // The shared MCP tool registry under lib/expenses/mcp uses .js import
    // extensions so it can be consumed by both Next.js (bundler resolution)
    // and the stdio server (NodeNext resolution) without duplication.
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
