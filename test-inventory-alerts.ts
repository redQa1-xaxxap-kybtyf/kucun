/**
 * 库存预警API性能测试脚本
 *
 * 用途：
 * 1. 验证API功能是否正常
 * 2. 测试查询参数过滤功能
 * 3. 对比优化前后的性能
 * 4. 验证缓存机制
 *
 * 使用方法：
 * npx tsx test-inventory-alerts.ts
 */

const API_BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  recordCount: number;
  error?: string;
}

/**
 * 执行API请求并测量性能
 */
async function testApiCall(
  name: string,
  url: string,
  headers: Record<string, string> = {}
): Promise<TestResult> {
  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    const duration = performance.now() - startTime;
    const data = await response.json();

    if (!response.ok) {
      return {
        name,
        success: false,
        duration,
        recordCount: 0,
        error: data.error || response.statusText,
      };
    }

    return {
      name,
      success: data.success,
      duration,
      recordCount: data.total || 0,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      name,
      success: false,
      duration,
      recordCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 打印测试结果
 */
function printResult(result: TestResult) {
  const status = result.success ? '✅ 成功' : '❌ 失败';
  const duration = `${result.duration.toFixed(2)}ms`;
  const records = `${result.recordCount}条记录`;

  console.log(`\n${result.name}`);
  console.log(`  状态: ${status}`);
  console.log(`  耗时: ${duration}`);
  console.log(`  数据: ${records}`);

  if (result.error) {
    console.log(`  错误: ${result.error}`);
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('库存预警API性能测试');
  console.log('='.repeat(60));

  const results: TestResult[] = [];

  // 测试1：基础查询（无过滤）
  console.log('\n【测试1】基础查询（无过滤）');
  const test1 = await testApiCall(
    '基础查询',
    `${API_BASE_URL}/api/inventory/alerts`
  );
  results.push(test1);
  printResult(test1);

  // 等待1秒，确保缓存生效
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 测试2：缓存命中测试（重复查询）
  console.log('\n【测试2】缓存命中测试（重复查询）');
  const test2 = await testApiCall(
    '缓存命中',
    `${API_BASE_URL}/api/inventory/alerts`
  );
  results.push(test2);
  printResult(test2);

  // 测试3：按严重程度过滤（critical）
  console.log('\n【测试3】按严重程度过滤（critical）');
  const test3 = await testApiCall(
    '严重程度=critical',
    `${API_BASE_URL}/api/inventory/alerts?severity=critical`
  );
  results.push(test3);
  printResult(test3);

  // 测试4：按严重程度过滤（warning）
  console.log('\n【测试4】按严重程度过滤（warning）');
  const test4 = await testApiCall(
    '严重程度=warning',
    `${API_BASE_URL}/api/inventory/alerts?severity=warning`
  );
  results.push(test4);
  printResult(test4);

  // 测试5：限制返回数量
  console.log('\n【测试5】限制返回数量（limit=10）');
  const test5 = await testApiCall(
    'limit=10',
    `${API_BASE_URL}/api/inventory/alerts?limit=10`
  );
  results.push(test5);
  printResult(test5);

  // 测试6：按productId过滤（需要实际的productId）
  console.log('\n【测试6】按productId过滤（功能验证）');
  console.log('  提示: 请替换为实际的productId进行测试');
  // 这里需要用户提供实际的productId
  // const test6 = await testApiCall(
  //   '按productId过滤',
  //   `${API_BASE_URL}/api/inventory/alerts?productId=xxx`
  // );
  // results.push(test6);
  // printResult(test6);

  // 测试7：按categoryId过滤（需要实际的categoryId）
  console.log('\n【测试7】按categoryId过滤（功能验证）');
  console.log('  提示: 请替换为实际的categoryId进行测试');
  // const test7 = await testApiCall(
  //   '按categoryId过滤',
  //   `${API_BASE_URL}/api/inventory/alerts?categoryId=xxx`
  // );
  // results.push(test7);
  // printResult(test7);

  // 测试8：组合参数测试
  console.log('\n【测试8】组合参数测试');
  const test8 = await testApiCall(
    '组合参数',
    `${API_BASE_URL}/api/inventory/alerts?severity=critical&limit=5`
  );
  results.push(test8);
  printResult(test8);

  // 测试9：无效参数测试（验证参数验证）
  console.log('\n【测试9】无效参数测试（验证参数验证）');
  const test9 = await testApiCall(
    '无效severity',
    `${API_BASE_URL}/api/inventory/alerts?severity=invalid`
  );
  results.push(test9);
  printResult(test9);

  // 测试10：性能压力测试（连续10次查询）
  console.log('\n【测试10】性能压力测试（连续10次查询）');
  const durations: number[] = [];

  for (let i = 0; i < 10; i++) {
    const result = await testApiCall(
      `压力测试 ${i + 1}/10`,
      `${API_BASE_URL}/api/inventory/alerts?_=${Date.now()}` // 避免缓存
    );
    durations.push(result.duration);
  }

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  console.log(`  平均耗时: ${avgDuration.toFixed(2)}ms`);
  console.log(`  最快耗时: ${minDuration.toFixed(2)}ms`);
  console.log(`  最慢耗时: ${maxDuration.toFixed(2)}ms`);

  // 总结报告
  console.log('\n' + '='.repeat(60));
  console.log('测试总结');
  console.log('='.repeat(60));

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  const avgTestDuration =
    results.reduce((sum, r) => sum + r.duration, 0) / results.length;

  console.log(`\n总测试数: ${results.length}`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${failCount}`);
  console.log(`平均响应时间: ${avgTestDuration.toFixed(2)}ms`);

  // 性能评级
  let performanceGrade = 'A';
  if (avgTestDuration > 100) performanceGrade = 'B';
  if (avgTestDuration > 300) performanceGrade = 'C';
  if (avgTestDuration > 500) performanceGrade = 'D';
  if (avgTestDuration > 1000) performanceGrade = 'F';

  console.log(`性能评级: ${performanceGrade}`);

  // 缓存效果分析
  if (results.length >= 2) {
    const firstCallDuration = results[0].duration;
    const cachedCallDuration = results[1].duration;
    const cacheSpeedup = firstCallDuration / cachedCallDuration;

    console.log('\n缓存效果分析:');
    console.log(`  首次调用: ${firstCallDuration.toFixed(2)}ms`);
    console.log(`  缓存调用: ${cachedCallDuration.toFixed(2)}ms`);
    console.log(`  加速比: ${cacheSpeedup.toFixed(2)}x`);
  }

  // 优化建议
  console.log('\n优化建议:');
  if (avgTestDuration > 500) {
    console.log('  ⚠️  平均响应时间较慢，建议检查：');
    console.log('      1. 数据库索引是否已创建');
    console.log('      2. 数据量是否过大');
    console.log('      3. Redis缓存是否正常工作');
  } else if (avgTestDuration > 100) {
    console.log('  ℹ️  性能良好，可考虑：');
    console.log('      1. 添加更多数据库索引');
    console.log('      2. 优化缓存策略');
  } else {
    console.log('  ✅ 性能优秀，无需额外优化');
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * 获取实际的产品ID和分类ID（用于测试）
 */
async function getTestIds() {
  console.log('\n正在获取测试用的ID...');

  try {
    // 获取产品列表
    const productsResponse = await fetch(
      `${API_BASE_URL}/api/products?page=1&pageSize=1`
    );
    const productsData = await productsResponse.json();

    if (productsData.success && productsData.data.length > 0) {
      const productId = productsData.data[0].id;
      const categoryId = productsData.data[0].categoryId;

      console.log(`  找到产品ID: ${productId}`);
      if (categoryId) {
        console.log(`  找到分类ID: ${categoryId}`);
      }

      return { productId, categoryId };
    }

    return null;
  } catch (error) {
    console.log('  ⚠️  无法获取测试ID，跳过相关测试');
    return null;
  }
}

/**
 * 扩展测试（包含实际ID的测试）
 */
async function runExtendedTests() {
  const ids = await getTestIds();

  if (!ids) {
    console.log('\n⚠️  跳过扩展测试（无法获取测试ID）');
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('扩展测试（使用实际ID）');
  console.log('='.repeat(60));

  // 测试按productId过滤
  if (ids.productId) {
    console.log('\n【扩展测试1】按productId过滤');
    const test1 = await testApiCall(
      '按productId过滤',
      `${API_BASE_URL}/api/inventory/alerts?productId=${ids.productId}`
    );
    printResult(test1);
  }

  // 测试按categoryId过滤
  if (ids.categoryId) {
    console.log('\n【扩展测试2】按categoryId过滤');
    const test2 = await testApiCall(
      '按categoryId过滤',
      `${API_BASE_URL}/api/inventory/alerts?categoryId=${ids.categoryId}`
    );
    printResult(test2);
  }
}

/**
 * 主入口
 */
async function main() {
  try {
    // 检查服务是否运行
    console.log('检查API服务...');
    const healthCheck = await fetch(`${API_BASE_URL}/api/health`).catch(
      () => null
    );

    if (!healthCheck) {
      console.error(
        '\n❌ 无法连接到API服务，请确保：\n' +
          '  1. npm run dev 正在运行\n' +
          '  2. API服务监听在 http://localhost:3000\n'
      );
      return;
    }

    console.log('✅ API服务正常\n');

    // 运行基础测试
    await runTests();

    // 运行扩展测试
    await runExtendedTests();
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

// 执行测试
main();
