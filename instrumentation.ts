/**
 * Next.js Instrumentation
 * 用于应用启动时的初始化逻辑
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * 注意: 内存监控依赖 Node.js API（process.memoryUsage 等），必须仅在 Node runtime 下执行
 */

export async function register() {
  // 仅在 Node.js runtime 下运行
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  try {
    // 使用 require + 运行时分流，避免 edge-instrumentation 构建解析到 Node-only 逻辑/依赖
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerNodeInstrumentation } = require('./instrumentation.node');
    registerNodeInstrumentation();
  } catch (error) {
    // instrumentation 早期执行，避免引入 logger/prisma 等重量依赖导致 edge 构建问题
    // eslint-disable-next-line no-console
    console.error('[instrumentation] failed to start memory monitor', error);
  }
}
