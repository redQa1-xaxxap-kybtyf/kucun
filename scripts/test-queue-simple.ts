/**
 * 简化版队列测试 - 只测试核心队列功能
 * 不需要完整的环境变量配置
 */

import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

// 简单的 Redis 连接 (使用默认配置)
const connection = new Redis('redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

interface TestJobData {
  message: string;
  timestamp: number;
}

async function testQueue() {
  console.log('🧪 开始简化版队列测试...\n');

  try {
    // Step 1: 创建队列
    console.log('📦 步骤1: 创建测试队列...');
    const testQueue = new Queue<TestJobData>('test-queue', { connection });
    console.log('✅ 队列创建成功\n');

    // Step 2: 创建 Worker
    console.log('⚙️  步骤2: 创建测试 Worker...');
    const worker = new Worker<TestJobData>(
      'test-queue',
      async job => {
        console.log(`🔄 处理任务 ${job.id}: ${job.data.message}`);
        await new Promise(resolve => setTimeout(resolve, 100)); // 模拟处理
        console.log(`✅ 任务 ${job.id} 完成`);
      },
      { connection }
    );
    console.log('✅ Worker 创建成功\n');

    // Step 3: 添加任务
    console.log('📮 步骤3: 添加测试任务...');
    const job = await testQueue.add('test-job', {
      message: '测试消息',
      timestamp: Date.now(),
    });
    console.log(`✅ 任务添加成功: Job ID = ${job.id}\n`);

    // Step 4: 等待任务完成
    console.log('⏳ 步骤4: 等待任务完成...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 5: 检查队列统计
    console.log('\n📊 步骤5: 检查队列统计...');
    const [waiting, active, completed, failed] = await Promise.all([
      testQueue.getWaitingCount(),
      testQueue.getActiveCount(),
      testQueue.getCompletedCount(),
      testQueue.getFailedCount(),
    ]);

    console.log('队列统计:');
    console.log(`  等待中: ${waiting}`);
    console.log(`  处理中: ${active}`);
    console.log(`  已完成: ${completed}`);
    console.log(`  失败: ${failed}\n`);

    // 验证
    if (completed > 0 && failed === 0) {
      console.log('='.repeat(60));
      console.log('🎉 队列测试成功!');
      console.log('✅ 队列可以正常添加任务');
      console.log('✅ Worker 可以正常处理任务');
      console.log('✅ Redis 连接正常');
      console.log('='.repeat(60));
    } else {
      throw new Error('队列测试失败: 没有完成的任务');
    }

    // 清理
    await worker.close();
    await testQueue.close();
    await connection.quit();
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testQueue()
  .then(() => {
    console.log('\n✅ 测试完成,进程退出');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });
