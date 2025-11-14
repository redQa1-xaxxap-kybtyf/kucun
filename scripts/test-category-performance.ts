/**
 * 分类查询性能测试脚本
 * 
 * 用途：
 * 1. 测试 getCategories 函数的性能监控功能
 * 2. 验证慢查询警告是否正常工作
 * 3. 收集实际查询耗时数据
 * 
 * 运行方式：
 * npx tsx scripts/test-category-performance.ts
 */

import { getCategories } from '@/lib/services/category-service';

async function testCategoryPerformance() {
  console.log('🚀 开始测试分类查询性能...\n');

  // 测试场景 1: 基础查询（第一页，默认参数）
  console.log('📊 测试场景 1: 基础查询');
  const startTime1 = Date.now();
  const result1 = await getCategories({
    page: 1,
    limit: 20,
  });
  const duration1 = Date.now() - startTime1;
  console.log(`✅ 查询完成，耗时: ${duration1}ms`);
  console.log(`   返回记录数: ${result1.categories.length}`);
  console.log(`   总记录数: ${result1.pagination.total}\n`);

  // 测试场景 2: 带搜索条件的查询
  console.log('📊 测试场景 2: 带搜索条件的查询');
  const startTime2 = Date.now();
  const result2 = await getCategories({
    page: 1,
    limit: 20,
    search: '电子',
  });
  const duration2 = Date.now() - startTime2;
  console.log(`✅ 查询完成，耗时: ${duration2}ms`);
  console.log(`   返回记录数: ${result2.categories.length}`);
  console.log(`   总记录数: ${result2.pagination.total}\n`);

  // 测试场景 3: 带状态筛选的查询
  console.log('📊 测试场景 3: 带状态筛选的查询');
  const startTime3 = Date.now();
  const result3 = await getCategories({
    page: 1,
    limit: 20,
    status: 'active',
  });
  const duration3 = Date.now() - startTime3;
  console.log(`✅ 查询完成，耗时: ${duration3}ms`);
  console.log(`   返回记录数: ${result3.categories.length}`);
  console.log(`   总记录数: ${result3.pagination.total}\n`);

  // 测试场景 4: 大分页查询
  console.log('📊 测试场景 4: 大分页查询');
  const startTime4 = Date.now();
  const result4 = await getCategories({
    page: 1,
    limit: 100,
  });
  const duration4 = Date.now() - startTime4;
  console.log(`✅ 查询完成，耗时: ${duration4}ms`);
  console.log(`   返回记录数: ${result4.categories.length}`);
  console.log(`   总记录数: ${result4.pagination.total}\n`);

  // 测试场景 5: 按名称排序
  console.log('📊 测试场景 5: 按名称排序');
  const startTime5 = Date.now();
  const result5 = await getCategories({
    page: 1,
    limit: 20,
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const duration5 = Date.now() - startTime5;
  console.log(`✅ 查询完成，耗时: ${duration5}ms`);
  console.log(`   返回记录数: ${result5.categories.length}`);
  console.log(`   总记录数: ${result5.pagination.total}\n`);

  // 性能统计
  console.log('📈 性能统计汇总:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`场景 1 (基础查询):        ${duration1}ms`);
  console.log(`场景 2 (搜索查询):        ${duration2}ms`);
  console.log(`场景 3 (状态筛选):        ${duration3}ms`);
  console.log(`场景 4 (大分页):          ${duration4}ms`);
  console.log(`场景 5 (名称排序):        ${duration5}ms`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const avgDuration = (duration1 + duration2 + duration3 + duration4 + duration5) / 5;
  console.log(`平均查询耗时:            ${avgDuration.toFixed(2)}ms`);
  
  const maxDuration = Math.max(duration1, duration2, duration3, duration4, duration5);
  console.log(`最慢查询耗时:            ${maxDuration}ms`);
  
  const minDuration = Math.min(duration1, duration2, duration3, duration4, duration5);
  console.log(`最快查询耗时:            ${minDuration}ms\n`);

  // 性能评估
  console.log('🎯 性能评估:');
  if (avgDuration < 500) {
    console.log('✅ 性能优秀！平均查询耗时 < 500ms');
  } else if (avgDuration < 1000) {
    console.log('⚠️  性能良好，但建议关注。平均查询耗时 500-1000ms');
  } else {
    console.log('🚨 性能需要优化！平均查询耗时 > 1000ms');
    console.log('   建议：');
    console.log('   1. 添加 product_count 冗余字段');
    console.log('   2. 使用 Redis 缓存');
    console.log('   3. 条件性加载产品计数');
  }

  console.log('\n✅ 测试完成！');
}

// 执行测试
testCategoryPerformance()
  .then(() => {
    console.log('\n👋 测试脚本执行完毕');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });

