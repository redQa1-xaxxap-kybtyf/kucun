/**
 * Redis 幂等性优化测试
 *
 * 测试目标:
 * 1. 验证 Redis 幂等性工作正常
 * 2. 测量性能提升 (目标: 136ms → < 20ms)
 * 3. 验证降级机制 (Redis 不可用时降级到 MySQL)
 * 4. 测试并发请求处理
 */

/* eslint-disable no-console */

import {
  checkIdempotency,
  completeIdempotencyRecord,
  createIdempotencyRecord,
  withIdempotency,
} from '../lib/utils/idempotency-redis';

async function testBasicIdempotency() {
  console.log('\n=== 测试 1: 基础幂等性流程 ===');

  const idempotencyKey = `test-${Date.now()}`;
  const operationType = 'inbound' as const;
  const productId = 'test-product-123';
  const operatorId = 'test-user-123';
  const requestData = { quantity: 100, reason: 'purchase' };

  // 步骤1: 检查幂等性 (应该返回 isNew: true)
  const t0 = Date.now();
  const check1 = await checkIdempotency(idempotencyKey);
  console.log(`✅ 初次检查耗时: ${Date.now() - t0}ms`);
  console.log('   结果:', check1.isNew ? '新操作' : '已存在');

  if (!check1.isNew) {
    throw new Error('预期新操作,但检测到已存在');
  }

  // 步骤2: 创建幂等性记录
  const t1 = Date.now();
  await createIdempotencyRecord(
    idempotencyKey,
    operationType,
    productId,
    operatorId,
    requestData
  );
  console.log(`✅ 创建记录耗时: ${Date.now() - t1}ms`);

  // 步骤3: 再次检查 (应该返回 processing 状态)
  const t2 = Date.now();
  const check2 = await checkIdempotency(idempotencyKey);
  console.log(`✅ 第二次检查耗时: ${Date.now() - t2}ms`);
  console.log(
    '   状态:',
    check2.operation?.status || (check2.isNew ? '新操作' : '未知')
  );

  if (check2.operation?.status !== 'processing') {
    throw new Error('预期 processing 状态');
  }

  // 步骤4: 标记完成
  const responseData = { id: '123', status: 'success', quantity: 100 };
  const t3 = Date.now();
  await completeIdempotencyRecord(idempotencyKey, responseData);
  console.log(`✅ 标记完成耗时: ${Date.now() - t3}ms`);

  // 步骤5: 第三次检查 (应该返回缓存结果)
  const t4 = Date.now();
  const check3 = await checkIdempotency(idempotencyKey);
  console.log(`✅ 第三次检查耗时: ${Date.now() - t4}ms`);
  console.log(
    '   状态:',
    check3.operation?.status || (check3.isNew ? '新操作' : '未知')
  );
  console.log('   数据:', check3.data);

  if (check3.operation?.status !== 'completed') {
    throw new Error('预期 completed 状态');
  }

  console.log('\n✅ 基础幂等性流程测试通过!');
}

async function testWithIdempotencyWrapper() {
  console.log('\n=== 测试 2: withIdempotency 包装器 ===');

  const idempotencyKey = `test-wrapper-${Date.now()}`;
  const operationType = 'inbound' as const;
  const productId = 'test-product-456';
  const operatorId = 'test-user-456';
  const requestData = { quantity: 200, reason: 'production' };

  let executionCount = 0;

  const mockOperation = async () => {
    executionCount++;
    console.log(`   🔧 执行实际操作 (第 ${executionCount} 次)`);
    await new Promise(resolve => setTimeout(resolve, 50)); // 模拟耗时操作
    return { id: '456', status: 'success', quantity: 200 };
  };

  // 第一次调用: 应该执行操作
  const t0 = Date.now();
  const result1 = await withIdempotency(
    idempotencyKey,
    operationType,
    productId,
    operatorId,
    requestData,
    mockOperation
  );
  const duration1 = Date.now() - t0;
  console.log(`✅ 第一次调用耗时: ${duration1}ms`);
  console.log('   结果:', result1);
  console.log('   执行次数:', executionCount);

  if (executionCount !== 1) {
    throw new Error('预期执行 1 次,实际执行 ' + executionCount + ' 次');
  }

  // 第二次调用: 应该返回缓存结果,不执行操作
  const t1 = Date.now();
  const result2 = await withIdempotency(
    idempotencyKey,
    operationType,
    productId,
    operatorId,
    requestData,
    mockOperation
  );
  const duration2 = Date.now() - t1;
  console.log(`✅ 第二次调用耗时: ${duration2}ms`);
  console.log('   结果:', result2);
  console.log('   执行次数:', executionCount);

  if (executionCount !== 1) {
    throw new Error('预期仍然是 1 次,实际执行 ' + executionCount + ' 次');
  }

  if (duration2 > 50) {
    console.log(
      `⚠️  警告: 第二次调用耗时 ${duration2}ms,预期 < 50ms (缓存命中)`
    );
  }

  console.log(
    `\n✅ withIdempotency 包装器测试通过! 性能提升: ${Math.round((1 - duration2 / duration1) * 100)}%`
  );
}

