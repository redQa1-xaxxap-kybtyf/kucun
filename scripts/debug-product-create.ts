#!/usr/bin/env tsx

/**
 * 调试产品创建API的分类处理
 */

const baseUrl = 'http://localhost:3000';

async function debugProductCreate() {
  console.log('🔍 调试产品创建API的分类处理...\n');

  try {
    // 使用一个已存在的分类ID
    const categoryId = 'd1ccedab-f045-415c-9c4c-cbb7afaae272';

    console.log('📦 创建带分类的测试产品...');
    const productResponse = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `DEBUG-TEST-${Date.now()}`,
        name: `调试测试产品_${Date.now()}`,
        specification: '600x600mm',
        thickness: 9.5,
        weight: 2.5,
        unit: 'piece',
        piecesPerUnit: 1,
        status: 'active',
        categoryId: categoryId,
      }),
    });

    console.log(`状态码: ${productResponse.status}`);

    const productResult = await productResponse.json();
    console.log('响应数据:', JSON.stringify(productResult, null, 2));

    if (productResult.success) {
      const productId = productResult.data.id;
      console.log(`\n🔍 获取产品详情验证...`);

      const detailResponse = await fetch(
        `${baseUrl}/api/products/${productId}`
      );
      const detailResult = await detailResponse.json();

      console.log('详情响应:', JSON.stringify(detailResult, null, 2));

      // 清理
      await fetch(`${baseUrl}/api/products/${productId}`, { method: 'DELETE' });
      console.log('✅ 已清理测试产品');
    }
  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugProductCreate();
