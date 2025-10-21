/**
 * 队列 Worker 启动脚本
 * 用于在独立进程中运行队列消费者
 *
 * 使用方法:
 * npm run worker:start
 * 或
 * tsx scripts/start-queue-workers.ts
 */

import { startInboundWorker } from '@/lib/queue/workers/inbound-worker';

// eslint-disable-next-line no-console
console.log('Starting queue workers...');

// 启动入库后处理 Worker
startInboundWorker();

// eslint-disable-next-line no-console
console.log('Queue workers started successfully');
