#!/usr/bin/env tsx

/**
 * Redis和WebSocket功能测试脚本
 * 用于验证缓存和实时通信功能是否正常工作
 */

import { redis } from '../lib/redis/redis-client';
import { publishWs } from '../lib/ws/ws-server';

async function testRedis() {
  console.log('🔍 测试Redis连接和缓存功能...');

  try {
    // 测试基本连接
    const client = redis.getClient();
    await client.ping();
    console.log('✅ Redis连接正常');

    // 测试JSON缓存
    const testData = { id: '1', name: '测试产品', timestamp: Date.now() };
    await redis.setJson('test:product', testData, 10);
    console.log('✅ 缓存写入成功');

    const cached = await redis.getJson<typeof testData>('test:product');
    if (cached && cached.id === testData.id) {
      console.log('✅ 缓存读取成功');
    } else {
      console.log('❌ 缓存读取失败');
    }

    // 测试缓存删除
    const deleted = await redis.del('test:product');
    console.log(`✅ 缓存删除成功，删除了 ${deleted} 个键`);

    // 测试批量删除
    await redis.setJson('test:batch:1', { id: 1 });
    await redis.setJson('test:batch:2', { id: 2 });
    const batchDeleted = await redis.scanDel('test:batch:*');
    console.log(`✅ 批量删除成功，删除了 ${batchDeleted} 个键`);
  } catch (error) {
    console.error('❌ Redis测试失败:', error);
  }
}

async function testWebSocket() {
  console.log('🔍 测试WebSocket推送功能...');

  try {
    // 确保WebSocket服务器启动
    const response = await fetch('http://localhost:3001/api/ws');
    const result = await response.json();

    if (result.success) {
      console.log('✅ WebSocket服务器运行正常');

      // 测试消息推送
      publishWs('test', {
        type: 'test-message',
        message: 'Hello from test script',
        timestamp: Date.now(),
      });
      console.log('✅ 测试消息推送成功');
    } else {
      console.log('❌ WebSocket服务器启动失败');
    }
  } catch (error) {
    console.error('❌ WebSocket测试失败:', error);
  }
}

async function testCacheIntegration() {
  console.log('🔍 测试缓存集成功能...');

  try {
    // 测试产品API缓存
    const response = await fetch(
      'http://localhost:3001/api/products?page=1&limit=5'
    );
    const data = await response.json();

    if (data.success) {
      console.log('✅ 产品API缓存测试成功');
      console.log(`   - 返回 ${data.data.data.length} 条产品记录`);
    } else {
      console.log('❌ 产品API缓存测试失败');
    }

    // 测试库存API缓存
    const inventoryResponse = await fetch(
      'http://localhost:3001/api/inventory?page=1&limit=5'
    );
    const inventoryData = await inventoryResponse.json();

    if (inventoryData.success) {
      console.log('✅ 库存API缓存测试成功');
      console.log(`   - 返回 ${inventoryData.data.data.length} 条库存记录`);
    } else {
      console.log('❌ 库存API缓存测试失败');
    }
  } catch (error) {
    console.error('❌ 缓存集成测试失败:', error);
  }
}

async function main() {
  console.log('🚀 开始Redis和WebSocket功能测试\n');

  await testRedis();
  console.log('');

  await testWebSocket();
  console.log('');

  await testCacheIntegration();
  console.log('');

  console.log('✨ 测试完成！');
  process.exit(0);
}

// 运行测试
main().catch(error => {
  console.error('测试脚本执行失败:', error);
  process.exit(1);
});
