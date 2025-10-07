/**
 * 幂等性实现并发测试
 * 验证修复后的withIdempotency函数在并发场景下的表现
 */

import { prisma } from '@/lib/db';
import { withIdempotency } from '@/lib/utils/idempotency';

// 模拟一个耗时的操作
async function simulateOperation(id: string, delayMs: number = 1000) {
  await new Promise(resolve => setTimeout(resolve, delayMs));
  return {
    id,
    timestamp: new Date().toISOString(),
    message: `操作完成 - ${id}`,
  };
}

/**
 * 测试场景1：并发请求相同幂等性键
 * 预期：所有请求都成功，返回相同结果，只执行一次操作
 */
async function testConcurrentRequests() {
  console.log('\n=== 测试场景1：并发请求相同幂等性键 ===');

  const idempotencyKey = `test-concurrent-${Date.now()}`;
  const productId = 'test-product-1';
  const operatorId = 'test-user-1';

  let executionCount = 0;

  // 创建10个并发请求
  const promises = Array.from({ length: 10 }, (_, i) =>
    withIdempotency(
      idempotencyKey,
      'inbound',
      productId,
      operatorId,
      { test: true, index: i },
      async () => {
        executionCount++;
        console.log(`  请求${i + 1}开始执行实际操作`);
        return await simulateOperation(`request-${i + 1}`, 2000);
      }
    )
  );

  try {
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const endTime = Date.now();

    console.log(`\n结果：`);
    console.log(`  - 总耗时: ${endTime - startTime}ms`);
    console.log(`  - 实际执行次数: ${executionCount} (预期: 1)`);
    console.log(`  - 成功请求数: ${results.length} (预期: 10)`);

    // 验证所有结果相同
    const firstResult = JSON.stringify(results[0]);
    const allSame = results.every(r => JSON.stringify(r) === firstResult);
    console.log(`  - 所有结果相同: ${allSame ? '✅' : '❌'}`);

    if (!allSame) {
      console.log(
        `  结果详情:`,
        results.map((r, i) => `请求${i + 1}: ${r.id}`)
      );
    }

    // 验证数据库中只有一条记录
    const dbRecords = await prisma.inventoryOperation.count({
      where: { idempotencyKey },
    });
    console.log(`  - 数据库记录数: ${dbRecords} (预期: 1)`);

    return executionCount === 1 && allSame && dbRecords === 1;
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

/**
 * 测试场景2：操作失败后重试
 * 预期：第一次失败，第二次成功
 */
async function testFailureRetry() {
  console.log('\n=== 测试场景2：操作失败后重试 ===');

  const idempotencyKey = `test-failure-${Date.now()}`;
  const productId = 'test-product-2';
  const operatorId = 'test-user-2';

  // 第一次请求：故意失败
  try {
    await withIdempotency(
      idempotencyKey,
      'outbound',
      productId,
      operatorId,
      { test: true, attempt: 1 },
      async () => {
        throw new Error('模拟操作失败');
      }
    );
  } catch (error: any) {
    console.log(`  第一次请求失败（预期）: ${error.message}`);
  }

  // 检查状态
  const record = await prisma.inventoryOperation.findUnique({
    where: { idempotencyKey },
  });
  console.log(`  - 记录状态: ${record?.status} (预期: failed)`);

  // 第二次请求：应该成功
  try {
    const result = await withIdempotency(
      idempotencyKey,
      'outbound',
      productId,
      operatorId,
      { test: true, attempt: 2 },
      async () => {
        return { success: true, message: '重试成功' };
      }
    );

    console.log(`  第二次请求成功: ${result.message}`);

    const updatedRecord = await prisma.inventoryOperation.findUnique({
      where: { idempotencyKey },
    });
    console.log(`  - 更新后状态: ${updatedRecord?.status} (预期: completed)`);

    return updatedRecord?.status === 'completed';
  } catch (error) {
    console.error('❌ 重试失败:', error);
    return false;
  }
}

/**
 * 测试场景3：竞态条件压力测试
 * 预期：在极短时间内发起的请求也能正确处理
 */
async function testRaceConditionStress() {
  console.log('\n=== 测试场景3：竞态条件压力测试 ===');

  const results: boolean[] = [];

  // 执行5轮测试，每轮100个并发请求
  for (let round = 1; round <= 5; round++) {
    const idempotencyKey = `test-race-${Date.now()}-${round}`;
    const productId = `test-product-race-${round}`;
    const operatorId = 'test-user-race';

    let executionCount = 0;

    const promises = Array.from({ length: 100 }, (_, i) =>
      withIdempotency(
        idempotencyKey,
        'adjust',
        productId,
        operatorId,
        { round, index: i },
        async () => {
          executionCount++;
          // 极短的操作时间，增加竞态条件概率
          await new Promise(resolve => setTimeout(resolve, 10));
          return { round, executionCount };
        }
      )
    );

    try {
      await Promise.all(promises);
      const success = executionCount === 1;
      results.push(success);
      console.log(
        `  第${round}轮: ${success ? '✅' : '❌'} (执行次数: ${executionCount})`
      );
    } catch (error) {
      console.error(`  第${round}轮失败:`, error);
      results.push(false);
    }
  }

  const successRate = results.filter(r => r).length / results.length;
  console.log(`\n  成功率: ${(successRate * 100).toFixed(1)}% (预期: 100%)`);

  return successRate === 1;
}

/**
 * 测试场景4：超时保护
 * 预期：长时间操作触发超时错误
 */
async function testTimeoutProtection() {
  console.log('\n=== 测试场景4：超时保护 ===');

  const idempotencyKey = `test-timeout-${Date.now()}`;
  const productId = 'test-product-timeout';
  const operatorId = 'test-user-timeout';

  try {
    // 第一个请求：模拟一个永不完成的操作
    const slowPromise = withIdempotency(
      idempotencyKey,
      'inbound',
      productId,
      operatorId,
      { test: true },
      async () => {
        // 模拟一个非常慢的操作（10秒）
        await new Promise(resolve => setTimeout(resolve, 10000));
        return { message: '不应该到达这里' };
      }
    );

    // 等待一小段时间后发起第二个请求
    await new Promise(resolve => setTimeout(resolve, 100));

    // 第二个请求：应该在等待超时后失败
    const timeoutPromise = withIdempotency(
      idempotencyKey,
      'inbound',
      productId,
      operatorId,
      { test: true },
      async () => {
        return { message: '不应该执行' };
      }
    );

    await timeoutPromise;
    console.log('  ❌ 未触发超时（预期应该超时）');
    return false;
  } catch (error: any) {
    if (error.message.includes('操作超时')) {
      console.log(`  ✅ 正确触发超时: ${error.message}`);
      return true;
    } else {
      console.log(`  ❌ 错误类型不对: ${error.message}`);
      return false;
    }
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 开始幂等性并发测试\n');

  const results = {
    concurrent: false,
    failureRetry: false,
    raceCondition: false,
    timeout: false,
  };

  try {
    results.concurrent = await testConcurrentRequests();
    results.failureRetry = await testFailureRetry();
    results.raceCondition = await testRaceConditionStress();
    // results.timeout = await testTimeoutProtection(); // 此测试耗时较长，可选

    console.log('\n\n📊 测试结果汇总：');
    console.log('='.repeat(50));
    console.log(
      `  并发请求测试:     ${results.concurrent ? '✅ 通过' : '❌ 失败'}`
    );
    console.log(
      `  失败重试测试:     ${results.failureRetry ? '✅ 通过' : '❌ 失败'}`
    );
    console.log(
      `  竞态压力测试:     ${results.raceCondition ? '✅ 通过' : '❌ 失败'}`
    );
    // console.log(`  超时保护测试:     ${results.timeout ? '✅ 通过' : '❌ 失败'}`);

    const allPassed = Object.values(results).every(r => r);
    console.log('\n' + '='.repeat(50));
    console.log(allPassed ? '✅ 所有测试通过！' : '❌ 部分测试失败');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('\n💥 测试执行出错:', error);
  } finally {
    // 清理测试数据
    await prisma.inventoryOperation.deleteMany({
      where: {
        idempotencyKey: {
          startsWith: 'test-',
        },
      },
    });
    console.log('\n🧹 测试数据已清理');

    await prisma.$disconnect();
  }
}

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };
