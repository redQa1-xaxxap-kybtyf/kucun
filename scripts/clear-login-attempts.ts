#!/usr/bin/env tsx

/**
 * 清除登录失败记录脚本
 * 用于清理Redis中的登录失败次数限制
 */

import Redis from 'ioredis';

async function clearLoginAttempts() {
  console.log('🧹 开始清理登录失败记录...');

  const client = new Redis({
    host: '127.0.0.1',
    port: 6379,
  });

  try {
    console.log('✅ Redis 连接成功');

    // 清理登录失败次数记录
    const keys = await client.keys('login:attempts:*');
    console.log(`找到 ${keys.length} 个登录失败记录键`);

    if (keys.length > 0) {
      await client.del(...keys);
      console.log(`✅ 清理登录失败记录: ${keys.length} 个键`);
    } else {
      console.log('没有找到需要清理的登录失败记录');
    }

    console.log('\n🎉 登录失败记录清理完成！');
  } catch (error) {
    console.error('❌ 清理失败:', error);
    process.exit(1);
  } finally {
    await client.quit();
    process.exit(0);
  }
}

clearLoginAttempts();
