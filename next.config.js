/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  typescript: {
    // 在生产构建时忽略类型错误（开发时仍会检查）
    ignoreBuildErrors: false,
  },
  eslint: {
    // 在生产构建时忽略 ESLint 错误（开发时仍会检查）
    ignoreDuringBuilds: false,
  },
  // 启用严格模式
  reactStrictMode: true,
};

module.exports = nextConfig;
