/**
 * Node.js instrumentation entry.
 * 仅在 Next.js Node runtime 下被 instrumentation.ts 引入。
 */

import { startMemoryMonitor } from './lib/monitoring/memory-monitor';

export function registerNodeInstrumentation(): void {
  if (process.env.ENABLE_MEMORY_MONITOR !== 'true') {
    return;
  }

  // 在非生产环境也允许通过 ENABLE_MEMORY_MONITOR 显式开启
  startMemoryMonitor(30_000, { enabled: true });
}
