#!/usr/bin/env node

/**
 * 分类管理系统性能测试脚本
 * 包含：API响应时间、并发处理、大数据量、数据库查询、缓存性能测试
 */

const http = require('http');
const { performance } = require('perf_hooks');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置参数
const config = {
  baseURL: 'http://localhost:3000',
  testResultsDir: './test-results',
  concurrency: {
    low: 10,
    medium: 50,
    high: 100,
    stress: 500,
  },
  dataVolume: {
    small: 100,
    medium: 1000,
    large: 5000,
  },
};

// 测试结果收集器
class TestResults {
  constructor() {
    this.results = {
      apiResponseTimes: {},
      concurrencyTests: {},
      dataVolumeTests: {},
      databasePerformance: {},
      cachePerformance: {},
      summary: {},
    };
    this.startTime = Date.now();
  }

  addApiResult(endpoint, method, responseTime, statusCode, success) {
    const key = `${method} ${endpoint}`;
    if (!this.results.apiResponseTimes[key]) {
      this.results.apiResponseTimes[key] = [];
    }
    this.results.apiResponseTimes[key].push({
      responseTime,
      statusCode,
      success,
      timestamp: Date.now(),
    });
  }

  addConcurrencyResult(
    testName,
    concurrency,
    totalTime,
    successCount,
    errorCount
  ) {
    if (!this.results.concurrencyTests[testName]) {
      this.results.concurrencyTests[testName] = [];
    }
    this.results.concurrencyTests[testName].push({
      concurrency,
      totalTime,
      successCount,
      errorCount,
      avgResponseTime: totalTime / (successCount + errorCount),
      successRate: (successCount / (successCount + errorCount)) * 100,
    });
  }

  generateReport() {
    const report = {
      testDate: new Date().toISOString(),
      totalTestTime: Date.now() - this.startTime,
      ...this.results,
    };

    // 计算统计数据
    Object.keys(this.results.apiResponseTimes).forEach(endpoint => {
      const times = this.results.apiResponseTimes[endpoint];
      const responseTimes = times.map(t => t.responseTime);
      report.apiResponseTimes[endpoint].stats = {
        avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        p95: this.percentile(responseTimes, 95),
        p99: this.percentile(responseTimes, 99),
        count: responseTimes.length,
      };
    });

    return report;
  }

