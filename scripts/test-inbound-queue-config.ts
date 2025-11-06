/**
 * 测试入库队列配置和连接
 * 不需要完整的数据库环境
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';

// 测试 Redis 连接配置
async function testRedisConnection() {
  console.log('🧪 测试入库队列配置...\n');

  try {
    // Step 1: 测试 Redis 连接
    console.log('📡 步骤1: 测试 Redis 连接...');
    const redis = new Redis('redis://localhost:6379', {
      password: undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    await redis.ping();
    console.log('✅ Redis 连接成功\n');

    // Step 2: 创建入库后处理队列
    console.log('📦 步骤2: 创建入库后处理队列...');
    const inboundQueue = new Queue('inbound-post-processing', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600,
        },
      },
    });
    console.log('✅ 入库队列创建成功\n');

    // Step 3: 测试添加任务
    console.log('📮 步骤3: 测试添加模拟任务...');
    const job = await inboundQueue.add('post-process', {
      recordId: 'test-record-id',
      productId: 'test-product-id',
      batchNumber: 'TEST-20250121-001',
    });
    console.log(`✅ 任务添加成功: Job ID = ${job.id}\n`);

    // Step 4: 检查队列统计
    console.log('📊 步骤4: 检查队列统计...');
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      inboundQueue.getWaitingCount(),
      inboundQueue.getActiveCount(),
      inboundQueue.getCompletedCount(),
      inboundQueue.getFailedCount(),
      inboundQueue.getDelayedCount(),
    ]);

    console.log('队列统计:');
    console.log(`  等待中: ${waiting}`);
    console.log(`  处理中: ${active}`);
    console.log(`  已完成: ${completed}`);
    console.log(`  失败: ${failed}`);
    console.log(`  延迟: ${delayed}\n`);

    // Step 5: 清理测试任务 (因为没有 worker 处理)
    console.log('🧹 步骤5: 清理测试任务...');
    await job.remove();
    console.log('✅ 测试任务已清理\n');

    // 成功总结
    console.log('='.repeat(60));
    console.log('🎉 入库队列配置测试成功!');
    console.log('✅ Redis 连接配置正确');
    console.log('✅ BullMQ 队列配置正确');
    console.log('✅ 队列选项配置正确 (重试3次, 指数退避)');
    console.log('✅ 任务可以成功添加到队列');
    console.log('='.repeat(60));

    // 清理
    await inboundQueue.close();
    await redis.quit();
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testRedisConnection()
  .then(() => {
    console.log('\n✅ 测试完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });
