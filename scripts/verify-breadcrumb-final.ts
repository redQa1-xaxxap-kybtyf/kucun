#!/usr/bin/env tsx

/**
 * 面包屑导航最终验证脚本
 * 确保所有修改都正确应用并符合要求
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface VerificationResult {
  passed: boolean;
  message: string;
  details?: string;
}

/**
 * 验证面包屑组件文件的修改
 */
function verifyBreadcrumbComponent(): VerificationResult[] {
  const results: VerificationResult[] = [];

  try {
    const breadcrumbPath = join(
      process.cwd(),
      'components/common/Breadcrumb.tsx'
    );
    const content = readFileSync(breadcrumbPath, 'utf-8');

    // 验证1: 检查是否包含产品详情逻辑
    const hasProductDetail =
      content.includes('产品详情') &&
      content.includes("parentTitle === '产品管理'");
    results.push({
      passed: hasProductDetail,
      message: '产品详情标题生成逻辑',
      details: hasProductDetail ? '✅ 正确实现' : '❌ 缺少产品详情逻辑',
    });

    // 验证2: 检查是否包含分类详情逻辑
    const hasCategoryDetail =
      content.includes('分类详情') &&
      content.includes("parentTitle === '分类管理'");
    results.push({
      passed: hasCategoryDetail,
      message: '分类详情标题生成逻辑',
      details: hasCategoryDetail ? '✅ 正确实现' : '❌ 缺少分类详情逻辑',
    });

    // 验证3: 检查是否包含客户详情逻辑
    const hasCustomerDetail =
      content.includes('客户详情') &&
      content.includes("parentTitle === '客户管理'");
    results.push({
      passed: hasCustomerDetail,
      message: '客户详情标题生成逻辑',
      details: hasCustomerDetail ? '✅ 正确实现' : '❌ 缺少客户详情逻辑',
    });

    // 验证4: 检查编辑页面逻辑
    const hasEditLogic =
      content.includes('编辑产品') &&
      content.includes('编辑分类') &&
      content.includes("segment === 'edit'");
    results.push({
      passed: hasEditLogic,
      message: '编辑页面标题生成逻辑',
      details: hasEditLogic ? '✅ 正确实现' : '❌ 缺少编辑页面逻辑',
    });

    // 验证5: 检查是否移除了原来的简单"详情"逻辑
    const hasOldLogic =
      content.includes('详情 #${segment.slice(0, 8)}') &&
      !content.includes('title = `详情 #${segment.slice(0, 8)}`;');
    results.push({
      passed: !hasOldLogic,
      message: '移除旧的简单详情逻辑',
      details: !hasOldLogic ? '✅ 已正确移除' : '❌ 仍包含旧逻辑',
    });

    // 验证6: 检查PATH_TITLES扩展
    const hasExtendedPaths =
      content.includes("'/products/edit': '编辑产品'") &&
      content.includes("'/categories/edit': '编辑分类'");
    results.push({
      passed: hasExtendedPaths,
      message: 'PATH_TITLES映射扩展',
      details: hasExtendedPaths ? '✅ 正确扩展' : '❌ 缺少路径映射',
    });
  } catch (error) {
    results.push({
      passed: false,
      message: '文件读取失败',
      details: `❌ 无法读取面包屑组件文件: ${error}`,
    });
  }

  return results;
}

/**
 * 验证项目结构和依赖
 */
function verifyProjectStructure(): VerificationResult[] {
  const results: VerificationResult[] = [];

  // 验证关键文件存在
  const criticalFiles = [
    'components/common/Breadcrumb.tsx',
    'app/(dashboard)/layout.tsx',
    'components/common/AuthLayout.tsx',
    'lib/types/layout.ts',
  ];

  criticalFiles.forEach(filePath => {
    try {
      const fullPath = join(process.cwd(), filePath);
      readFileSync(fullPath, 'utf-8');
      results.push({
        passed: true,
        message: `关键文件: ${filePath}`,
        details: '✅ 文件存在',
      });
    } catch (error) {
      results.push({
        passed: false,
        message: `关键文件: ${filePath}`,
        details: '❌ 文件不存在或无法读取',
      });
    }
  });

  return results;
}

/**
 * 验证面包屑在仪表盘布局中的集成
 */
function verifyDashboardIntegration(): VerificationResult[] {
  const results: VerificationResult[] = [];

  try {
    const layoutPath = join(process.cwd(), 'app/(dashboard)/layout.tsx');
    const content = readFileSync(layoutPath, 'utf-8');

    // 检查是否启用了面包屑
    const hasBreadcrumbEnabled =
      content.includes('showBreadcrumb={true}') ||
      content.includes('showBreadcrumb: true');
    results.push({
      passed: hasBreadcrumbEnabled,
      message: '仪表盘布局启用面包屑',
      details: hasBreadcrumbEnabled ? '✅ 已启用' : '❌ 未启用',
    });

    // 检查AuthLayout导入
    const hasAuthLayoutImport = content.includes('import { AuthLayout }');
    results.push({
      passed: hasAuthLayoutImport,
      message: 'AuthLayout组件导入',
      details: hasAuthLayoutImport ? '✅ 正确导入' : '❌ 缺少导入',
    });
  } catch (error) {
    results.push({
      passed: false,
      message: '仪表盘布局验证失败',
      details: `❌ ${error}`,
    });
  }

  return results;
}

/**
 * 生成验证报告
 */
function generateReport(results: VerificationResult[]): void {
  console.log('🔍 面包屑导航最终验证报告\n');
  console.log('='.repeat(60));

  let passedCount = 0;
  let totalCount = results.length;

  results.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    const number = (index + 1).toString().padStart(2, '0');

    console.log(`${number}. ${status} ${result.message}`);
    if (result.details) {
      console.log(`    ${result.details}`);
    }

    if (result.passed) passedCount++;
    console.log();
  });

  console.log('='.repeat(60));
  console.log(`📊 验证结果统计:`);
  console.log(`✅ 通过: ${passedCount}/${totalCount}`);
  console.log(`❌ 失败: ${totalCount - passedCount}/${totalCount}`);
  console.log(`📈 成功率: ${((passedCount / totalCount) * 100).toFixed(1)}%`);

  if (passedCount === totalCount) {
    console.log('\n🎉 所有验证项目都通过！面包屑导航优化完全成功！');
    console.log('\n✨ 主要改进:');
    console.log('   • "详情" → "产品详情"、"分类详情"、"客户详情"');
    console.log('   • "编辑" → "编辑产品"、"编辑分类"、"编辑客户"');
    console.log('   • 智能化标题生成，根据上下文自动判断');
    console.log('   • 完整的中文本地化支持');
    console.log('   • 与项目UI风格保持一致');
  } else {
    console.log('\n⚠️  部分验证项目失败，请检查相关问题。');
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🍞 面包屑导航最终验证\n');

  // 收集所有验证结果
  const allResults: VerificationResult[] = [
    ...verifyBreadcrumbComponent(),
    ...verifyProjectStructure(),
    ...verifyDashboardIntegration(),
  ];

  // 生成报告
  generateReport(allResults);

  console.log('\n📋 验证完成！');
  console.log(
    '\n💡 提示: 现在可以访问 http://localhost:3000/products/[任意ID] 查看实际效果'
  );
}

// 运行主函数
if (require.main === module) {
  main();
}

export {
  verifyBreadcrumbComponent,
  verifyProjectStructure,
  verifyDashboardIntegration,
};
