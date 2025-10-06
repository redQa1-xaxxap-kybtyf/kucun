/**
 * Next.js Instrumentation
 * 用于应用启动时的初始化逻辑
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // 仅在服务器端运行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMemoryMonitor } = await import(
      '@/lib/monitoring/memory-monitor'
    );

    // 启动内存监控
    // 生产环境：每30秒监控一次
    // 开发环境：可以通过环境变量启用
    const enabled =
      process.env.NODE_ENV === 'production' ||
      process.env.ENABLE_MEMORY_MONITOR === 'true';

    if (enabled) {
      startMemoryMonitor(30000, {
        heapUsagePercent: 85,
        rssThresholdMB: 3500,
        enabled: true,
      });
    }
  }
}
