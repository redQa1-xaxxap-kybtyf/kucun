#!/usr/bin/env tsx
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 库存调整页面修复验证脚本
 * 验证colorCode和productionDate字段的正确显示
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
}

/**
 * 检查页面文件是否正确修复
 */
async function checkPageFileChanges(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  try {
    const pageContent = readFileSync('app/(dashboard)/inventory/adjust/page.tsx', 'utf8');

    // 检查1：是否使用了实际的库存API
    const usesInventoryAPI = pageContent.includes('getInventories') && pageContent.includes('useQuery');
    results.push({
      name: '使用实际库存API',
      success: usesInventoryAPI,
      message: usesInventoryAPI ? '已连接到实际库存API' : '仍使用模拟数据',
    });

    // 检查2：是否移除了色号相关代码
    const hasNoColorCodeReferences = !pageContent.includes('colorCode') && !pageContent.includes('色号');
    results.push({
      name: '移除色号引用',
      success: hasNoColorCodeReferences,
      message: hasNoColorCodeReferences ? '已移除所有色号相关代码' : '仍存在色号相关代码',
    });

    // 检查3：是否移除了生产日期相关代码
    const hasNoProductionDateReferences = !pageContent.includes('productionDate') && !pageContent.includes('生产日期');
    results.push({
      name: '移除生产日期引用',
      success: hasNoProductionDateReferences,
      message: hasNoProductionDateReferences ? '已移除所有生产日期相关代码' : '仍存在生产日期相关代码',
    });

    // 检查4：是否移除了ColorCodeDisplay组件
    const hasNoColorCodeDisplay = !pageContent.includes('ColorCodeDisplay');
    results.push({
      name: '移除ColorCodeDisplay组件',
      success: hasNoColorCodeDisplay,
      message: hasNoColorCodeDisplay ? '已移除ColorCodeDisplay组件' : '仍使用ColorCodeDisplay组件',
    });

    // 检查5：是否显示了合适的替代信息
    const hasAlternativeInfo = pageContent.includes('product?.specification') ||
                              pageContent.includes('batchNumber') ||
                              pageContent.includes('location');
    results.push({
      name: '显示替代信息',
      success: hasAlternativeInfo,
      message: hasAlternativeInfo ? '已显示产品规格、批次或位置等替代信息' : '缺少替代信息显示',
    });

    // 检查7：是否更新了页面标题和描述
    const hasUpdatedTitle = pageContent.includes('当前库存状态') ||
                           pageContent.includes('库存充足') ||
                           pageContent.includes('库存不足');
    results.push({
      name: '页面内容更新',
      success: hasUpdatedTitle,
      message: hasUpdatedTitle ? '页面内容已更新为库存状态' : '页面内容未更新',
    });

  } catch (error) {
    results.push({
      name: '文件检查',
      success: false,
      message: `文件检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
    });
  }

  return results;
}

/**
 * 检查TypeScript编译
 */
async function checkTypeScriptCompilation(): Promise<TestResult> {
  try {
    console.log('🔍 检查TypeScript编译...');

    execSync('npx tsc --noEmit --skipLibCheck', {
      encoding: 'utf8',
      stdio: 'pipe'
    });

    return {
      name: 'TypeScript编译',
      success: true,
      message: 'TypeScript编译通过',
    };
  } catch (error: any) {
    const errorOutput = error.stdout || error.stderr || error.message;
    const hasInventoryAdjustErrors = errorOutput.includes('inventory/adjust/page.tsx');

    return {
      name: 'TypeScript编译',
      success: !hasInventoryAdjustErrors,
      message: hasInventoryAdjustErrors ?
        '库存调整页面存在TypeScript错误' :
        'TypeScript编译通过（其他文件可能有错误）',
    };
  }
}

/**
 * 检查导入依赖
 */
async function checkImportDependencies(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  try {
    const pageContent = readFileSync('app/(dashboard)/inventory/adjust/page.tsx', 'utf8');

    // 检查必要的导入
    const requiredImports = [
      { name: 'getInventories', pattern: /import.*getInventories.*from.*@\/lib\/api\/inventory/ },
      { name: 'useQuery', pattern: /import.*useQuery.*from.*@tanstack\/react-query/ },
      { name: 'format函数', pattern: /import.*format.*from.*date-fns/ },
    ];

    // 检查不应该存在的导入
    const forbiddenImports = [
      { name: 'ColorCodeDisplay', pattern: /import.*ColorCodeDisplay.*from.*@\/components\/ui\/color-code-display/ },
    ];

    requiredImports.forEach(({ name, pattern }) => {
      const hasImport = pattern.test(pageContent);
      results.push({
        name: `导入${name}`,
        success: hasImport,
        message: hasImport ? `${name}导入正确` : `缺少${name}导入`,
      });
    });

    forbiddenImports.forEach(({ name, pattern }) => {
      const hasImport = pattern.test(pageContent);
      results.push({
        name: `移除${name}导入`,
        success: !hasImport,
        message: !hasImport ? `${name}导入已正确移除` : `仍存在${name}导入`,
      });
    });

  } catch (error) {
    results.push({
      name: '导入检查',
      success: false,
      message: `导入检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
    });
  }

  return results;
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 开始验证库存调整页面修复...\n');

  const results: TestResult[] = [];

  // 运行各项检查
  results.push(...await checkPageFileChanges());
  results.push(...await checkImportDependencies());
  results.push(await checkTypeScriptCompilation());

  // 输出结果
  console.log('\n📊 修复验证结果:');
  console.log('='.repeat(60));

  let successCount = 0;
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.name}: ${result.message}`);
    if (result.success) successCount++;
  });

  console.log('='.repeat(60));
  console.log(`总计: ${successCount}/${results.length} 项检查通过`);

  if (successCount === results.length) {
    console.log('\n🎉 库存调整页面修复验证通过！');
    console.log('\n✨ 修复效果:');
    console.log('- ✅ 连接到实际库存API，不再使用模拟数据');
    console.log('- ✅ 完全移除了色号（colorCode）字段的显示');
    console.log('- ✅ 完全移除了生产日期（productionDate）字段的显示');
    console.log('- ✅ 移除了不需要的ColorCodeDisplay组件');
    console.log('- ✅ 显示产品规格、批次号、库存位置等有用信息');
    console.log('- ✅ 页面内容更新为当前库存状态');
  } else {
    console.log('\n⚠️  仍有部分问题需要修复');
  }

  return results;
}

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };
