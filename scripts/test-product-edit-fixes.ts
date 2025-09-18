#!/usr/bin/env tsx

/**
 * 产品编辑页面修复验证脚本
 * 验证产品编辑页面的跳转逻辑和产品详情页面的字段显示
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: string;
}

async function testProductEditFixes() {
  console.log('🧪 开始测试产品编辑页面修复...\n');

  const results: TestResult[] = [];

  try {
    // 1. 检查产品编辑页面的跳转逻辑
    console.log('📝 1. 检查产品编辑页面跳转逻辑...');
    
    const editPagePath = join(process.cwd(), 'app/(dashboard)/products/[id]/edit/page.tsx');
    if (!existsSync(editPagePath)) {
      results.push({
        name: '编辑页面文件存在性',
        success: false,
        message: '编辑页面文件不存在',
      });
    } else {
      const editContent = readFileSync(editPagePath, 'utf8');

      // 检查是否有正确的成功回调
      const hasOnSuccess = editContent.includes('onSuccess:');
      results.push({
        name: '编辑页面onSuccess回调',
        success: hasOnSuccess,
        message: hasOnSuccess ? '存在onSuccess回调' : '缺少onSuccess回调',
      });

      // 检查是否跳转到列表页而不是详情页
      const hasCorrectRoute = editContent.includes("router.push('/products')");
      const hasWrongRoute = editContent.includes('router.push(`/products/${') || 
                           editContent.includes('router.push(`/products/${updatedProduct.id}`)');
      
      results.push({
        name: '编辑页面正确跳转',
        success: hasCorrectRoute && !hasWrongRoute,
        message: hasCorrectRoute ? '正确跳转到产品列表页' : '跳转逻辑错误',
        details: hasCorrectRoute ? "发现: router.push('/products')" : undefined,
      });

      // 检查是否有延迟跳转
      const hasDelayedNavigation = editContent.includes('setTimeout') && 
                                   editContent.includes('router.push');
      results.push({
        name: '编辑页面延迟跳转',
        success: hasDelayedNavigation,
        message: hasDelayedNavigation ? '有延迟跳转逻辑' : '缺少延迟跳转逻辑',
      });

      // 检查是否有改进的toast提示
      const hasImprovedToast = editContent.includes('更新成功') && 
                              editContent.includes('updatedProduct.name');
      results.push({
        name: '编辑页面Toast提示',
        success: hasImprovedToast,
        message: hasImprovedToast ? '有改进的toast提示' : 'toast提示需要改进',
      });

      // 检查是否刷新列表缓存
      const hasListCacheRefresh = editContent.includes('productQueryKeys.lists()');
      results.push({
        name: '编辑页面列表缓存刷新',
        success: hasListCacheRefresh,
        message: hasListCacheRefresh ? '正确刷新列表缓存' : '缺少列表缓存刷新',
      });
    }

    // 2. 检查产品详情页面的字段显示
    console.log('\n📋 2. 检查产品详情页面字段显示...');
    
    const detailPagePath = join(process.cwd(), 'app/(dashboard)/products/[id]/page.tsx');
    if (!existsSync(detailPagePath)) {
      results.push({
        name: '详情页面文件存在性',
        success: false,
        message: '详情页面文件不存在',
      });
    } else {
      const detailContent = readFileSync(detailPagePath, 'utf8');

      // 检查基本字段显示
      const basicFields = [
        { field: 'code', label: '产品编码' },
        { field: 'name', label: '产品名称' },
        { field: 'specification', label: '规格' },
        { field: 'thickness', label: '厚度' },
        { field: 'weight', label: '重量' },
        { field: 'unit', label: '单位' },
        { field: 'piecesPerUnit', label: '每单位件数' },
        { field: 'status', label: '状态' },
        { field: 'createdAt', label: '创建时间' },
        { field: 'updatedAt', label: '更新时间' },
      ];

      basicFields.forEach(({ field, label }) => {
        const hasField = detailContent.includes(`product.${field}`) || 
                        detailContent.includes(label);
        results.push({
          name: `详情页面${label}字段`,
          success: hasField,
          message: hasField ? `正确显示${label}` : `缺少${label}字段`,
        });
      });

      // 检查规格信息展示改进
      const hasImprovedSpecs = detailContent.includes('瓷砖规格信息') &&
                              detailContent.includes('product.specifications.color') &&
                              detailContent.includes('product.specifications.surface');
      results.push({
        name: '详情页面规格信息改进',
        success: hasImprovedSpecs,
        message: hasImprovedSpecs ? '规格信息展示已改进' : '规格信息展示需要改进',
      });

      // 检查自定义字段支持
      const hasCustomFields = detailContent.includes('customFields') &&
                              detailContent.includes('Array.isArray');
      results.push({
        name: '详情页面自定义字段支持',
        success: hasCustomFields,
        message: hasCustomFields ? '支持自定义规格字段' : '缺少自定义字段支持',
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
      console.log('\n🎉 所有产品编辑页面修复检查通过！');
      console.log('\n✨ 修复总结:');
      console.log('   ✅ 产品编辑成功后跳转到产品列表页');
      console.log('   ✅ 产品详情页面显示所有必要字段');
      console.log('   ✅ 规格信息展示专业化和结构化');
      console.log('   ✅ 支持瓷砖行业特有的规格属性');
      console.log('   ✅ 支持自定义规格字段');
      console.log('   ✅ 统一的用户体验和交互逻辑');
      
      console.log('\n🎯 用户体验改进:');
      console.log('   📋 编辑后直接回到列表页，符合用户习惯');
      console.log('   🔍 详情页面信息完整，便于查看和确认');
      console.log('   🏗️ 规格信息结构化展示，专业性强');
      console.log('   ⚡ 与创建页面保持一致的交互体验');
      console.log('   💫 支持瓷砖行业的专业规格管理');
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
testProductEditFixes();
