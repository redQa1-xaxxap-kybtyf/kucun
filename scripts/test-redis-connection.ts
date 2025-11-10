/**
 * 测试 Redis 连接
 */

import { redis } from '@/lib/redis';

async function testRedisConnection() {
  console.log('测试 Redis 连接...\n');

  try {
    console.log('1. 尝试 ping Redis...');
    const pingResult = await redis.ping();
    console.log(`   结果: ${pingResult}`);

    if (pingResult === 'PONG') {
      console.log('   ✅ Redis 连接正常\n');
    } else {
      console.log('   ❌ Redis 连接异常\n');
    }

    console.log('2. 获取 Redis 配置...');
    const config = redis.getConfig();
    console.log('   配置:', JSON.stringify(config, null, 2));

    console.log('\n3. 获取连接池健康状态...');
    const health = redis.getPoolHealth();
    console.log('   健康状态:', JSON.stringify(health, null, 2));

    const client = redis.getClient();
    await client.quit();
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testRedisConnection();
