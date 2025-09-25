#!/usr/bin/env tsx

/**
 * 缓存清理脚本
 * 用于清理Redis中的所有缓存数据
 */

import { redis } from '../lib/redis/redis-client';

async function clearAllCache() {
  console.log('🧹 开始清理所有缓存...');

  try {
    // 清理产品缓存
    const productsDeleted = await redis.scanDel('products:*');
    console.log(`✅ 清理产品缓存: ${productsDeleted} 个键`);

    // 清理库存缓存
    const inventoryDeleted = await redis.scanDel('inventory:*');
    console.log(`✅ 清理库存缓存: ${inventoryDeleted} 个键`);

    // 清理其他缓存
    const othersDeleted = await redis.scanDel('test:*');
    console.log(`✅ 清理测试缓存: ${othersDeleted} 个键`);

    const total = productsDeleted + inventoryDeleted + othersDeleted;
    console.log(`\n🎉 缓存清理完成！总共清理了 ${total} 个键`);
  } catch (error) {
    console.error('❌ 缓存清理失败:', error);
    process.exit(1);
  }
}

// 运行清理
clearAllCache().then(() => {
  process.exit(0);
});
