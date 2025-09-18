#!/usr/bin/env tsx

/**
 * 详细调试产品创建API的分类处理
 */

const baseUrl = 'http://localhost:3000';

async function debugProductCreateDetailed() {
  console.log('🔍 详细调试产品创建API的分类处理...\n');

  try {
    // 使用一个已存在的分类ID
    const categoryId = 'd1ccedab-f045-415c-9c4c-cbb7afaae272';
    
    const requestData = {
      code: `DEBUG-DETAILED-${Date.now()}`,
      name: `详细调试测试产品_${Date.now()}`,
      specification: '600x600mm',
      thickness: 9.5,
      weight: 2.5,
      unit: 'piece',
      piecesPerUnit: 1,
      status: 'active',
      categoryId: categoryId,
    };
    
    console.log('📤 发送的请求数据:');
    console.log(JSON.stringify(requestData, null, 2));
    
    console.log('\n📦 创建带分类的测试产品...');
    const productResponse = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData),
    });

    console.log(`状态码: ${productResponse.status}`);
    
    const productResult = await productResponse.json();
    console.log('\n📥 响应数据:');
    console.log(JSON.stringify(productResult, null, 2));

    if (productResult.success) {
      const productId = productResult.data.id;
      
      // 直接查询数据库验证
      console.log(`\n🔍 直接查询数据库验证...`);
      const dbCheckResponse = await fetch(`${baseUrl}/api/products/${productId}`);
      const dbCheckResult = await dbCheckResponse.json();
      
      console.log('\n📊 数据库查询结果:');
      console.log(JSON.stringify(dbCheckResult, null, 2));
      
      // 清理
      await fetch(`${baseUrl}/api/products/${productId}`, { method: 'DELETE' });
      console.log('\n✅ 已清理测试产品');
    }

  } catch (error) {
    console.error('❌ 调试失败:', error);
  }
}

debugProductCreateDetailed();
