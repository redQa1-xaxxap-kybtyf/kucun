/** @type {import('next').NextConfig} */
const nextConfig = {
  // 图片优化配置
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    // SVG 安全配置
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // TypeScript 配置 - 保持严格检查
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint 配置 - 保持严格检查
  eslint: {
    ignoreDuringBuilds: false,
  },

  // 启用严格模式
  reactStrictMode: true,

  // 启用压缩
  compress: true,

  // 生产优化 - 禁用 source maps
  productionBrowserSourceMaps: false,

  // 实验性功能
  experimental: {
    // 优化 CSS
    optimizeCss: true,
    // 优化包导入
    optimizePackageImports: ['lucide-react', '@tanstack/react-query'],
  },

  // CDN 配置 (可选 - 取消注释以启用)
  // assetPrefix: process.env.NODE_ENV === 'production'
  //   ? 'https://cdn.your-domain.com'
  //   : undefined,
};

module.exports = nextConfig;
