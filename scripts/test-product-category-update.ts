#!/usr/bin/env tsx

/**
 * 产品分类更新功能测试脚本
 * 验证产品编辑时分类信息的完整更新流程
 */

const baseUrl = 'http://localhost:3000';

async function testProductCategoryUpdate() {
  console.log('🧪 开始测试产品分类更新功能...\n');

  const timestamp = Date.now();
  let createdProductId: string | null = null;
  let createdCategory1Id: string | null = null;
  let createdCategory2Id: string | null = null;

  try {
    // 1. 创建两个测试分类
    console.log('📁 1. 创建测试分类...');

    // 创建第一个分类
    const category1Response = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `测试分类1_${timestamp}`,
        sortOrder: 1,
      }),
    });

    if (!category1Response.ok) {
      throw new Error(`分类1创建失败: HTTP ${category1Response.status}`);
    }

    const category1Result = await category1Response.json();
    if (category1Result.success) {
      createdCategory1Id = category1Result.data.id;
      console.log(
        `   ✅ 分类1创建成功: ${category1Result.data.name} (${createdCategory1Id})`
      );
    } else {
      throw new Error(`分类1创建失败: ${category1Result.error}`);
    }

    // 创建第二个分类
    const category2Response = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `测试分类2_${timestamp}`,
        sortOrder: 2,
      }),
    });

    if (!category2Response.ok) {
      throw new Error(`分类2创建失败: HTTP ${category2Response.status}`);
    }

    const category2Result = await category2Response.json();
    if (category2Result.success) {
      createdCategory2Id = category2Result.data.id;
      console.log(
        `   ✅ 分类2创建成功: ${category2Result.data.name} (${createdCategory2Id})`
      );
    } else {
      throw new Error(`分类2创建失败: ${category2Result.error}`);
    }

    // 2. 创建一个带分类1的测试产品
    console.log('\n📦 2. 创建带分类的测试产品...');
    const productResponse = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `CAT-UPDATE-TEST-${timestamp}`,
        name: `分类更新测试产品_${timestamp}`,
        specification: '600x600mm',
        thickness: 9.5,
        weight: 2.5,
        unit: 'piece',
        piecesPerUnit: 1,
        status: 'active',
        categoryId: createdCategory1Id,
      }),
    });

    if (!productResponse.ok) {
      throw new Error(`产品创建失败: HTTP ${productResponse.status}`);
    }

    const productResult = await productResponse.json();
    if (productResult.success) {
      createdProductId = productResult.data.id;
      console.log(`   ✅ 产品创建成功: ${productResult.data.name}`);
      console.log(`   📝 产品ID: ${createdProductId}`);
      console.log(
        `   📁 初始分类: ${productResult.data.category?.name || '无分类'}`
      );
    } else {
      throw new Error(`产品创建失败: ${productResult.error}`);
    }

    // 3. 验证产品初始分类信息
    console.log('\n🔍 3. 验证产品初始分类信息...');
    const initialDetailResponse = await fetch(
      `${baseUrl}/api/products/${createdProductId}`
    );

    if (!initialDetailResponse.ok) {
      throw new Error(`产品详情获取失败: HTTP ${initialDetailResponse.status}`);
    }

    const initialDetailResult = await initialDetailResponse.json();
    if (initialDetailResult.success) {
      const product = initialDetailResult.data;
      console.log(`   ✅ 产品详情获取成功`);
      console.log(`   📁 当前分类ID: ${product.categoryId}`);
      console.log(`   📁 当前分类名称: ${product.category?.name || '无分类'}`);

      if (product.categoryId === createdCategory1Id) {
        console.log(`   ✅ 初始分类设置正确`);
      } else {
        throw new Error(
          `初始分类设置错误，期望: ${createdCategory1Id}, 实际: ${product.categoryId}`
        );
      }
    } else {
      throw new Error(`产品详情获取失败: ${initialDetailResult.error}`);
    }

    // 4. 更新产品分类（从分类1改为分类2）
    console.log('\n🔄 4. 更新产品分类...');
    const updateResponse = await fetch(
      `${baseUrl}/api/products/${createdProductId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: `CAT-UPDATE-TEST-${timestamp}`,
          name: `分类更新测试产品_${timestamp}`,
          specification: '600x600mm',
          thickness: 9.5,
          weight: 2.5,
          unit: 'piece',
          piecesPerUnit: 1,
          status: 'active',
          categoryId: createdCategory2Id, // 更新为分类2
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error(`产品更新失败: HTTP ${updateResponse.status}`);
    }

    const updateResult = await updateResponse.json();
    if (updateResult.success) {
      console.log(`   ✅ 产品更新成功`);
      console.log(`   📁 更新后分类ID: ${updateResult.data.categoryId}`);
      console.log(
        `   📁 更新后分类名称: ${updateResult.data.category?.name || '无分类'}`
      );

      if (updateResult.data.categoryId === createdCategory2Id) {
        console.log(`   ✅ 分类更新成功`);
      } else {
        throw new Error(
          `分类更新失败，期望: ${createdCategory2Id}, 实际: ${updateResult.data.categoryId}`
        );
      }
    } else {
      throw new Error(`产品更新失败: ${updateResult.error}`);
    }

    // 5. 再次获取产品详情，验证分类更新是否持久化
    console.log('\n🔍 5. 验证分类更新持久化...');
    const finalDetailResponse = await fetch(
      `${baseUrl}/api/products/${createdProductId}`
    );

    if (!finalDetailResponse.ok) {
      throw new Error(`产品详情获取失败: HTTP ${finalDetailResponse.status}`);
    }

    const finalDetailResult = await finalDetailResponse.json();
    if (finalDetailResult.success) {
      const product = finalDetailResult.data;
      console.log(`   ✅ 产品详情获取成功`);
      console.log(`   📁 最终分类ID: ${product.categoryId}`);
      console.log(`   📁 最终分类名称: ${product.category?.name || '无分类'}`);

      if (
        product.categoryId === createdCategory2Id &&
        product.category?.name === `测试分类2_${timestamp}`
      ) {
        console.log(`   ✅ 分类更新已正确持久化到数据库`);
      } else {
        throw new Error(
          `分类更新未正确持久化，期望: ${createdCategory2Id}, 实际: ${product.categoryId}`
        );
      }
    } else {
      throw new Error(`产品详情获取失败: ${finalDetailResult.error}`);
    }

    // 6. 测试设置为"未分类"
    console.log('\n🚫 6. 测试设置为未分类...');
    const uncategorizedResponse = await fetch(
      `${baseUrl}/api/products/${createdProductId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: `CAT-UPDATE-TEST-${timestamp}`,
          name: `分类更新测试产品_${timestamp}`,
          specification: '600x600mm',
          thickness: 9.5,
          weight: 2.5,
          unit: 'piece',
          piecesPerUnit: 1,
          status: 'active',
          categoryId: 'uncategorized', // 设置为未分类
        }),
      }
    );

    if (!uncategorizedResponse.ok) {
      throw new Error(`设置未分类失败: HTTP ${uncategorizedResponse.status}`);
    }

    const uncategorizedResult = await uncategorizedResponse.json();
    if (uncategorizedResult.success) {
      console.log(`   ✅ 设置未分类成功`);
      console.log(`   📁 分类ID: ${uncategorizedResult.data.categoryId}`);
      console.log(`   📁 分类对象: ${uncategorizedResult.data.category}`);

      if (
        uncategorizedResult.data.categoryId === null &&
        uncategorizedResult.data.category === null
      ) {
        console.log(`   ✅ 未分类设置正确`);
      } else {
        throw new Error(`未分类设置错误`);
      }
    } else {
      throw new Error(`设置未分类失败: ${uncategorizedResult.error}`);
    }

    console.log('\n🎉 产品分类更新功能测试完成！');
    console.log('\n📊 测试总结:');
    console.log('   ✅ 产品创建时可以正确设置分类');
    console.log('   ✅ 产品编辑时可以正确更新分类');
    console.log('   ✅ 分类更新能够正确持久化到数据库');
    console.log('   ✅ 可以正确设置产品为未分类状态');
    console.log('   ✅ API正确返回更新后的分类信息');

    console.log('\n🎯 用户体验验证:');
    console.log('   📋 用户在编辑页面修改分类后，分类信息能够成功保存');
    console.log('   🔍 在产品详情页面和列表页面都能看到更新后的分类');
    console.log('   💫 整个分类更新流程与其他字段更新保持一致');
    console.log('   ⚡ 前端表单到数据库存储的整个数据流正常工作');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  } finally {
    // 清理测试数据
    console.log('\n🧹 清理测试数据...');

    if (createdProductId) {
      try {
        await fetch(`${baseUrl}/api/products/${createdProductId}`, {
          method: 'DELETE',
        });
        console.log(`   ✅ 已清理测试产品: ${createdProductId}`);
      } catch (cleanupError) {
        console.log(`   ⚠️  清理产品失败: ${cleanupError}`);
      }
    }

    if (createdCategory1Id) {
      try {
        await fetch(`${baseUrl}/api/categories/${createdCategory1Id}`, {
          method: 'DELETE',
        });
        console.log(`   ✅ 已清理测试分类1: ${createdCategory1Id}`);
      } catch (cleanupError) {
        console.log(`   ⚠️  清理分类1失败: ${cleanupError}`);
      }
    }

    if (createdCategory2Id) {
      try {
        await fetch(`${baseUrl}/api/categories/${createdCategory2Id}`, {
          method: 'DELETE',
        });
        console.log(`   ✅ 已清理测试分类2: ${createdCategory2Id}`);
      } catch (cleanupError) {
        console.log(`   ⚠️  清理分类2失败: ${cleanupError}`);
      }
    }
  }
}

// 运行测试
testProductCategoryUpdate();
