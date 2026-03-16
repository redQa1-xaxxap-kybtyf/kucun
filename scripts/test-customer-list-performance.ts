/**
 * 客户列表查询性能测试脚本
 *
 * 用途：
 * 1. 对比优化前后的性能差异
 * 2. 验证查询结果的准确性
 * 3. 生成性能报告
 *
 * 使用方法：
 * ```bash
 * npx tsx scripts/test-customer-list-performance.ts
 * ```
 */

import { getCustomerList } from '@/lib/api/customer-handlers';
import { prisma } from '@/lib/db';
import type { CustomerQueryParams } from '@/lib/types/customer';

interface PerformanceResult {
  testName: string;
  duration: number;
  queryCount: number;
  dataSize: number;
  customerCount: number;
  success: boolean;
  error?: string;
}

/**
 * 测试查询性能
 */
async function testQueryPerformance(
  params: CustomerQueryParams,
  testName: string
): Promise<PerformanceResult> {
  const startTime = Date.now();
  let queryCount = 0;
  let success = true;
  let error: string | undefined;
  let customerCount = 0;
  let dataSize = 0;

  try {
    // 监控数据库查询次数
    const originalQuery = prisma.$queryRaw;
    prisma.$queryRaw = (async (...args) => {
      queryCount++;
      return originalQuery.apply(prisma, args);
    }) as typeof prisma.$queryRaw;

    // 执行查询
    const result = await getCustomerList(params);
    customerCount = result.data.length;
    dataSize = JSON.stringify(result).length;

    // 恢复原始查询方法
    prisma.$queryRaw = originalQuery;
  } catch (err) {
    success = false;
    error = err instanceof Error ? err.message : String(err);
  }

  const duration = Date.now() - startTime;

  return {
    testName,
    duration,
    queryCount,
    dataSize,
    customerCount,
    success,
    error,
  };
}

/**
 * 验证查询结果准确性
 */
