#!/usr/bin/env tsx

/**
 * 产品详情API测试脚本
 * 测试产品详情获取功能
 */

async function testProductDetailAPI() {
  console.log('🧪 开始产品详情API测试\n');

  // 首先获取产品列表，找到一个现有的产品ID
  try {
    console.log('📋 获取产品列表...');
    const listResponse = await fetch(
      'http://localhost:3005/api/products?limit=1',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const listResult = await listResponse.json();
    console.log('📄 产品列表响应:', JSON.stringify(listResult, null, 2));

    if (listResult.success && listResult.data && listResult.data.length > 0) {
      const productId = listResult.data[0].id;
      console.log(`\n🎯 测试产品ID: ${productId}`);

      // 测试产品详情API
      console.log('\n📋 获取产品详情...');
      const detailResponse = await fetch(
        `http://localhost:3005/api/products/${productId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const detailResult = await detailResponse.json();

      if (detailResponse.ok && detailResult.success) {
        console.log('✅ 产品详情API测试通过');
        console.log('📄 产品详情数据:');
        console.log(`  - ID: ${detailResult.data.id}`);
        console.log(`  - 编码: ${detailResult.data.code}`);
        console.log(`  - 名称: ${detailResult.data.name}`);
        console.log(`  - 厚度: ${detailResult.data.thickness || '未设置'}`);
        console.log(`  - 重量: ${detailResult.data.weight || '未设置'}`);
        console.log(`  - 规格: ${detailResult.data.specification || '未设置'}`);
      } else {
        console.log('❌ 产品详情API测试失败');
        console.log('📄 错误信息:', detailResult.error);
        console.log('📄 响应状态:', detailResponse.status);
        console.log('📄 完整响应:', JSON.stringify(detailResult, null, 2));
      }
    } else {
      console.log('❌ 无法获取产品列表或列表为空');
      console.log('📄 响应:', JSON.stringify(listResult, null, 2));
    }
  } catch (error) {
    console.log('❌ API请求异常:', error);
  }
}

// 测试无效ID的情况
async function testInvalidProductId() {
  console.log('\n🧪 测试无效产品ID\n');

  try {
    const response = await fetch(
      'http://localhost:3005/api/products/invalid-id-123',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();

    if (response.status === 404 && !result.success) {
      console.log('✅ 无效ID测试通过 - 正确返回404');
      console.log('📄 错误信息:', result.error);
    } else {
      console.log('❌ 无效ID测试失败 - 应该返回404');
      console.log('📄 响应状态:', response.status);
      console.log('📄 响应数据:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.log('❌ 无效ID测试异常:', error);
  }
}

// 主函数
async function main() {
  await testProductDetailAPI();
  await testInvalidProductId();
}

if (require.main === module) {
  main().catch(console.error);
}
