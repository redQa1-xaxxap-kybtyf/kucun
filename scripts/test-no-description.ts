#!/usr/bin/env tsx

/**
 * 测试移除描述功能后的分类管理
 * 验证所有CRUD操作正常工作
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
}

async function testCreateCategory(): Promise<TestResult> {
  try {
    console.log('🧪 测试创建分类（无描述字段）...');

    const response = await fetch('http://localhost:3005/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '测试分类无描述',
        sortOrder: 0,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: `创建失败: ${data.error || '未知错误'}`,
      };
    }

    // 验证返回的数据不包含描述字段
    if ('description' in data.data) {
      return {
        success: false,
        message: '返回数据中仍包含描述字段',
        data: data.data,
      };
    }

    return {
      success: true,
      message: '创建成功，无描述字段',
      data: data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: `创建异常: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

async function testGetCategories(): Promise<TestResult> {
  try {
    console.log('🧪 测试获取分类列表（无描述字段）...');

    const response = await fetch('http://localhost:3005/api/categories');
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: `获取失败: ${data.error || '未知错误'}`,
      };
    }

    // 验证返回的数据不包含描述字段
    const hasDescription = data.data.some(
      (category: any) => 'description' in category
    );
    if (hasDescription) {
      return {
        success: false,
        message: '返回数据中仍包含描述字段',
      };
    }

    return {
      success: true,
      message: `获取成功，共 ${data.data.length} 个分类，无描述字段`,
      data: data.data.length,
    };
  } catch (error) {
    return {
      success: false,
      message: `获取异常: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

async function testUpdateCategory(categoryId: string): Promise<TestResult> {
  try {
    console.log('🧪 测试更新分类（无描述字段）...');

    const response = await fetch(
      `http://localhost:3005/api/categories/${categoryId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: '更新后的分类名称',
          sortOrder: 1,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: `更新失败: ${data.error || '未知错误'}`,
      };
    }

    // 验证返回的数据不包含描述字段
    if ('description' in data.data) {
      return {
        success: false,
        message: '返回数据中仍包含描述字段',
        data: data.data,
      };
    }

    return {
      success: true,
      message: '更新成功，无描述字段',
      data: data.data,
    };
  } catch (error) {
    return {
      success: false,
      message: `更新异常: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

async function testDatabaseSchema(): Promise<TestResult> {
  try {
    console.log('🧪 测试数据库Schema（无描述字段）...');

    // 直接查询数据库验证字段是否已移除
    const categories = await prisma.category.findMany({
      take: 1,
    });

    if (categories.length > 0) {
      const category = categories[0] as any;
      if ('description' in category) {
        return {
          success: false,
          message: '数据库中仍存在描述字段',
        };
      }
    }

    return {
      success: true,
      message: '数据库Schema正确，无描述字段',
    };
  } catch (error) {
    return {
      success: false,
      message: `数据库查询异常: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

async function runTests() {
  console.log('🚀 开始测试移除描述功能后的分类管理...\n');

  const results: TestResult[] = [];
  let createdCategoryId: string | null = null;

  // 1. 测试数据库Schema
  const schemaResult = await testDatabaseSchema();
  results.push(schemaResult);
  console.log(
    `${schemaResult.success ? '✅' : '❌'} ${schemaResult.message}\n`
  );

  // 2. 测试创建分类
  const createResult = await testCreateCategory();
  results.push(createResult);
  console.log(`${createResult.success ? '✅' : '❌'} ${createResult.message}`);
  if (createResult.success && createResult.data) {
    createdCategoryId = createResult.data.id;
    console.log(`   创建的分类ID: ${createdCategoryId}`);
  }
  console.log();

  // 3. 测试获取分类列表
  const getResult = await testGetCategories();
  results.push(getResult);
  console.log(`${getResult.success ? '✅' : '❌'} ${getResult.message}\n`);

  // 4. 测试更新分类
  if (createdCategoryId) {
    const updateResult = await testUpdateCategory(createdCategoryId);
    results.push(updateResult);
    console.log(
      `${updateResult.success ? '✅' : '❌'} ${updateResult.message}\n`
    );
  }

  // 输出测试总结
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  console.log('📊 测试总结:');
  console.log(`   ✅ 成功: ${successCount}/${totalCount}`);
  console.log(`   ❌ 失败: ${totalCount - successCount}/${totalCount}`);

  if (successCount === totalCount) {
    console.log('\n🎉 所有测试通过！分类管理功能已成功移除描述字段！');
  } else {
    console.log('\n⚠️  部分测试失败，请检查相关功能。');
  }

  // 清理测试数据
  if (createdCategoryId) {
    try {
      await fetch(`http://localhost:3005/api/categories/${createdCategoryId}`, {
        method: 'DELETE',
      });
      console.log('\n🧹 测试数据已清理');
    } catch (error) {
      console.log('\n⚠️  清理测试数据失败');
    }
  }

  await prisma.$disconnect();
}

// 运行测试
runTests().catch(console.error);
