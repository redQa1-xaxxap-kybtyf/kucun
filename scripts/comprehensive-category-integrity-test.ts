/**
 * 分类管理系统数据一致性和完整性全面测试
 *
 * 测试范围:
 * 1. 数据完整性验证
 * 2. 数据一致性测试
 * 3. 边界条件测试
 * 4. 数据同步验证
 * 5. 错误恢复测试
 *
 * @author Claude
 * @date 2025-11-05
 */

import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/db';

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  maxRetries: 3,
  concurrency: 5,
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
  categories: [] as any[],
  parentChildMap: new Map(),
  cleanupIds: [] as string[],
};

// 辅助函数
function logTest(
  category: string,
  name: string,
  passed: boolean,
  error: string | null = null,
  details: any = null
) {
  testResults.total++;
  testResults.details[category as keyof typeof testResults.details].total++;

  if (passed) {
    testResults.passed++;
    testResults.details[category as keyof typeof testResults.details].passed++;
    console.log(`✅ [${category.toUpperCase()}] ${name}`);
  } else {
    testResults.failed++;
    testResults.details[category as keyof typeof testResults.details].failed++;
    console.log(`❌ [${category.toUpperCase()}] ${name}`);
    if (error) {
      console.log(`   错误: ${error}`);
      testResults.errors.push({ category, name, error, details });
    }
  }

  testResults.details.push({
    category,
    name,
    passed,
    error,
    details,
    timestamp: new Date().toISOString(),
  } as any);
}

function logSkipped(category: string, name: string, reason: string) {
  testResults.total++;
  testResults.skipped++;
  testResults.details[category as keyof typeof testResults.details].total++;
  console.log(`⏭️  [${category.toUpperCase()}] ${name} - 跳过: ${reason}`);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retry(
  fn: () => Promise<any>,
  maxRetries: number = TEST_CONFIG.maxRetries
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1));
    }
  }
}

// API 辅助函数
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${TEST_CONFIG.baseUrl}${endpoint}`;
  const defaultOptions: RequestInit = {
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

  // 测试 1.1: 分类编码唯一性检查
  async function testCategoryCodeUniqueness() {
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
          ? `发现重复编码: ${(duplicates as any[]).map(d => d.code).join(', ')}`
          : null,
        { duplicates }
      );
    } catch (error) {
      logTest(
        'integrity',
        '分类编码唯一性检查',
        false,
        (error as Error).message
      );
    }
  }

  // 测试 1.2: 分类名称在同一父级下的唯一性约束
  async function testCategoryNameUniqueness() {
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
          ? `发现重复名称: ${(duplicates as any[]).map(d => `${d.name} (parent: ${d.parent_id})`).join(', ')}`
          : null,
        { duplicates }
      );
    } catch (error) {
      logTest(
        'integrity',
        '分类名称同一父级下唯一性检查',
        false,
        (error as Error).message
      );
    }
  }

  // 测试 1.3: 层级关系一致性检查
  async function testHierarchyConsistency() {
    try {
      const categories = await prisma.category.findMany({
        select: { id: true, parentId: true, name: true },
      });

      const categoryMap = new Map(categories.map(c => [c.id, c]));
      let inconsistencies: any[] = [];

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
      logTest(
        'integrity',
        '层级关系一致性检查',
        false,
        (error as Error).message
      );
    }
  }

  // 测试 1.4: 外键约束完整性检查
  async function testForeignKeyConstraints() {
    try {
      // 检查孤立的产品记录
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
        (error as Error).message
      );
    }
  }

  // 测试 1.5: 数据类型和格式验证
  async function testDataTypesAndFormats() {
    try {
      const issues: any[] = [];

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

      // 检查空编码
      const nullCodes = await prisma.category.count({
        where: { code: null },
      });

      if (nullCodes > 0) {
        issues.push({
          type: 'null_code',
          count: nullCodes,
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
      logTest(
        'integrity',
        '数据类型和格式验证',
        false,
        (error as Error).message
      );
    }
  }

  await testCategoryCodeUniqueness();
  await testCategoryNameUniqueness();
  await testHierarchyConsistency();
  await testForeignKeyConstraints();
  await testDataTypesAndFormats();
}

// ==================== 2. 数据一致性测试 ====================

async function testDataConsistency() {
  console.log('\n🔄 第二部分: 数据一致性测试');
  console.log('================================================');

  // 测试 2.1: 并发创建分类时的一致性
  async function testConcurrentCreation() {
    try {
      const timestamp = Date.now();
      const categoryName = `并发测试-${timestamp}`;
      const concurrentRequests = 5;

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        apiRequest('/api/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: `${categoryName}-${i}`,
            code: `CC-${timestamp}-${i}`,
          }),
        })
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.response.ok).length;

      // 清理测试数据
      for (const result of results) {
        if (result.data?.data?.id) {
          testData.cleanupIds.push(result.data.data.id);
        }
      }

      logTest(
        'consistency',
        '并发创建分类一致性测试',
        successCount === concurrentRequests,
        successCount !== concurrentRequests
          ? `只有 ${successCount}/${concurrentRequests} 请求成功`
          : null,
        { successCount, totalRequests: concurrentRequests }
      );
    } catch (error) {
      logTest(
        'consistency',
        '并发创建分类一致性测试',
        false,
        (error as Error).message
      );
    }
  }

  // 测试 2.2: 更新分类时父子关系的一致性
  async function testParentChildConsistency() {
    try {
      // 创建父分类
      const parentResponse = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: `父级一致性测试-${Date.now()}`,
          code: `PC-${Date.now()}`,
        }),
      });

      if (!parentResponse.response.ok || !parentResponse.data?.data?.id) {
        throw new Error('无法创建父分类');
      }

      const parentId = parentResponse.data.data.id;
      testData.cleanupIds.push(parentId);

      // 创建子分类
      const childResponse = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: `子级一致性测试-${Date.now()}`,
          code: `CC-${Date.now()}`,
          parentId,
        }),
      });

      if (!childResponse.response.ok || !childResponse.data?.data?.id) {
        throw new Error('无法创建子分类');
      }

      const childId = childResponse.data.data.id;
      testData.cleanupIds.push(childId);

      // 尝试将父分类移动到子分类下（应该失败）
      const updateResponse = await apiRequest(`/api/categories/${parentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          parentId: childId,
        }),
      });

      logTest(
        'consistency',
        '更新分类时父子关系一致性测试',
        !updateResponse.response.ok,
        updateResponse.response.ok ? '应该阻止循环引用但没有阻止' : null,
        {
          parentCreated: true,
          childCreated: true,
          updateBlocked: !updateResponse.response.ok,
        }
      );
    } catch (error) {
      logTest(
        'consistency',
        '更新分类时父子关系一致性测试',
        false,
        (error as Error).message
      );
    }
  }

  // 测试 2.3: 事务处理正确性
  async function testTransactionHandling() {
    try {
      // 模拟一个会部分失败的操作
      const invalidData = {
        name: '', // 空名称，应该导致失败
        code: `TX-${Date.now()}`,
      };

      const response = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      });

      // 检查是否有部分数据被创建（不应该有）
      const checkCategory = await prisma.category.findFirst({
        where: { code: invalidData.code },
        select: { id: true },
      });

      logTest(
        'consistency',
        '事务处理正确性测试',
        !response.response.ok && !checkCategory,
        response.response.ok || checkCategory ? '事务回滚失败' : null,
        {
          requestFailed: !response.response.ok,
          noPartialData: !checkCategory,
        }
      );
    } catch (error) {
      logTest(
        'consistency',
        '事务处理正确性测试',
        false,
        (error as Error).message
      );
    }
  }

  await testConcurrentCreation();
  await testParentChildConsistency();
  await testTransactionHandling();
}

// ==================== 3. 边界条件测试 ====================

async function testBoundaryConditions() {
  console.log('\n🎯 第三部分: 边界条件测试');
  console.log('================================================');

  // 测试 3.1: 3级分类限制严格执行
  async function testThreeLevelLimit() {
    try {
      // 创建一级分类
      const level1Response = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: `一级分类-${Date.now()}`,
          code: `L1-${Date.now()}`,
        }),
      });

      if (!level1Response.response.ok || !level1Response.data?.data?.id) {
        throw new Error('无法创建一级分类');
      }

      const level1Id = level1Response.data.data.id;
      testData.cleanupIds.push(level1Id);

      // 创建二级分类
      const level2Response = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: `二级分类-${Date.now()}`,
          code: `L2-${Date.now()}`,
          parentId: level1Id,
        }),
      });

      if (!level2Response.response.ok || !level2Response.data?.data?.id) {
        throw new Error('无法创建二级分类');
      }

      const level2Id = level2Response.data.data.id;
      testData.cleanupIds.push(level2Id);

      // 创建三级分类
      const level3Response = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: `三级分类-${Date.now()}`,
          code: `L3-${Date.now()}`,
          parentId: level2Id,
        }),
      });

      if (!level3Response.response.ok || !level3Response.data?.data?.id) {
        throw new Error('无法创建三级分类');
      }

      const level3Id = level3Response.data.data.id;
      testData.cleanupIds.push(level3Id);

      // 尝试创建四级分类（应该失败）
      const level4Response = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: `四级分类-${Date.now()}`,
          code: `L4-${Date.now()}`,
          parentId: level3Id,
        }),
      });

      logTest(
        'boundary',
        '3级分类限制严格执行测试',
        !level4Response.response.ok,
        level4Response.response.ok ? '应该阻止超过3级的分类但没有阻止' : null,
        {
          level1Created: true,
          level2Created: true,
          level3Created: true,
          level4Blocked: !level4Response.response.ok,
        }
      );
    } catch (error) {
      logTest(
        'boundary',
        '3级分类限制严格执行测试',
        false,
        (error as Error).message
      );
    }
  }

  // 测试 3.2: 分类状态切换的一致性
  async function testStatusSwitching() {
    try {
      // 创建测试分类
      const createResponse = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: `状态测试-${Date.now()}`,
          code: `STATUS-${Date.now()}`,
          status: 'active',
        }),
      });

      if (!createResponse.response.ok || !createResponse.data?.data?.id) {
        throw new Error('无法创建测试分类');
      }

      const categoryId = createResponse.data.data.id;
      testData.cleanupIds.push(categoryId);

      // 切换到inactive状态
      const inactiveResponse = await apiRequest(
        `/api/categories/${categoryId}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status: 'inactive' }),
        }
      );

      // 验证状态已切换
      const checkInactive = await apiRequest(`/api/categories/${categoryId}`);

      // 切换回active状态
      const activeResponse = await apiRequest(
        `/api/categories/${categoryId}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status: 'active' }),
        }
      );

      // 验证状态已切换
      const checkActive = await apiRequest(`/api/categories/${categoryId}`);

      const allSuccessful =
        inactiveResponse.response.ok &&
        activeResponse.response.ok &&
        checkInactive.data?.data?.status === 'inactive' &&
        checkActive.data?.data?.status === 'active';

      logTest(
        'boundary',
        '分类状态切换一致性测试',
        allSuccessful,
        !allSuccessful ? '状态切换不一致' : null,
        {
          inactiveSwitch: inactiveResponse.response.ok,
          activeSwitch: activeResponse.response.ok,
          inactiveVerified: checkInactive.data?.data?.status === 'inactive',
          activeVerified: checkActive.data?.data?.status === 'active',
        }
      );
    } catch (error) {
      logTest(
        'boundary',
        '分类状态切换一致性测试',
        false,
        (error as Error).message
      );
    }
  }

  await testThreeLevelLimit();
  await testStatusSwitching();
}

// ==================== 4. 数据同步验证测试 ====================

