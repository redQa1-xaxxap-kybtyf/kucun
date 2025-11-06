/**
 * 分类管理系统数据一致性和完整性测试（简化版）
 *
 * @author Claude
 * @date 2025-11-05
 */

const { PrismaClient } = require('@prisma/client');

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  timeout: 10000,
};

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: [],
  details: {
    integrity: { total: 0, passed: 0, failed: 0 },
    consistency: { total: 0, passed: 0, failed: 0 },
    boundary: { total: 0, passed: 0, failed: 0 },
    sync: { total: 0, passed: 0, failed: 0 },
    recovery: { total: 0, passed: 0, failed: 0 },
  },
};

// 测试数据存储
const testData = {
  cleanupIds: [],
};

// 辅助函数
function logTest(category, name, passed, error = null, details = null) {
  testResults.total++;
  testResults.details[category].total++;

  if (passed) {
    testResults.passed++;
    testResults.details[category].passed++;
    console.log(`✅ [${category.toUpperCase()}] ${name}`);
  } else {
    testResults.failed++;
    testResults.details[category].failed++;
    console.log(`❌ [${category.toUpperCase()}] ${name}`);
    if (error) {
      console.log(`   错误: ${error}`);
      testResults.errors.push({ category, name, error, details });
    }
  }
}

// API 辅助函数
async function apiRequest(endpoint, options = {}) {
  const url = `${TEST_CONFIG.baseUrl}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(TEST_CONFIG.timeout),
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  return { response, data };
}

// ==================== 1. 数据完整性验证测试 ====================

async function testDataIntegrity() {
  console.log('\n📊 第一部分: 数据完整性验证测试');
  console.log('================================================');

  const prisma = new PrismaClient();

  try {
    // 测试 1.1: 分类编码唯一性检查
    try {
      const result = await prisma.$queryRaw`
        SELECT code, COUNT(*) as count
        FROM categories
        GROUP BY code
        HAVING COUNT(*) > 1
      `;

      const duplicates = Array.isArray(result) ? result : [];
      logTest(
        'integrity',
        '分类编码唯一性检查',
        duplicates.length === 0,
        duplicates.length > 0
          ? `发现重复编码: ${duplicates.map(d => d.code).join(', ')}`
          : null,
        { duplicates }
      );
    } catch (error) {
      logTest('integrity', '分类编码唯一性检查', false, error.message);
    }

    // 测试 1.2: 分类名称在同一父级下的唯一性约束
    try {
      const result = await prisma.$queryRaw`
        SELECT name, parent_id, COUNT(*) as count
        FROM categories
        GROUP BY name, parent_id
        HAVING COUNT(*) > 1
      `;

      const duplicates = Array.isArray(result) ? result : [];
      logTest(
        'integrity',
        '分类名称同一父级下唯一性检查',
        duplicates.length === 0,
        duplicates.length > 0
          ? `发现重复名称: ${duplicates.map(d => `${d.name} (parent: ${d.parent_id})`).join(', ')}`
          : null,
        { duplicates }
      );
    } catch (error) {
      logTest(
        'integrity',
        '分类名称同一父级下唯一性检查',
        false,
        error.message
      );
    }

    // 测试 1.3: 层级关系一致性检查
    try {
      const categories = await prisma.category.findMany({
        select: { id: true, parentId: true, name: true },
      });

      const categoryMap = new Map(categories.map(c => [c.id, c]));
      let inconsistencies = [];

      for (const category of categories) {
        if (category.parentId) {
          const parent = categoryMap.get(category.parentId);
          if (!parent) {
            inconsistencies.push({
              type: 'missing_parent',
              categoryId: category.id,
              categoryName: category.name,
              parentId: category.parentId,
            });
          }
        }
      }

      logTest(
        'integrity',
        '层级关系一致性检查',
        inconsistencies.length === 0,
        inconsistencies.length > 0
          ? `发现不一致的层级关系: ${inconsistencies.length} 个`
          : null,
        { inconsistencies }
      );
    } catch (error) {
      logTest('integrity', '层级关系一致性检查', false, error.message);
    }

    // 测试 1.4: 外键约束完整性检查
    try {
      const orphanProducts = await prisma.$queryRaw`
        SELECT p.id, p.name, p.category_id
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.category_id IS NOT NULL AND c.id IS NULL
        LIMIT 10
      `;

      logTest(
        'integrity',
        '外键约束完整性检查 - 产品分类关联',
        Array.isArray(orphanProducts) && orphanProducts.length === 0,
        Array.isArray(orphanProducts) && orphanProducts.length > 0
          ? `发现孤立产品记录: ${orphanProducts.length} 个`
          : null,
        { orphanProducts }
      );
    } catch (error) {
      logTest(
        'integrity',
        '外键约束完整性检查 - 产品分类关联',
        false,
        error.message
      );
    }

    // 测试 1.5: 数据类型和格式验证
    try {
      const issues = [];

      // 检查状态值
      const invalidStatuses = await prisma.category.findMany({
        where: {
          status: {
            notIn: ['active', 'inactive'],
          },
        },
        select: { id: true, name: true, status: true },
      });

      if (invalidStatuses.length > 0) {
        issues.push({
          type: 'invalid_status',
          count: invalidStatuses.length,
          examples: invalidStatuses.slice(0, 3),
        });
      }

      // 检查空值
      const nullNames = await prisma.category.count({
        where: { name: null },
      });

      if (nullNames > 0) {
        issues.push({
          type: 'null_name',
          count: nullNames,
        });
      }

      logTest(
        'integrity',
        '数据类型和格式验证',
        issues.length === 0,
        issues.length > 0 ? `发现数据格式问题: ${issues.length} 类` : null,
        { issues }
      );
    } catch (error) {
      logTest('integrity', '数据类型和格式验证', false, error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// ==================== 2. 数据一致性测试 ====================

async function testDataConsistency() {
  console.log('\n🔄 第二部分: 数据一致性测试');
  console.log('================================================');

  try {
    // 检查API服务可用性
    const healthCheck = await apiRequest('/api/categories');
    if (!healthCheck.response.ok) {
      logTest('consistency', 'API服务可用性检查', false, 'API服务不可用');
      return;
    }

    logTest('consistency', 'API服务可用性检查', true, null, {
      status: 'healthy',
    });

    // 测试 2.1: 简单的分类创建和读取一致性
    try {
      const timestamp = Date.now();
      const testCategoryName = `一致性测试-${timestamp}`;
      const testCategoryCode = `CONSISTENCY-${timestamp}`;

      // 创建分类
      const createResponse = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: testCategoryName,
          code: testCategoryCode,
        }),
      });

      if (!createResponse.response.ok || !createResponse.data?.data?.id) {
        throw new Error('无法创建测试分类');
      }

      const categoryId = createResponse.data.data.id;
      testData.cleanupIds.push(categoryId);

      // 立即读取分类
      const readResponse = await apiRequest(`/api/categories/${categoryId}`);

      const consistent =
        readResponse.data?.success &&
        readResponse.data.data &&
        readResponse.data.data.id === categoryId &&
        readResponse.data.data.name === testCategoryName &&
        readResponse.data.data.code === testCategoryCode;

      logTest(
        'consistency',
        '分类创建和读取一致性测试',
        consistent,
        !consistent ? '创建和读取的数据不一致' : null,
        {
          createdId: categoryId,
          readSuccess: readResponse.data?.success,
          dataMatch: consistent,
        }
      );
    } catch (error) {
      logTest('consistency', '分类创建和读取一致性测试', false, error.message);
    }
  } catch (error) {
    logTest('consistency', 'API连接测试', false, error.message);
  }
}

// ==================== 3. 边界条件测试 ====================

async function testBoundaryConditions() {
  console.log('\n🎯 第三部分: 边界条件测试');
  console.log('================================================');

  try {
    // 测试 3.1: 空名称验证
    try {
      const response = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: '',
          code: `EMPTY-NAME-${Date.now()}`,
        }),
      });

      logTest(
        'boundary',
        '空名称边界测试',
        !response.response.ok,
        response.response.ok ? '应该拒绝空名称但没有拒绝' : null,
        { requestRejected: !response.response.ok }
      );
    } catch (error) {
      logTest('boundary', '空名称边界测试', false, error.message);
    }

    // 测试 3.2: 超长名称验证
    try {
      const longName = 'A'.repeat(200);
      const response = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: longName,
          code: `LONG-NAME-${Date.now()}`,
        }),
      });

      logTest(
        'boundary',
        '超长名称边界测试',
        !response.response.ok,
        response.response.ok ? '应该拒绝超长名称但没有拒绝' : null,
        { requestRejected: !response.response.ok, nameLength: longName.length }
      );
    } catch (error) {
      logTest('boundary', '超长名称边界测试', false, error.message);
    }

    // 测试 3.3: 无效状态值验证
    try {
      const response = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: `状态测试-${Date.now()}`,
          code: `INVALID-STATUS-${Date.now()}`,
          status: 'invalid_status',
        }),
      });

      logTest(
        'boundary',
        '无效状态值边界测试',
        !response.response.ok,
        response.response.ok ? '应该拒绝无效状态但没有拒绝' : null,
        { requestRejected: !response.response.ok }
      );
    } catch (error) {
      logTest('boundary', '无效状态值边界测试', false, error.message);
    }
  } catch (error) {
    logTest('boundary', '边界条件测试初始化', false, error.message);
  }
}

// ==================== 4. 清理测试数据 ====================

async function cleanupTestData() {
  console.log('\n🧹 清理测试数据...');

  if (testData.cleanupIds.length === 0) {
    console.log('没有需要清理的测试数据');
    return;
  }

  const prisma = new PrismaClient();

  try {
    let successCount = 0;
    let failCount = 0;

    for (const id of testData.cleanupIds) {
      try {
        // 先尝试通过API删除
        const apiResponse = await apiRequest(`/api/categories/${id}`, {
          method: 'DELETE',
        });

        if (apiResponse.response.ok) {
          successCount++;
        } else {
          // API删除失败，直接从数据库删除
          await prisma.category.delete({ where: { id } });
          successCount++;
        }
      } catch (error) {
        console.warn(`清理分类 ${id} 失败:`, error.message);
        failCount++;
      }
    }

    console.log(`清理完成: ${successCount} 成功, ${failCount} 失败`);
  } finally {
    await prisma.$disconnect();
  }
}

// ==================== 生成测试报告 ====================

function generateTestReport() {
  console.log('\n📋 测试报告');
  console.log('================================================');

  const overallPassRate =
    testResults.total > 0
      ? ((testResults.passed / testResults.total) * 100).toFixed(1)
      : '0.0';

  console.log(`\n📊 总体统计:`);
  console.log(`   总测试数: ${testResults.total}`);
  console.log(`   ✅ 通过: ${testResults.passed}`);
  console.log(`   ❌ 失败: ${testResults.failed}`);
  console.log(`   ⏭️  跳过: ${testResults.skipped}`);
  console.log(`   📈 通过率: ${overallPassRate}%`);

  console.log(`\n📈 分类统计:`);
  Object.entries(testResults.details).forEach(([category, stats]) => {
    const categoryPassRate =
      stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0.0';
    console.log(
      `   ${category.toUpperCase()}: ${stats.passed}/${stats.total} (${categoryPassRate}%)`
    );
  });

  if (testResults.errors.length > 0) {
    console.log(`\n❌ 失败的测试:`);
    testResults.errors.forEach((error, index) => {
      console.log(
        `   ${index + 1}. [${error.category.toUpperCase()}] ${error.name}`
      );
      console.log(`      错误: ${error.error}`);
    });
  }

  console.log(`\n⚠️  注意事项:`);
  console.log(`   - 请确保应用程序运行在 ${TEST_CONFIG.baseUrl}`);
  console.log(`   - 数据库连接正常`);
  console.log(`   - 测试数据已自动清理`);

  // 生成修复建议
  const recommendations = [];

  if (testResults.details.integrity.failed > 0) {
    recommendations.push({
      priority: 'high',
      category: '数据完整性',
      description: '发现数据完整性问题，建议立即修复',
      actions: ['检查重复数据', '修复外键约束', '验证数据格式'],
    });
  }

  if (testResults.details.consistency.failed > 0) {
    recommendations.push({
      priority: 'high',
      category: '数据一致性',
      description: '发现数据一致性问题，需要优化API处理',
      actions: ['改进事务处理', '加强并发控制', '优化缓存策略'],
    });
  }

  if (testResults.details.boundary.failed > 0) {
    recommendations.push({
      priority: 'medium',
      category: '边界条件',
      description: '边界条件处理需要加强',
      actions: ['完善输入验证', '改进错误处理', '增强业务规则'],
    });
  }

  if (recommendations.length > 0) {
    console.log(`\n💡 修复建议:`);
    recommendations.forEach((rec, index) => {
      console.log(
        `   ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.category}: ${rec.description}`
      );
      rec.actions.forEach(action => console.log(`      - ${action}`));
    });
  }

  return {
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      skipped: testResults.skipped,
      passRate: parseFloat(overallPassRate),
    },
    categories: testResults.details,
    errors: testResults.errors,
    recommendations,
    timestamp: new Date().toISOString(),
  };
}

// ==================== 主测试函数 ====================

async function runComprehensiveTests() {
  console.log('🧪 分类管理系统数据一致性和完整性测试');
  console.log('================================================');
  console.log(`开始时间: ${new Date().toISOString()}`);
  console.log(`测试目标: ${TEST_CONFIG.baseUrl}`);

  try {
    // 执行所有测试
    await testDataIntegrity();
    await testDataConsistency();
    await testBoundaryConditions();

    // 生成报告
    const report = generateTestReport();

    // 清理测试数据
    await cleanupTestData();

    console.log(`\n⏱️  测试完成时间: ${new Date().toISOString()}`);

    return report;
  } catch (error) {
    console.error('\n💥 测试执行失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runComprehensiveTests()
    .then(report => {
      console.log('\n🎉 测试执行完成');

      // 保存报告到文件
      const fs = require('fs');
      const path = require('path');

      // 确保目录存在
      const testResultsDir = path.join(__dirname, '../test-results');
      if (!fs.existsSync(testResultsDir)) {
        fs.mkdirSync(testResultsDir, { recursive: true });
      }

      const reportPath = path.join(
        testResultsDir,
        `category-integrity-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      );

      try {
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 详细报告已保存到: ${reportPath}`);
      } catch (writeError) {
        console.warn('⚠️  无法保存报告文件:', writeError.message);
      }

      console.log('\n🎯 测试总结:');
      if (report.summary.passRate >= 90) {
        console.log('🎉 系统质量优秀，分类管理功能运行良好！');
      } else if (report.summary.passRate >= 70) {
        console.log('⚠️ 系统基本正常，但存在一些需要改进的地方');
      } else {
        console.log('🚨 系统存在较多问题，建议立即处理发现的问题');
      }

      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 测试失败:', error);
      process.exit(1);
    });
}

module.exports = {
  runComprehensiveTests,
  testDataIntegrity,
  testDataConsistency,
  testBoundaryConditions,
  generateTestReport,
};