async function verifyQueryAccuracy(params: CustomerQueryParams): Promise<{
  accurate: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    const result = await getCustomerList(params);

    // 验证每个客户的统计数据
    for (const customer of result.data) {
      // 验证订单总数
      const actualOrderCount = await prisma.salesOrder.count({
        where: { customerId: customer.id },
      });

      if (customer.totalOrders !== actualOrderCount) {
        issues.push(
          `客户 ${customer.name} 的订单总数不匹配: 期望 ${actualOrderCount}, 实际 ${customer.totalOrders}`
        );
      }

      // 验证订单总额
      const orderStats = await prisma.salesOrder.aggregate({
        where: {
          customerId: customer.id,
          status: { notIn: ['cancelled', 'draft'] },
        },
        _sum: { totalAmount: true },
      });

      const expectedTotalAmount = Number(orderStats._sum.totalAmount ?? 0);
      const actualTotalAmount = Number(customer.totalAmount ?? 0);

      if (Math.abs(expectedTotalAmount - actualTotalAmount) > 0.01) {
        issues.push(
          `客户 ${customer.name} 的订单总额不匹配: 期望 ${expectedTotalAmount}, 实际 ${actualTotalAmount}`
        );
      }

      // 验证退货次数
      const returnCount = await prisma.returnOrder.count({
        where: {
          customerId: customer.id,
          status: { not: 'cancelled' },
        },
      });

      if (customer.returnOrderCount !== returnCount) {
        issues.push(
          `客户 ${customer.name} 的退货次数不匹配: 期望 ${returnCount}, 实际 ${customer.returnOrderCount}`
        );
      }
    }
  } catch (err) {
    issues.push(
      `验证失败: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return {
    accurate: issues.length === 0,
    issues,
  };
}

/**
 * 运行性能测试套件
 */
async function runPerformanceTests() {
  console.log('🚀 开始客户列表查询性能测试...\n');

  const tests: Array<{ params: CustomerQueryParams; name: string }> = [
    {
      name: '基础查询（20条）',
      params: { page: 1, limit: 20 },
    },
    {
      name: '大数据量查询（100条）',
      params: { page: 1, limit: 100 },
    },
    {
      name: '搜索查询',
      params: { page: 1, limit: 20, search: '测试' },
    },
    {
      name: '按订单总额排序',
      params: { page: 1, limit: 20, sortBy: 'totalAmount', sortOrder: 'desc' },
    },
    {
      name: '按合作天数排序',
      params: {
        page: 1,
        limit: 20,
        sortBy: 'cooperationDays',
        sortOrder: 'desc',
      },
    },
    {
      name: '按创建时间排序',
      params: { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
    },
  ];

  const results: PerformanceResult[] = [];

  for (const test of tests) {
    console.log(`📊 测试: ${test.name}`);
    const result = await testQueryPerformance(test.params, test.name);
    results.push(result);

    if (result.success) {
      console.log(`  ✅ 成功`);
      console.log(`  ⏱️  耗时: ${result.duration}ms`);
      console.log(`  🔍 查询次数: ${result.queryCount}`);
      console.log(`  📦 数据大小: ${(result.dataSize / 1024).toFixed(2)} KB`);
      console.log(`  👥 客户数量: ${result.customerCount}`);
    } else {
      console.log(`  ❌ 失败: ${result.error}`);
    }
    console.log('');
  }

  // 生成性能报告
  console.log('📈 性能测试报告\n');
  console.log(
    '┌─────────────────────────────┬──────────┬────────────┬──────────────┐'
  );
  console.log(
    '│ 测试名称                    │ 耗时(ms) │ 查询次数   │ 数据大小(KB) │'
  );
  console.log(
    '├─────────────────────────────┼──────────┼────────────┼──────────────┤'
  );

  for (const result of results) {
    const name = result.testName.padEnd(27);
    const duration = result.duration.toString().padStart(8);
    const queryCount = result.queryCount.toString().padStart(10);
    const dataSize = (result.dataSize / 1024).toFixed(2).padStart(12);

    console.log(`│ ${name} │ ${duration} │ ${queryCount} │ ${dataSize} │`);
  }

  console.log(
    '└─────────────────────────────┴──────────┴────────────┴──────────────┘\n'
  );

  // 计算平均性能
  const avgDuration =
    results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const avgQueryCount =
    results.reduce((sum, r) => sum + r.queryCount, 0) / results.length;

  console.log(`📊 平均性能指标:`);
  console.log(`  - 平均响应时间: ${avgDuration.toFixed(2)}ms`);
  console.log(`  - 平均查询次数: ${avgQueryCount.toFixed(2)}`);
  console.log('');

  // 性能评估
  console.log('🎯 性能评估:');
  if (avgDuration < 500) {
    console.log('  ✅ 响应时间优秀 (< 500ms)');
  } else if (avgDuration < 1000) {
    console.log('  ⚠️  响应时间良好 (500-1000ms)');
  } else {
    console.log('  ❌ 响应时间需要优化 (> 1000ms)');
  }

  if (avgQueryCount <= 5) {
    console.log('  ✅ 查询次数优秀 (≤ 5次)');
  } else if (avgQueryCount <= 10) {
    console.log('  ⚠️  查询次数良好 (5-10次)');
  } else {
    console.log('  ❌ 查询次数需要优化 (> 10次)');
  }
  console.log('');

  // 验证数据准确性
  console.log('🔍 验证数据准确性...\n');
  const accuracy = await verifyQueryAccuracy({ page: 1, limit: 5 });

  if (accuracy.accurate) {
    console.log('✅ 数据准确性验证通过\n');
  } else {
    console.log('❌ 数据准确性验证失败:\n');
    accuracy.issues.forEach(issue => {
      console.log(`  - ${issue}`);
    });
    console.log('');
  }

  // 总结
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  console.log('📋 测试总结:');
  console.log(`  - 总测试数: ${results.length}`);
  console.log(`  - 成功: ${successCount}`);
  console.log(`  - 失败: ${failCount}`);
  console.log(`  - 数据准确性: ${accuracy.accurate ? '✅ 通过' : '❌ 失败'}`);
  console.log('');

  if (failCount === 0 && accuracy.accurate) {
    console.log('🎉 所有测试通过！');
  } else {
    console.log('⚠️  部分测试失败，请检查问题。');
  }
}

// 执行测试
runPerformanceTests()
  .catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
