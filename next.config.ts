import type { NextConfig } from 'next';

const strictBuildChecks =
  process.env.STRICT_BUILD_CHECKS === 'true' ||
  (process.env.STRICT_BUILD_CHECKS !== 'false' &&
    (process.env.NODE_ENV === 'production' || process.env.CI === 'true'));

const nextConfig: NextConfig = {
  // Jest / Next.js 依赖中存在 ESM-only 包（如 MSW 相关依赖），需要在 Next 编译链中转译
  transpilePackages: [
    'msw',
    '@mswjs/interceptors',
    'until-async',
    'headers-polyfill',
  ],

  // 图片优化配置
  images: {
    domains: ['localhost', 'xcx.0595t.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xcx.0595t.com',
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    // SVG 安全配置
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // TypeScript 配置 - 生产/CI 构建启用强校验
  typescript: {
    ignoreBuildErrors: !strictBuildChecks,
  },

  // ESLint 配置 - 生产/CI 构建启用强校验
  eslint: {
    ignoreDuringBuilds: !strictBuildChecks,
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
    if (
      config.cache &&
      typeof config.cache === 'object' &&
      config.cache.type === 'filesystem'
    ) {
      config.cache = {
        type: 'filesystem', // 必须保持 filesystem
        compression: false, // 禁用压缩，减少文件操作
        hashAlgorithm: 'xxhash64',
      };
    }

    // 客户端构建排除服务器端模块
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        'coffee-script': false,
      };

      // 排除服务器端专用包
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          ioredis: 'ioredis',
          // 排除 Puppeteer 相关包（服务器端专用）
          puppeteer: 'puppeteer',
          'puppeteer-core': 'puppeteer-core',
          'puppeteer-extra': 'puppeteer-extra',
          'puppeteer-extra-plugin-stealth': 'puppeteer-extra-plugin-stealth',
        });
      }

      // 忽略警告
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        {
          module: /node_modules\/vm2/,
        },
        {
          module: /node_modules\/pac-proxy-agent/,
        },
        {
          module: /node_modules\/qiniu/,
        },
        {
          module: /node_modules\/ioredis/,
        },
        // 忽略 Puppeteer 相关包的警告
        {
          module: /node_modules\/puppeteer/,
        },
        {
          module: /node_modules\/clone-deep/,
        },
        {
          module: /node_modules\/merge-deep/,
        },
        /coffee-script/,
      ];
    }

    return config;
  },

  // 服务器端专用包配置（Puppeteer 相关包只在服务器端使用）
  // Next.js 15+ 已将此配置从 experimental 移至顶层
  serverExternalPackages: [
    'bullmq',
    'ioredis',
    'qiniu',
    'puppeteer',
    'puppeteer-core',
    'puppeteer-extra',
    'puppeteer-extra-plugin-stealth',
  ],

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

export default nextConfig;
