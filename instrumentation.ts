/**
 * Next.js Instrumentation
 * 用于应用启动时的初始化逻辑
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * 注意: 当前禁用 memory-monitor 以避免 ioredis 导致的构建错误
 * ioredis 依赖 Node.js 模块(stream, crypto, dns, net)在客户端构建时不可用
 */

export async function register() {
  // 仅在服务器端运行
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  // 暂时禁用 memory monitor，防止构建阶段解析到 ioredis 的 Node-only 依赖
  // TODO: 将监控逻辑迁移到仅在 Node 运行时载入的入口（例如自定义 server）
  return;
}
