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

  // TypeScript 配置 - 开发时检查，构建时跳过以加快速度
  typescript: {
    ignoreBuildErrors: true,
  },

  // ESLint 配置 - 开发时检查，构建时跳过以加快速度
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 启用严格模式
  reactStrictMode: true,

  // 启用压缩
  compress: true,

  // 生产优化 - 禁用 source maps
  productionBrowserSourceMaps: false,

  // Webpack 配置 - 优化 Windows 文件系统缓存
  webpack: (config, { isServer }) => {
    // 配置缓存压缩，减少文件锁定问题
    if (config.cache && typeof config.cache === 'object' && config.cache.type === 'filesystem') {
      config.cache = {
        type: 'filesystem', // 必须保持 filesystem
        compression: false, // 禁用压缩，减少文件操作
        hashAlgorithm: 'xxhash64',
      };
    }
    return config;
  },

  // 实验性功能
  experimental: {
    // 优化包导入
    optimizePackageImports: ['lucide-react', '@tanstack/react-query'],
  },

  // CDN 配置 (可选 - 取消注释以启用)
  // assetPrefix: process.env.NODE_ENV === 'production'
  //   ? 'https://cdn.your-domain.com'
  //   : undefined,
};

module.exports = nextConfig;