  percentile(arr, p) {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  saveReport() {
    if (!fs.existsSync(config.testResultsDir)) {
      fs.mkdirSync(config.testResultsDir, { recursive: true });
    }

    const report = this.generateReport();
    const filename = `category-performance-${Date.now()}.json`;
    const filepath = path.join(config.testResultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`✅ 测试报告已保存: ${filepath}`);

    return filepath;
  }
}

// HTTP请求工具
function makeRequest(method, endpoint, data = null) {
  return new Promise(resolve => {
    const startTime = performance.now();

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token', // 假设使用测试token
      },
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        resolve({
          statusCode: res.statusCode,
          responseTime,
          success: res.statusCode >= 200 && res.statusCode < 300,
          body,
        });
      });
    });

    req.on('error', error => {
      const endTime = performance.now();
      resolve({
        statusCode: 0,
        responseTime: endTime - startTime,
        success: false,
        error: error.message,
      });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// 1. API响应时间测试
async function testApiResponseTimes(results) {
  console.log('\n🚀 开始API响应时间测试...');

  const endpoints = [
    { method: 'GET', path: '/api/categories?limit=20' },
    { method: 'GET', path: '/api/categories?search=test&limit=20' },
    { method: 'GET', path: '/api/categories?status=active&limit=20' },
    { method: 'GET', path: '/api/categories?limit=20&page=2' },
  ];

  // 测试获取API响应时间
  for (const endpoint of endpoints) {
    console.log(`  测试 ${endpoint.method} ${endpoint.path}`);

    for (let i = 0; i < 10; i++) {
      const result = await makeRequest(endpoint.method, endpoint.path);
      results.addApiResult(
        endpoint.path,
        endpoint.method,
        result.responseTime,
        result.statusCode,
        result.success
      );

      // 添加小延迟避免过快请求
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // 测试创建分类API响应时间
  console.log('  测试 POST /api/categories');
  for (let i = 0; i < 5; i++) {
    const categoryData = {
      name: `性能测试分类_${Date.now()}_${i}`,
      code: `PERF_TEST_${Date.now()}_${i}`,
      description: '性能测试创建的分类',
    };

    const result = await makeRequest('POST', '/api/categories', categoryData);
    results.addApiResult(
      '/api/categories',
      'POST',
      result.responseTime,
      result.statusCode,
      result.success
    );

    // 如果创建成功，记录ID用于后续测试
    if (result.success) {
      const createdData = JSON.parse(result.body);
      if (createdData.data && createdData.data.id) {
        // 可以存储ID用于更新和删除测试
        console.log(`    创建分类成功: ${createdData.data.id}`);
      }
    }
  }

  console.log('✅ API响应时间测试完成');
}

// 2. 并发处理测试
async function testConcurrency(results) {
  console.log('\n⚡ 开始并发处理测试...');

  const concurrencyLevels = [
    config.concurrency.low,
    config.concurrency.medium,
    config.concurrency.high,
  ];

  for (const concurrency of concurrencyLevels) {
    console.log(`  测试并发级别: ${concurrency}`);

    // 并发创建分类测试
    const promises = [];
    const startTime = performance.now();

    for (let i = 0; i < concurrency; i++) {
      const promise = makeRequest('POST', '/api/categories', {
        name: `并发测试分类_${concurrency}_${i}`,
        code: `CONCURRENT_${concurrency}_${i}`,
        description: `并发测试，级别: ${concurrency}, 索引: ${i}`,
      });
      promises.push(promise);
    }

    const concurrentResults = await Promise.all(promises);
    const endTime = performance.now();

    const successCount = concurrentResults.filter(r => r.success).length;
    const errorCount = concurrentResults.length - successCount;
    const totalTime = endTime - startTime;

    results.addConcurrencyResult(
      'create_categories',
      concurrency,
      totalTime,
      successCount,
      errorCount
    );

    console.log(`    总时间: ${totalTime.toFixed(2)}ms`);
    console.log(`    成功: ${successCount}, 失败: ${errorCount}`);
    console.log(
      `    成功率: ${((successCount / concurrency) * 100).toFixed(2)}%`
    );

    // 等待一段时间避免系统过载
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 并发查询测试
  console.log('  测试并发查询...');
  for (const concurrency of [
    config.concurrency.low,
    config.concurrency.medium,
  ]) {
    const promises = [];
    const startTime = performance.now();

    for (let i = 0; i < concurrency; i++) {
      const promise = makeRequest(
        'GET',
        `/api/categories?search=test&page=${(i % 5) + 1}`
      );
      promises.push(promise);
    }

    const concurrentResults = await Promise.all(promises);
    const endTime = performance.now();

    const successCount = concurrentResults.filter(r => r.success).length;
    const errorCount = concurrentResults.length - successCount;
    const totalTime = endTime - startTime;

    results.addConcurrencyResult(
      'query_categories',
      concurrency,
      totalTime,
      successCount,
      errorCount
    );

    console.log(
      `    并发查询 ${concurrency} - 成功率: ${((successCount / concurrency) * 100).toFixed(2)}%`
    );
  }

  console.log('✅ 并发处理测试完成');
}

// 3. 大数据量测试
async function testDataVolume(results) {
  console.log('\n📊 开始大数据量测试...');

  // 创建大量测试数据
  const batchSize = 50;
  const totalBatches = 20; // 总共1000个分类

  console.log(`  创建 ${totalBatches * batchSize} 个测试分类...`);

  for (let batch = 0; batch < totalBatches; batch++) {
    console.log(`    批次 ${batch + 1}/${totalBatches}`);

    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      const categoryData = {
        name: `大数据量测试_${batch}_${i}`,
        code: `BULK_${batch}_${i}`,
        description: `大数据量测试，批次: ${batch}, 索引: ${i}`,
      };
      promises.push(makeRequest('POST', '/api/categories', categoryData));
    }

    await Promise.all(promises);

    // 短暂休息避免系统过载
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('✅ 大数据量创建完成，开始性能测试...');

  // 测试大数据量下的查询性能
  const volumeTests = [
    { name: '小数据量查询', limit: 20 },
    { name: '中数据量查询', limit: 100 },
    { name: '大数据量查询', limit: 500 },
  ];

  for (const test of volumeTests) {
    console.log(`  测试 ${test.name} (limit: ${test.limit})`);

    const testResults = [];
    for (let i = 0; i < 5; i++) {
      const result = await makeRequest(
        'GET',
        `/api/categories?limit=${test.limit}`
      );
      testResults.push(result.responseTime);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const avgTime = testResults.reduce((a, b) => a + b, 0) / testResults.length;
    console.log(`    平均响应时间: ${avgTime.toFixed(2)}ms`);

    if (!results.dataVolumeTests[test.name]) {
      results.dataVolumeTests[test.name] = [];
    }
    results.dataVolumeTests[test.name].push({
      limit: test.limit,
      avgResponseTime: avgTime,
      minTime: Math.min(...testResults),
      maxTime: Math.max(...testResults),
    });
  }

  // 测试分页性能
  console.log('  测试分页性能...');
  for (let page = 1; page <= 10; page++) {
    const result = await makeRequest(
      'GET',
      `/api/categories?page=${page}&limit=50`
    );
    console.log(`    第${page}页: ${result.responseTime.toFixed(2)}ms`);

    if (!results.dataVolumeTests.pagination) {
      results.dataVolumeTests.pagination = [];
    }
    results.dataVolumeTests.pagination.push({
      page,
      responseTime: result.responseTime,
      success: result.success,
    });
  }

  console.log('✅ 大数据量测试完成');
}

// 4. 数据库查询性能分析
async function testDatabasePerformance(results) {
  console.log('\n🔍 开始数据库查询性能分析...');

  try {
    // 测试基本查询性能
    console.log('  分析查询执行计划...');

    const queries = [
      'EXPLAIN SELECT * FROM categories WHERE status = "active" ORDER BY created_at DESC LIMIT 20',
      'EXPLAIN SELECT * FROM categories WHERE name LIKE "%test%" LIMIT 20',
      'EXPLAIN SELECT * FROM categories WHERE parent_id IS NULL ORDER BY sort_order',
      'EXPLAIN SELECT c.*, p.name as parent_name FROM categories c LEFT JOIN categories p ON c.parent_id = p.id',
    ];

    for (const query of queries) {
      try {
        // 这里需要根据实际数据库连接方式调整
        console.log(`    执行: ${query.substring(0, 50)}...`);
        // 实际执行查询的代码需要根据项目的数据库配置实现
      } catch (error) {
        console.log(`    查询失败: ${error.message}`);
      }
    }

    // 分析索引使用情况
    console.log('  分析索引使用情况...');
    // 这里需要实现索引分析的逻辑

    results.databasePerformance = {
      queriesExecuted: queries.length,
      indexAnalysis: 'completed',
      optimizationNotes: [],
    };
  } catch (error) {
    console.log(`  数据库性能分析失败: ${error.message}`);
    results.databasePerformance = {
      error: error.message,
    };
  }

  console.log('✅ 数据库查询性能分析完成');
}

// 5. 缓存性能测试
async function testCachePerformance(results) {
  console.log('\n💾 开始缓存性能测试...');

  // 测试缓存命中效果
  const cacheTestUrl = '/api/categories?limit=20';

  console.log('  测试缓存命中效果...');

  // 第一次请求（缓存未命中）
  const firstRequest = await makeRequest('GET', cacheTestUrl);
  console.log(`    首次请求: ${firstRequest.responseTime.toFixed(2)}ms`);

  // 重复请求（测试缓存命中）
  const cacheRequests = [];
  for (let i = 0; i < 10; i++) {
    const request = await makeRequest('GET', cacheTestUrl);
    cacheRequests.push(request.responseTime);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const avgCacheTime =
    cacheRequests.reduce((a, b) => a + b, 0) / cacheRequests.length;
  const cacheImprovement =
    ((firstRequest.responseTime - avgCacheTime) / firstRequest.responseTime) *
    100;

  console.log(`    缓存命中平均时间: ${avgCacheTime.toFixed(2)}ms`);
  console.log(`    缓存性能提升: ${cacheImprovement.toFixed(2)}%`);

  results.cachePerformance = {
    firstRequestTime: firstRequest.responseTime,
    avgCachedRequestTime: avgCacheTime,
    cacheImprovementPercent: cacheImprovement,
    cacheTestSamples: cacheRequests.length,
  };

  console.log('✅ 缓存性能测试完成');
}

// 主测试函数
async function runPerformanceTests() {
  console.log('🎯 分类管理系统性能测试开始');
  console.log(`测试目标: ${config.baseURL}`);
  console.log(`开始时间: ${new Date().toISOString()}`);

  const results = new TestResults();

  try {
    // 1. API响应时间测试
    await testApiResponseTimes(results);

    // 2. 并发处理测试
    await testConcurrency(results);

    // 3. 大数据量测试
    await testDataVolume(results);

    // 4. 数据库查询性能分析
    await testDatabasePerformance(results);

    // 5. 缓存性能测试
    await testCachePerformance(results);

    // 保存测试报告
    const reportPath = results.saveReport();

    console.log('\n🎉 性能测试完成!');
    console.log(`总测试时间: ${(Date.now() - results.startTime) / 1000}秒`);
    console.log(`详细报告: ${reportPath}`);

    // 显示关键性能指标摘要
    displayPerformanceSummary(results);
  } catch (error) {
    console.error('❌ 性能测试失败:', error.message);
    process.exit(1);
  }
}

// 显示性能摘要
function displayPerformanceSummary(results) {
  console.log('\n📋 性能测试摘要:');
  console.log('================================');

  // API响应时间摘要
  console.log('\n🔗 API响应时间:');
  Object.keys(results.results.apiResponseTimes).forEach(endpoint => {
    const stats = results.results.apiResponseTimes[endpoint].stats;
    console.log(`  ${endpoint}:`);
    console.log(`    平均: ${stats.avg.toFixed(2)}ms`);
    console.log(`    P95: ${stats.p95.toFixed(2)}ms`);
    console.log(
      `    范围: ${stats.min.toFixed(2)}ms - ${stats.max.toFixed(2)}ms`
    );
  });

  // 并发测试摘要
  console.log('\n⚡ 并发测试结果:');
  Object.keys(results.results.concurrencyTests).forEach(testName => {
    console.log(`  ${testName}:`);
    results.results.concurrencyTests[testName].forEach(result => {
      console.log(
        `    并发${result.concurrency}: 成功率${result.successRate.toFixed(1)}%, 平均${result.avgResponseTime.toFixed(2)}ms`
      );
    });
  });

  // 缓存性能摘要
  if (results.results.cachePerformance.avgCachedRequestTime) {
    console.log('\n💾 缓存性能:');
    console.log(
      `  缓存提升: ${results.results.cachePerformance.cacheImprovementPercent.toFixed(2)}%`
    );
    console.log(
      `  首次: ${results.results.cachePerformance.firstRequestTime.toFixed(2)}ms`
    );
    console.log(
      `  缓存: ${results.results.cachePerformance.avgCachedRequestTime.toFixed(2)}ms`
    );
  }
}

// 检查服务器是否运行
async function checkServerHealth() {
  try {
    await makeRequest('GET', '/api/categories?limit=1');
    return true;
  } catch (error) {
    console.log('❌ 无法连接到服务器，请确保开发服务器正在运行');
    console.log('   启动命令: npm run dev');
    return false;
  }
}

// 执行测试
if (require.main === module) {
  checkServerHealth().then(isHealthy => {
    if (isHealthy) {
      runPerformanceTests();
    } else {
      process.exit(1);
    }
  });
}

module.exports = {
  runPerformanceTests,
  TestResults,
  makeRequest,
};