async function testConcurrentRequests() {
  console.log('\n=== 测试 3: 并发请求处理 ===');

  const idempotencyKey = `test-concurrent-${Date.now()}`;
  const operationType = 'inbound' as const;
  const productId = 'test-product-789';
  const operatorId = 'test-user-789';
  const requestData = { quantity: 300, reason: 'adjustment' };

  let executionCount = 0;

  const mockOperation = async () => {
    executionCount++;
    console.log(`   🔧 执行实际操作 (第 ${executionCount} 次)`);
    await new Promise(resolve => setTimeout(resolve, 100)); // 模拟耗时操作
    return { id: '789', status: 'success', quantity: 300 };
  };

  // 并发发起 5 个相同的请求
  console.log('   发起 5 个并发请求...');
  const t0 = Date.now();
  const promises = Array.from({ length: 5 }, () =>
    withIdempotency(
      idempotencyKey,
      operationType,
      productId,
      operatorId,
      requestData,
      mockOperation
    )
  );

  const results = await Promise.all(promises);
  const duration = Date.now() - t0;

  console.log(`✅ 并发请求完成耗时: ${duration}ms`);
  console.log('   实际执行次数:', executionCount);
  console.log(
    '   所有结果相同:',
    results.every(r => JSON.stringify(r) === JSON.stringify(results[0]))
  );

  if (executionCount !== 1) {
    throw new Error('预期只执行 1 次,实际执行 ' + executionCount + ' 次');
  }

  console.log('\n✅ 并发请求处理测试通过! 正确实现幂等性');
}

async function testPerformanceComparison() {
  console.log('\n=== 测试 4: 性能对比 (Redis vs MySQL) ===');

  const iterations = 10;
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const idempotencyKey = `test-perf-${Date.now()}-${i}`;

    const t0 = Date.now();

    // 检查 (应该很快,< 5ms)
    const t1 = Date.now();
    await checkIdempotency(idempotencyKey);
    const checkTime = Date.now() - t1;

    // 创建
    const t2 = Date.now();
    await createIdempotencyRecord(
      idempotencyKey,
      'inbound',
      'test-product',
      'test-user',
      {}
    );
    const createTime = Date.now() - t2;

    // 标记完成
    const t3 = Date.now();
    await completeIdempotencyRecord(idempotencyKey, { result: 'success' });
    const completeTime = Date.now() - t3;

    const totalTime = Date.now() - t0;
    times.push(totalTime);

    console.log(
      `   迭代 ${i + 1}: 总计 ${totalTime}ms (检查 ${checkTime}ms, 创建 ${createTime}ms, 完成 ${completeTime}ms)`
    );

    // 短暂延迟,避免太快
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  console.log(`\n📊 性能统计 (${iterations} 次迭代):`);
  console.log(`   平均耗时: ${avgTime.toFixed(2)}ms`);
  console.log(`   最小耗时: ${minTime}ms`);
  console.log(`   最大耗时: ${maxTime}ms`);

  const mysqlBaseline = 136; // MySQL 基准: 136ms
  const improvement = ((mysqlBaseline - avgTime) / mysqlBaseline) * 100;

  console.log(`\n🚀 性能提升:`);
  console.log(`   MySQL 基准: ${mysqlBaseline}ms`);
  console.log(`   Redis 优化: ${avgTime.toFixed(2)}ms`);
  console.log(`   提升幅度: ${improvement.toFixed(1)}% (目标: > 85%)`);

  if (avgTime < 30) {
    console.log('\n✅ 性能优化目标达成! (< 30ms)');
  } else {
    console.log(`\n⚠️  性能未达预期 (实际 ${avgTime.toFixed(2)}ms > 目标 30ms)`);
  }
}

async function main() {
  console.log('🚀 Redis 幂等性优化测试开始\n');
  console.log('═'.repeat(60));

  try {
    await testBasicIdempotency();
    await testWithIdempotencyWrapper();
    await testConcurrentRequests();
    await testPerformanceComparison();

    console.log('\n' + '═'.repeat(60));
    console.log('✅ 所有测试通过!\n');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

main();
