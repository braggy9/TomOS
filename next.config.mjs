/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['googleapis', '@anthropic-ai/sdk'],
  },
};
export default nextConfig;
