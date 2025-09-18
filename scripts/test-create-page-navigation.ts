#!/usr/bin/env tsx

/**
 * 创建页面导航逻辑测试脚本
 * 验证所有创建页面成功后都跳转到列表页而不是详情页
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: string;
}

async function testCreatePageNavigation() {
  console.log('🧪 开始测试创建页面导航逻辑...\n');

  const results: TestResult[] = [];

  // 需要检查的创建页面文件
  const createPages = [
    {
      file: 'app/(dashboard)/products/create/page.tsx',
      module: '产品',
      expectedRoute: '/products',
    },
    {
      file: 'app/(dashboard)/customers/create/page.tsx',
      module: '客户',
      expectedRoute: '/customers',
    },
    {
      file: 'app/(dashboard)/sales-orders/create/page.tsx',
      module: '销售订单',
      expectedRoute: '/sales-orders',
    },
    {
      file: 'app/(dashboard)/categories/create/page.tsx',
      module: '分类',
      expectedRoute: '/categories',
    },
  ];

  try {
    for (const page of createPages) {
      const fullPath = join(process.cwd(), page.file);
      
      if (!existsSync(fullPath)) {
        results.push({
          name: `文件存在性检查 - ${page.module}`,
          success: false,
          message: '文件不存在',
        });
        continue;
      }

      const content = readFileSync(fullPath, 'utf8');

      // 检查1：是否有onSuccess回调
      const hasOnSuccess = content.includes('onSuccess:');
      results.push({
        name: `onSuccess回调检查 - ${page.module}`,
        success: hasOnSuccess,
        message: hasOnSuccess ? '存在onSuccess回调' : '缺少onSuccess回调',
      });

      // 检查2：是否有成功toast提示
      const hasSuccessToast = content.includes('variant: \'success\'') && 
                             content.includes('title: \'创建成功\'');
      results.push({
        name: `成功Toast检查 - ${page.module}`,
        success: hasSuccessToast,
        message: hasSuccessToast ? '有正确的成功toast提示' : '缺少成功toast提示',
      });

      // 检查3：是否有延迟跳转
      const hasDelayedNavigation = content.includes('setTimeout') && 
                                   content.includes('router.push');
      results.push({
        name: `延迟跳转检查 - ${page.module}`,
        success: hasDelayedNavigation,
        message: hasDelayedNavigation ? '有延迟跳转逻辑' : '缺少延迟跳转逻辑',
      });

      // 检查4：是否跳转到正确的列表页
      const correctRoutePattern = new RegExp(`router\\.push\\(['"\`]${page.expectedRoute}['"\`]\\)`);
      const hasCorrectRoute = correctRoutePattern.test(content);
      results.push({
        name: `正确路由检查 - ${page.module}`,
        success: hasCorrectRoute,
        message: hasCorrectRoute ? `正确跳转到${page.expectedRoute}` : `未跳转到${page.expectedRoute}`,
        details: hasCorrectRoute ? `发现: router.push('${page.expectedRoute}')` : undefined,
      });

      // 检查5：是否避免跳转到详情页
      const detailRoutePattern = new RegExp(`router\\.push\\(\`${page.expectedRoute}/\\$\\{.*\\}\`\\)`);
      const hasDetailRoute = detailRoutePattern.test(content);
      results.push({
        name: `避免详情页跳转检查 - ${page.module}`,
        success: !hasDetailRoute,
        message: hasDetailRoute ? '仍跳转到详情页' : '已避免跳转到详情页',
        details: hasDetailRoute ? '发现详情页跳转逻辑' : undefined,
      });

      // 检查6：是否有缓存刷新
      const hasCacheInvalidation = content.includes('queryClient.invalidateQueries');
      results.push({
        name: `缓存刷新检查 - ${page.module}`,
        success: hasCacheInvalidation,
        message: hasCacheInvalidation ? '有缓存刷新逻辑' : '缺少缓存刷新逻辑',
      });

      // 检查7：延迟时间是否合理（1.5秒）
      const hasCorrectDelay = content.includes('1500');
      results.push({
        name: `延迟时间检查 - ${page.module}`,
        success: hasCorrectDelay,
        message: hasCorrectDelay ? '延迟时间为1.5秒' : '延迟时间可能不正确',
      });
    }

    // 输出结果
    console.log('📊 测试结果汇总:\n');
    
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
      console.log('\n🎉 所有创建页面导航逻辑检查通过！');
      console.log('\n✨ 用户体验改进总结:');
      console.log('   ✅ 产品创建成功后跳转到产品列表页');
      console.log('   ✅ 客户创建成功后跳转到客户列表页');
      console.log('   ✅ 销售订单创建成功后跳转到订单列表页');
      console.log('   ✅ 分类创建成功后跳转到分类列表页');
      console.log('   ✅ 所有页面都有1.5秒延迟，让用户看到成功反馈');
      console.log('   ✅ 所有页面都有详细的成功toast提示');
      console.log('   ✅ 所有页面都正确刷新列表缓存');
      
      console.log('\n🎯 用户体验优势:');
      console.log('   📋 用户创建后可以立即在列表中看到新项目');
      console.log('   🔄 符合用户"创建后查看列表"的使用习惯');
      console.log('   ⚡ 避免不必要的详情页跳转，提升操作效率');
      console.log('   💫 统一的交互体验，降低学习成本');
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
testCreatePageNavigation();
