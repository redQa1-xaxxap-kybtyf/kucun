/**
 * 测试产品创建页面分类字段功能
 * 严格遵循全栈项目统一约定规范
 */

async function testProductCreateCategoryField() {
  console.log('🧪 测试产品创建页面分类字段功能...\n');

  try {
    // 1. 测试产品创建页面是否可以访问
    console.log('1. 测试产品创建页面访问...');
    const createPageResponse = await fetch(
      'http://localhost:3000/products/create'
    );

    if (createPageResponse.ok) {
      console.log('✅ 产品创建页面访问正常');
    } else {
      console.log('❌ 产品创建页面访问失败:', createPageResponse.status);
      return;
    }

    // 2. 测试分类API是否正常
    console.log('\n2. 测试分类API...');
    const categoriesResponse = await fetch(
      'http://localhost:3000/api/categories'
    );

    if (categoriesResponse.ok) {
      const categoriesData = await categoriesResponse.json();
      console.log(
        '✅ 分类API正常，分类数量:',
        categoriesData.data?.length || 0
      );

      if (categoriesData.data && categoriesData.data.length > 0) {
        console.log('📋 可用分类:');
        categoriesData.data.slice(0, 3).forEach((cat: any) => {
          console.log(`   - ${cat.name} (${cat.id})`);
        });
        if (categoriesData.data.length > 3) {
          console.log(`   ... 还有 ${categoriesData.data.length - 3} 个分类`);
        }
      }
    } else {
      console.log('❌ 分类API访问失败:', categoriesResponse.status);
    }

    // 3. 测试产品创建Schema是否包含categoryId
    console.log('\n3. 验证Schema定义...');
    const { CreateProductSchema } = await import('../lib/schemas/product');
    const schemaShape = CreateProductSchema.shape;

    if (schemaShape.categoryId) {
      console.log('✅ CreateProductSchema包含categoryId字段');
      console.log('   字段类型:', schemaShape.categoryId._def.typeName);
      console.log('   是否可选:', schemaShape.categoryId.isOptional());
    } else {
      console.log('❌ CreateProductSchema缺少categoryId字段');
    }

    // 4. 测试表单默认值
    console.log('\n4. 验证表单默认值...');
    const { productFormDefaults } = await import('../lib/schemas/product');

    if ('categoryId' in productFormDefaults) {
      console.log('✅ 表单默认值包含categoryId');
      console.log('   默认值:', productFormDefaults.categoryId);
    } else {
      console.log('❌ 表单默认值缺少categoryId');
    }

    console.log('\n🎉 产品创建页面分类字段功能测试完成！');
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testProductCreateCategoryField();