async function testDataSync() {
  console.log('\n🔄 第四部分: 数据同步验证测试');
  console.log('================================================');

  // 测试 4.1: 缓存与数据库的一致性
  async function testCacheDbConsistency() {
    try {
      // 创建新分类
      const createResponse = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: `缓存测试-${Date.now()}`,
          code: `CACHE-${Date.now()}`,
        }),
      });

      if (!createResponse.response.ok || !createResponse.data?.data?.id) {
        throw new Error('无法创建测试分类');
      }

      const categoryId = createResponse.data.data.id;
      testData.cleanupIds.push(categoryId);

      // 立即通过API获取数据（应该从缓存获取）
      const apiResponse = await apiRequest(`/api/categories/${categoryId}`);

      // 直接从数据库获取数据
      const dbData = await prisma.category.findUnique({
        where: { id: categoryId },
        include: {
          parent: true,
          children: true,
          _count: { select: { products: true } },
        },
      });

      const consistent =
        apiResponse.data?.success &&
        apiResponse.data.data &&
        dbData &&
        apiResponse.data.data.id === dbData.id &&
        apiResponse.data.data.name === dbData.name &&
        apiResponse.data.data.code === dbData.code;

      logTest(
        'sync',
        '缓存与数据库一致性测试',
        consistent,
        !consistent ? '缓存数据与数据库不一致' : null,
        {
          apiSuccess: apiResponse.data?.success,
          dbDataExists: !!dbData,
          dataMatch: consistent,
        }
      );
    } catch (error) {
      logTest(
        'sync',
        '缓存与数据库一致性测试',
        false,
        (error as Error).message
      );
    }
  }

  // 测试 4.2: 并发操作的数据同步
  async function testConcurrentSync() {
    try {
      // 创建一个测试分类
      const createResponse = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: `并发同步测试-${Date.now()}`,
          code: `CSYNC-${Date.now()}`,
        }),
      });

      if (!createResponse.response.ok || !createResponse.data?.data?.id) {
        throw new Error('无法创建测试分类');
      }

      const categoryId = createResponse.data.data.id;
      testData.cleanupIds.push(categoryId);

      // 并发读取同一个分类
      const readPromises = Array.from({ length: 10 }, () =>
        apiRequest(`/api/categories/${categoryId}`)
      );

      const results = await Promise.all(readPromises);

      // 检查所有响应是否一致
      const firstResult = results[0].data?.data;
      let inconsistencies = 0;

      for (let i = 1; i < results.length; i++) {
        const currentResult = results[i].data?.data;
        if (JSON.stringify(firstResult) !== JSON.stringify(currentResult)) {
          inconsistencies++;
        }
      }

      logTest(
        'sync',
        '并发操作数据同步测试',
        inconsistencies === 0,
        inconsistencies > 0 ? `发现 ${inconsistencies} 个不一致的响应` : null,
        {
          totalRequests: results.length,
          inconsistencies,
          allSuccessful: results.every(r => r.data?.success),
        }
      );
    } catch (error) {
      logTest('sync', '并发操作数据同步测试', false, (error as Error).message);
    }
  }

  await testCacheDbConsistency();
  await testConcurrentSync();
}

// ==================== 5. 错误恢复测试 ====================

