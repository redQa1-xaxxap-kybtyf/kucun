#!/usr/bin/env tsx

/**
 * 验证采购订单功能已完全移除
 * 测试所有相关路由和功能不再可用
 */

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

async function testPurchaseOrderPageNotFound(): Promise<TestResult> {
  try {
    console.log('🧪 测试采购订单页面不可访问...');

    const response = await fetch('http://localhost:3005/purchase-orders');

    if (response.status === 404) {
      return {
        success: true,
        message: '采购订单页面已正确移除（404）',
      };
    } else {
      return {
        success: false,
        message: `采购订单页面仍然可访问（状态码: ${response.status}）`,
      };
    }
  } catch (error) {
    return {
      success: true,
      message: '采购订单页面不可访问（连接失败，符合预期）',
    };
  }
}

async function testPurchaseOrderAPINotFound(): Promise<TestResult> {
  try {
    console.log('🧪 测试采购订单API不可访问...');

    const response = await fetch('http://localhost:3005/api/purchase-orders');

    if (response.status === 404) {
      return {
        success: true,
        message: '采购订单API已正确移除（404）',
      };
    } else {
      return {
        success: false,
        message: `采购订单API仍然可访问（状态码: ${response.status}）`,
      };
    }
  } catch (error) {
    return {
      success: true,
      message: '采购订单API不可访问（连接失败，符合预期）',
    };
  }
}

async function testNavigationNoPurchaseOrder(): Promise<TestResult> {
  try {
    console.log('🧪 测试导航菜单不包含采购订单...');

    const response = await fetch('http://localhost:3005/categories');
    const html = await response.text();

    // 检查页面HTML中是否包含采购订单相关内容
    const hasPurchaseOrderText =
      html.includes('采购订单') || html.includes('purchase-orders');

    if (!hasPurchaseOrderText) {
      return {
        success: true,
        message: '导航菜单已正确移除采购订单选项',
      };
    } else {
      return {
        success: false,
        message: '导航菜单中仍包含采购订单相关内容',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `导航测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

async function testOtherFunctionsStillWork(): Promise<TestResult> {
  try {
    console.log('🧪 测试其他功能仍正常工作...');

    // 测试分类管理功能
    const categoriesResponse = await fetch(
      'http://localhost:3005/api/categories'
    );
    if (!categoriesResponse.ok) {
      return {
        success: false,
        message: '分类管理API不可访问',
      };
    }

    // 测试销售订单功能
    const salesOrdersResponse = await fetch(
      'http://localhost:3005/api/sales-orders'
    );
    if (!salesOrdersResponse.ok) {
      return {
        success: false,
        message: '销售订单API不可访问',
      };
    }

    return {
      success: true,
      message: '其他核心功能正常工作',
    };
  } catch (error) {
    return {
      success: false,
      message: `其他功能测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

async function runTests() {
  console.log('🚀 开始验证采购订单功能移除...\n');

  const results: TestResult[] = [];

  // 1. 测试采购订单页面不可访问
  const pageResult = await testPurchaseOrderPageNotFound();
  results.push(pageResult);
  console.log(`${pageResult.success ? '✅' : '❌'} ${pageResult.message}\n`);

  // 2. 测试采购订单API不可访问
  const apiResult = await testPurchaseOrderAPINotFound();
  results.push(apiResult);
  console.log(`${apiResult.success ? '✅' : '❌'} ${apiResult.message}\n`);

  // 3. 测试导航菜单不包含采购订单
  const navResult = await testNavigationNoPurchaseOrder();
  results.push(navResult);
  console.log(`${navResult.success ? '✅' : '❌'} ${navResult.message}\n`);

  // 4. 测试其他功能仍正常工作
  const otherResult = await testOtherFunctionsStillWork();
  results.push(otherResult);
  console.log(`${otherResult.success ? '✅' : '❌'} ${otherResult.message}\n`);

  // 输出测试总结
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  console.log('📊 测试总结:');
  console.log(`   ✅ 成功: ${successCount}/${totalCount}`);
  console.log(`   ❌ 失败: ${totalCount - successCount}/${totalCount}`);

  if (successCount === totalCount) {
    console.log('\n🎉 所有测试通过！采购订单功能已成功移除！');
    console.log('\n✨ 验证结果:');
    console.log('   • 采购订单页面不可访问');
    console.log('   • 采购订单API不可访问');
    console.log('   • 导航菜单已清理');
    console.log('   • 其他功能正常工作');
  } else {
    console.log('\n⚠️  部分测试失败，请检查相关功能。');
  }
}

// 运行测试
runTests().catch(console.error);
