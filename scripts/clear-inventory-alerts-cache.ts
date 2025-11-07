/**
 * 清除库存预警缓存脚本
 * 用于在修复库存预警逻辑后清除旧缓存，确保修复立即生效
 */

import * as readline from 'readline';

import { logger } from '@/lib/logger';

import { redis } from '@/lib/cache/redis';

/**
 * 询问用户确认
 */
function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`${question} (y/n): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * 清除库存预警相关缓存
 */
async function clearInventoryAlertsCache() {
  console.log('=== 清除库存预警缓存 ===\n');

  try {
    // 1. 检查 Redis 连接
    console.log('1. 检查 Redis 连接...');
    const pingResult = await redis.ping();
    if (pingResult !== 'PONG') {
      throw new Error('Redis 连接失败');
    }
    console.log('   ✅ Redis 连接正常\n');

    // 2. 查找所有库存预警相关的缓存键
    console.log('2. 查找库存预警相关的缓存键...');
    const patterns = [
      'inventory:alerts:*', // 库存预警 API 缓存
      'dashboard:alerts:*', // 仪表盘预警缓存
    ];

    let allKeys: string[] = [];
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      allKeys = allKeys.concat(keys);
      console.log(`   找到 ${keys.length} 个 "${pattern}" 缓存键`);
    }

    console.log(`   总计: ${allKeys.length} 个缓存键\n`);

    if (allKeys.length === 0) {
      console.log('✅ 没有找到需要清除的缓存键');
      console.log('');
      return;
    }

    // 3. 显示将要删除的缓存键（最多显示 10 个）
    console.log('3. 将要删除的缓存键（示例）:');
    const displayKeys = allKeys.slice(0, 10);
    displayKeys.forEach((key, index) => {
      console.log(`   ${index + 1}. ${key}`);
    });
    if (allKeys.length > 10) {
      console.log(`   ... 还有 ${allKeys.length - 10} 个缓存键`);
    }
    console.log('');

    // 4. 询问用户确认
    const confirmed = await askConfirmation(
      `确定要删除这 ${allKeys.length} 个缓存键吗？`
    );

    if (!confirmed) {
      console.log('❌ 操作已取消');
      console.log('');
      return;
    }

    // 5. 删除缓存键
    console.log('\n4. 删除缓存键...');
    let deletedCount = 0;

    // 批量删除（每次最多 100 个）
    const batchSize = 100;
    for (let i = 0; i < allKeys.length; i += batchSize) {
      const batch = allKeys.slice(i, i + batchSize);
      const result = await redis.del(...batch);
      deletedCount += result;
      console.log(
        `   已删除 ${Math.min(i + batchSize, allKeys.length)}/${allKeys.length} 个缓存键`
      );
    }

    console.log(`   ✅ 成功删除 ${deletedCount} 个缓存键\n`);

    // 6. 记录日志
    logger.info('cache', '清除库存预警缓存', {
      totalKeys: allKeys.length,
      deletedKeys: deletedCount,
      patterns,
    });

    console.log('=== 缓存清除完成 ===');
    console.log('');
    console.log('📝 后续步骤:');
    console.log('1. 重启开发服务器（如果正在运行）');
    console.log('2. 访问仪表盘验证预警功能: http://localhost:3000/dashboard');
    console.log('3. 访问库存预警页面: http://localhost:3000/inventory/alerts');
    console.log('4. 检查预警数据是否正确显示');
    console.log('');
  } catch (error) {
    console.error('❌ 清除缓存失败:', error);
    logger.error('cache', '清除库存预警缓存失败', error);
    process.exit(1);
  } finally {
    // 关闭 Redis 连接
    await redis.quit();
  }
}

// 运行脚本
clearInventoryAlertsCache();