async function testErrorRecovery() {
  console.log('\n🛡️ 第五部分: 错误恢复测试');
  console.log('================================================');

  // 测试 5.1: 事务回滚机制
  async function testTransactionRollback() {
    try {
      // 创建一个包含无效数据的请求，应该触发事务回滚
      const invalidResponse = await apiRequest('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: 'a'.repeat(200), // 超长名称
          code: `ROLLBACK-${Date.now()}`,
        }),
      });

      // 检查是否有部分数据被创建
      const codeExists = await prisma.category.findFirst({
        where: { code: { contains: 'ROLLBACK-' } },
        select: { id: true, code: true },
      });

      logTest(
        'recovery',
        '事务回滚机制测试',
        !invalidResponse.response.ok && !codeExists,
        invalidResponse.response.ok || codeExists ? '事务回滚失败' : null,
        {
          requestFailed: !invalidResponse.response.ok,
          noPartialData: !codeExists,
        }
      );
    } catch (error) {
      logTest('recovery', '事务回滚机制测试', false, (error as Error).message);
    }
  }

  // 测试 5.2: 错误状态下的数据完整性
  async function testDataIntegrityUnderError() {
    try {
      // 获取测试前的数据计数
      const beforeCount = await prisma.category.count();

      // 尝试多个无效操作
      const invalidOperations = [
        {
          name: '',
          code: `ERROR1-${Date.now()}`,
        },
        {
          name: 'x'.repeat(200),
          code: `ERROR2-${Date.now()}`,
        },
        {
          name: `测试分类-${Date.now()}`,
          code: '', // 空编码
        },
      ];

      const promises = invalidOperations.map(data =>
        apiRequest('/api/categories', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      );

      const results = await Promise.all(promises);

      // 所有操作都应该失败
      const allFailed = results.every(r => !r.response.ok);

      // 检查数据计数是否没有变化
      const afterCount = await prisma.category.count();
      const countUnchanged = beforeCount === afterCount;

      logTest(
        'recovery',
        '错误状态下数据完整性测试',
        allFailed && countUnchanged,
        !allFailed || !countUnchanged ? '错误状态处理不当' : null,
        {
          allOperationsFailed: allFailed,
          countUnchanged,
          beforeCount,
          afterCount,
        }
      );
    } catch (error) {
      logTest(
        'recovery',
        '错误状态下数据完整性测试',
        false,
        (error as Error).message
      );
    }
  }

  await testTransactionRollback();
  await testDataIntegrityUnderError();
}

// ==================== 清理测试数据 ====================

async function cleanupTestData() {
  console.log('\n🧹 清理测试数据...');

  const cleanupPromises = testData.cleanupIds.map(async id => {
    try {
      await apiRequest(`/api/categories/${id}`, { method: 'DELETE' });
      return { id, success: true };
    } catch (error) {
      console.warn(`清理分类 ${id} 失败:`, (error as Error).message);
      return { id, success: false, error: (error as Error).message };
    }
  });

  const results = await Promise.all(cleanupPromises);
  const successCount = results.filter(r => r.success).length;

  console.log(`清理完成: ${successCount}/${results.length} 个分类已删除`);
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
    timestamp: new Date().toISOString(),
  };
}

// ==================== 主测试函数 ====================

async function runComprehensiveTests() {
  console.log('🧪 分类管理系统数据一致性和完整性全面测试');
  console.log('================================================');
  console.log(`开始时间: ${new Date().toISOString()}`);
  console.log(`测试目标: ${TEST_CONFIG.baseUrl}`);

  try {
    // 检查服务是否可用
    console.log('\n🔍 检查服务状态...');
    try {
      const healthCheck = await apiRequest('/api/categories');
      if (!healthCheck.response.ok) {
        throw new Error('API服务不可用');
      }
      console.log('✅ API服务正常');
    } catch (error) {
      console.log('❌ API服务不可用，请确保应用程序正在运行');
      console.log(`   URL: ${TEST_CONFIG.baseUrl}/api/categories`);
      return;
    }

    // 执行所有测试
    await testDataIntegrity();
    await testDataConsistency();
    await testBoundaryConditions();
    await testDataSync();
    await testErrorRecovery();

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
      const reportPath = `./test-results/category-comprehensive-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

      try {
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 详细报告已保存到: ${reportPath}`);
      } catch (writeError) {
        console.warn('⚠️  无法保存报告文件:', (writeError as Error).message);
      }

      process.exit(testResults.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('💥 测试失败:', error);
      process.exit(1);
    });
}

export {
  runComprehensiveTests,
  testDataIntegrity,
  testDataConsistency,
  testBoundaryConditions,
  testDataSync,
  testErrorRecovery,
  generateTestReport,
};
