#!/usr/bin/env tsx

/**
 * 产品详情页面修复验证脚本
 * 验证分类信息显示和瓷砖规格信息移除
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: string;
}

async function testProductDetailFixes() {
  console.log('🧪 开始测试产品详情页面修复...\n');

  const results: TestResult[] = [];

  try {
    // 1. 检查产品详情页面的分类信息显示
    console.log('📝 1. 检查产品详情页面分类信息显示...');
    
    const detailPagePath = join(process.cwd(), 'app/(dashboard)/products/[id]/page.tsx');
    if (!existsSync(detailPagePath)) {
      results.push({
        name: '详情页面文件存在性',
        success: false,
        message: '详情页面文件不存在',
      });
    } else {
      const detailContent = readFileSync(detailPagePath, 'utf8');

      // 检查是否有分类信息显示
      const hasCategoryDisplay = detailContent.includes('产品分类') && 
                                 detailContent.includes('product.category');
      results.push({
        name: '详情页面分类信息显示',
        success: hasCategoryDisplay,
        message: hasCategoryDisplay ? '正确显示产品分类信息' : '缺少产品分类信息显示',
      });

      // 检查分类信息的显示逻辑
      const hasCategoryLogic = detailContent.includes('product.category ? product.category.name : \'未分类\'');
      results.push({
        name: '详情页面分类显示逻辑',
        success: hasCategoryLogic,
        message: hasCategoryLogic ? '分类显示逻辑正确' : '分类显示逻辑需要完善',
      });

      // 检查是否移除了瓷砖规格信息
      const hasRemovedTileSpecs = !detailContent.includes('瓷砖规格信息') &&
                                  !detailContent.includes('product.specifications.color') &&
                                  !detailContent.includes('product.specifications.surface');
      results.push({
        name: '移除瓷砖规格信息',
        success: hasRemovedTileSpecs,
        message: hasRemovedTileSpecs ? '已成功移除瓷砖规格信息' : '瓷砖规格信息仍然存在',
      });

      // 检查是否改为单列布局
      const hasSingleColumnLayout = !detailContent.includes('md:grid-cols-2') ||
                                    !detailContent.includes('grid gap-6 md:grid-cols-2');
      results.push({
        name: '单列布局改进',
        success: hasSingleColumnLayout,
        message: hasSingleColumnLayout ? '已改为单列布局' : '仍使用双列布局',
      });

      // 检查基本信息字段完整性
      const basicFields = [
        '产品编码',
        '产品名称', 
        '规格',
        '厚度',
        '重量',
        '单位',
        '每单位片数',
        '产品分类',
        '状态',
        '创建时间',
        '更新时间'
      ];

      basicFields.forEach(field => {
        const hasField = detailContent.includes(field);
        results.push({
          name: `基本信息字段-${field}`,
          success: hasField,
          message: hasField ? `包含${field}字段` : `缺少${field}字段`,
        });
      });

      // 检查响应式布局
      const hasResponsiveLayout = detailContent.includes('md:grid-cols-3') &&
                                  detailContent.includes('lg:grid-cols-4');
      results.push({
        name: '响应式布局优化',
        success: hasResponsiveLayout,
        message: hasResponsiveLayout ? '有响应式布局优化' : '缺少响应式布局',
      });
    }

    // 2. 检查产品API的分类信息查询
    console.log('\n🔍 2. 检查产品API分类信息查询...');
    
    const apiPath = join(process.cwd(), 'app/api/products/[id]/route.ts');
    if (!existsSync(apiPath)) {
      results.push({
        name: 'API文件存在性',
        success: false,
        message: 'API文件不存在',
      });
    } else {
      const apiContent = readFileSync(apiPath, 'utf8');

      // 检查是否包含分类查询
      const hasCategoryQuery = apiContent.includes('categoryId: true') &&
                              apiContent.includes('category: {');
      results.push({
        name: 'API分类信息查询',
        success: hasCategoryQuery,
        message: hasCategoryQuery ? 'API正确查询分类信息' : 'API缺少分类信息查询',
      });

      // 检查分类查询的字段
      const hasCategoryFields = apiContent.includes('id: true') &&
                               apiContent.includes('name: true') &&
                               apiContent.includes('code: true');
      results.push({
        name: 'API分类字段查询',
        success: hasCategoryFields,
        message: hasCategoryFields ? '分类字段查询完整' : '分类字段查询不完整',
      });
    }

    // 输出结果
    console.log('\n📊 测试结果汇总:\n');
    
    let successCount = 0;
    let totalCount = results.length;

    results.forEach(result => {
      const icon = result.success ? '✅' : '❌';
      console.log(`${icon} ${result.name}: ${result.message}`);
      if (result.details) {
        console.log(`   📝 ${result.details}`);
      }
      if (result.success) successCount++;
    });

    console.log(`\n📈 总体结果: ${successCount}/${totalCount} 项检查通过`);

    if (successCount === totalCount) {
      console.log('\n🎉 所有产品详情页面修复检查通过！');
      console.log('\n✨ 修复总结:');
      console.log('   ✅ 产品详情页面显示分类信息');
      console.log('   ✅ 移除了复杂的瓷砖规格信息展示');
      console.log('   ✅ 改为简洁的单列布局');
      console.log('   ✅ 保留了所有基本信息字段');
      console.log('   ✅ API正确查询和返回分类信息');
      console.log('   ✅ 响应式布局优化');
      
      console.log('\n🎯 用户体验改进:');
      console.log('   📋 分类信息清晰显示，便于产品管理');
      console.log('   🎨 简化的界面设计，减少视觉干扰');
      console.log('   📱 响应式布局，适配不同屏幕尺寸');
      console.log('   ⚡ 保持功能完整性的同时提升简洁性');
      console.log('   💫 统一的信息展示风格');
    } else {
      console.log('\n⚠️  部分检查未通过，请查看上述详情进行修复。');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testProductDetailFixes();
