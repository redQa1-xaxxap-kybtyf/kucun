#!/usr/bin/env node

/**
 * 数据库性能测试脚本
 * 直接测试数据库查询性能，绕过API层
 */

const { PrismaClient } = require('@prisma/client');
const { performance } = require('perf_hooks');

const prisma = new PrismaClient();

class DatabasePerformanceTester {
  constructor() {
    this.results = {
      basicQueries: [],
      paginationQueries: [],
      searchQueries: [],
      complexQueries: [],
      concurrentTests: [],
    };
  }

  async init() {
    console.log('🔌 连接数据库...');
    try {
      await prisma.$connect();
      console.log('✅ 数据库连接成功');
    } catch (error) {
      console.error('❌ 数据库连接失败:', error.message);
      process.exit(1);
    }
  }

  async testBasicQuery(queryName, queryFunction, iterations = 10) {
    console.log(`🔄 测试 ${queryName}...`);

    const times = [];
    const errors = [];

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        await queryFunction();
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        times.push(responseTime);

        if ((i + 1) % 5 === 0) {
          console.log(
            `  进度: ${i + 1}/${iterations}, 响应时间: ${responseTime.toFixed(2)}ms`
          );
        }
      } catch (error) {
        errors.push(error.message);
        console.log(`  错误: ${error.message}`);
      }

      // 短暂延迟
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const stats = this.calculateStats(times);
    const result = {
      queryName,
      iterations,
      successCount: times.length,
      errorCount: errors.length,
      ...stats,
    };

    this.results.basicQueries.push(result);

    console.log(
      `  结果: 平均 ${stats.avg.toFixed(2)}ms, P95 ${stats.p95.toFixed(2)}ms`
    );
    console.log(`  成功率: ${times.length}/${iterations}`);
    console.log('');

    return result;
  }

  async testPagination() {
    console.log('📊 分页查询测试...');

    const pageSizes = [10, 20, 50, 100];
    const pages = [1, 5, 10];

    for (const pageSize of pageSizes) {
      for (const page of pages) {
        const queryName = `分页查询-页面${page}-大小${pageSize}`;

        const times = [];
        for (let i = 0; i < 5; i++) {
          const startTime = performance.now();

          await prisma.category.findMany({
            where: { status: 'active' },
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
              parent: { select: { id: true, name: true } },
              _count: { select: { products: true } },
            },
          });

          const endTime = performance.now();
          times.push(endTime - startTime);
        }

        const stats = this.calculateStats(times);
        this.results.paginationQueries.push({
          queryName,
          pageSize,
          page,
          ...stats,
        });

        console.log(`  ${queryName}: 平均 ${stats.avg.toFixed(2)}ms`);
      }
    }
    console.log('');
  }

  async testSearch() {
    console.log('🔍 搜索查询测试...');

    const searchTerms = ['手机', '电脑', '测试', '电子', '设备'];
    const searchFields = ['name', 'code'];

    for (const field of searchFields) {
      for (const term of searchTerms) {
        const queryName = `搜索-${field}包含"${term}"`;

        const times = [];
        for (let i = 0; i < 5; i++) {
          const startTime = performance.now();

          const whereClause = {};
          whereClause[field] = { contains: term };

          await prisma.category.findMany({
            where: whereClause,
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: {
              parent: { select: { id: true, name: true } },
            },
          });

          const endTime = performance.now();
          times.push(endTime - startTime);
        }

        const stats = this.calculateStats(times);
        this.results.searchQueries.push({
          queryName,
          field,
          searchTerm: term,
          ...stats,
        });

        console.log(`  ${queryName}: 平均 ${stats.avg.toFixed(2)}ms`);
      }
    }
    console.log('');
  }

  async testComplexQueries() {
    console.log('🏗️ 复杂查询测试...');

    // 测试层级查询
    const times = [];
    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();

      await prisma.category.findMany({
        where: { parentId: null },
        include: {
          children: {
            include: {
              children: {
                include: {
                  _count: { select: { products: true } },
                },
              },
              _count: { select: { products: true } },
            },
          },
          _count: { select: { products: true } },
        },
      });

      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const hierarchyStats = this.calculateStats(times);
    this.results.complexQueries.push({
      queryName: '层级查询-三级深度',
      ...hierarchyStats,
    });

    console.log(`  层级查询: 平均 ${hierarchyStats.avg.toFixed(2)}ms`);

    // 测试聚合查询
    const aggregateTimes = [];
    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();

      await prisma.category.groupBy({
        by: ['status'],
        _count: { id: true },
        _avg: { sortOrder: true },
      });

      const endTime = performance.now();
      aggregateTimes.push(endTime - startTime);
    }

    const aggregateStats = this.calculateStats(aggregateTimes);
    this.results.complexQueries.push({
      queryName: '聚合查询-按状态分组',
      ...aggregateStats,
    });

    console.log(`  聚合查询: 平均 ${aggregateStats.avg.toFixed(2)}ms`);
    console.log('');
  }

  async testConcurrent() {
    console.log('⚡ 并发查询测试...');

    const concurrencyLevels = [5, 10, 20];

    for (const concurrency of concurrencyLevels) {
      console.log(`  测试并发级别: ${concurrency}`);

      const startTime = performance.now();

      const promises = [];
      for (let i = 0; i < concurrency; i++) {
        const promise = prisma.category.findMany({
          where: { status: 'active' },
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            parent: { select: { id: true, name: true } },
            _count: { select: { products: true } },
          },
        });
        promises.push(promise);
      }

      try {
        await Promise.all(promises);
        const endTime = performance.now();
        const totalTime = endTime - startTime;

        console.log(`    总时间: ${totalTime.toFixed(2)}ms`);
        console.log(
          `    平均每个查询: ${(totalTime / concurrency).toFixed(2)}ms`
        );

        this.results.concurrentTests.push({
          concurrency,
          totalTime,
          avgQueryTime: totalTime / concurrency,
          success: true,
        });
      } catch (error) {
        console.log(`    并发测试失败: ${error.message}`);
        this.results.concurrentTests.push({
          concurrency,
          error: error.message,
          success: false,
        });
      }
    }
    console.log('');
  }

  async analyzeIndexes() {
    console.log('📊 索引分析...');

    try {
      // 获取分类表索引信息
      const indexes = await prisma.$queryRaw`SHOW INDEX FROM categories`;
      console.log('  现有索引:');
      indexes.forEach(index => {
        console.log(
          `    - ${index.Index_name}: ${index.Column_name} (${index.Index_type})`
        );
      });

      // 分析查询执行计划
      console.log('\n  查询执行计划分析:');

      const explainQueries = [
        'SELECT * FROM categories WHERE status = "active" ORDER BY created_at DESC LIMIT 20',
        'SELECT * FROM categories WHERE name LIKE "%test%" LIMIT 20',
        'SELECT c.*, p.name as parent_name FROM categories c LEFT JOIN categories p ON c.parent_id = p.id WHERE c.status = "active"',
      ];

      for (const query of explainQueries) {
        try {
          const explain = await prisma.$queryRawUnsafe(`EXPLAIN ${query}`);
          console.log(`    查询: ${query.substring(0, 60)}...`);
          // 这里可以根据实际情况解析执行计划
        } catch (error) {
          console.log(`    执行计划分析失败: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`  索引分析失败: ${error.message}`);
    }
    console.log('');
  }

  calculateStats(times) {
    if (times.length === 0) {
      return { avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const sorted = times.sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);

    return {
      avg: sum / times.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  generateReport() {
    console.log('📋 生成性能测试报告...');

    const report = {
      testDate: new Date().toISOString(),
      ...this.results,
      summary: {
        totalTests:
          this.results.basicQueries.length +
          this.results.paginationQueries.length +
          this.results.searchQueries.length +
          this.results.complexQueries.length +
          this.results.concurrentTests.length,
        avgResponseTime: 0,
        slowestQuery: null,
        fastestQuery: null,
      },
    };

    // 计算总体统计
    const allTimes = [
      ...this.results.basicQueries.map(q => q.avg),
      ...this.results.paginationQueries.map(q => q.avg),
      ...this.results.searchQueries.map(q => q.avg),
      ...this.results.complexQueries.map(q => q.avg),
    ];

    if (allTimes.length > 0) {
      const allTimesSorted = allTimes.sort((a, b) => a - b);
      report.summary.avgResponseTime =
        allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
      report.summary.fastestQuery = allTimesSorted[0];
      report.summary.slowestQuery = allTimesSorted[allTimesSorted.length - 1];
    }

    return report;
  }

  async runAllTests() {
    console.log('🎯 数据库性能测试开始');
    console.log(`测试时间: ${new Date().toISOString()}`);
    console.log('');

    await this.init();

    // 基础查询测试
    await this.testBasicQuery('简单分类查询', async () => {
      return await prisma.category.findMany({
        where: { status: 'active' },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    await this.testBasicQuery('带关联的分类查询', async () => {
      return await prisma.category.findMany({
        where: { status: 'active' },
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { products: true } },
        },
      });
    });

    await this.testBasicQuery('分类计数查询', async () => {
      return await prisma.category.count({
        where: { status: 'active' },
      });
    });

    // 分页测试
    await this.testPagination();

    // 搜索测试
    await this.testSearch();

    // 复杂查询测试
    await this.testComplexQueries();

    // 并发测试
    await this.testConcurrent();

    // 索引分析
    await this.analyzeIndexes();

    // 生成报告
    const report = this.generateReport();

    // 保存报告
    const fs = require('fs');
    const path = require('path');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(
      './test-results',
      `db-performance-${timestamp}.json`
    );

    if (!fs.existsSync('./test-results')) {
      fs.mkdirSync('./test-results', { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('🎉 数据库性能测试完成!');
    console.log(
      `📊 平均响应时间: ${report.summary.avgResponseTime.toFixed(2)}ms`
    );
    console.log(`📁 详细报告: ${reportPath}`);

    return report;
  }

  async cleanup() {
    await prisma.$disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

// 执行测试
async function main() {
  const tester = new DatabasePerformanceTester();

  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
  } finally {
    await tester.cleanup();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = DatabasePerformanceTester;
