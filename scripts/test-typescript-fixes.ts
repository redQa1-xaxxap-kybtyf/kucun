#!/usr/bin/env tsx

/**
 * TypeScript 错误修复验证脚本
 * 验证我们修复的各种 TypeScript 类型错误
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
}

/**
 * 运行 TypeScript 类型检查
 */
async function runTypeScriptCheck(): Promise<TestResult> {
  try {
    console.log('🔍 运行 TypeScript 类型检查...');

    const result = execSync('npx tsc --noEmit --skipLibCheck', {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    return {
      name: 'TypeScript 类型检查',
      success: true,
      message: '所有类型检查通过！',
    };
  } catch (error: any) {
    const errorOutput = error.stdout || error.stderr || error.message;
    const errorLines = errorOutput
      .split('\n')
      .filter((line: string) => line.includes('error'));
    const errorCount = errorLines.length;

    return {
      name: 'TypeScript 类型检查',
      success: false,
      message: `发现 ${errorCount} 个类型错误`,
    };
  }
}

/**
 * 检查关键文件是否存在
 */
async function checkKeyFiles(): Promise<TestResult> {
  try {
    const keyFiles = [
      'app/(dashboard)/inventory/inbound/page.tsx',
      'app/(dashboard)/products/[id]/page.tsx',
      'lib/utils/category-code-generator.ts',
      'lib/schemas/product.ts',
    ];

    const missingFiles = keyFiles.filter(file => !existsSync(file));

    if (missingFiles.length > 0) {
      return {
        name: '关键文件检查',
        success: false,
        message: `缺少文件: ${missingFiles.join(', ')}`,
      };
    }

    return {
      name: '关键文件检查',
      success: true,
      message: '所有关键文件都存在',
    };
  } catch (error) {
    return {
      name: '关键文件检查',
      success: false,
      message: `文件检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/**
 * 检查修复的具体问题
 */
async function checkSpecificFixes(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  try {
    // 检查1：React 导入修复
    const productPageContent = require('fs').readFileSync(
      'app/(dashboard)/products/[id]/page.tsx',
      'utf8'
    );
    const hasReactImport = productPageContent.includes(
      "import React from 'react'"
    );

    results.push({
      name: 'React 导入修复',
      success: hasReactImport,
      message: hasReactImport ? 'React 导入已正确添加' : 'React 导入缺失',
    });

    // 检查2：重复键值修复
    const categoryCodeContent = require('fs').readFileSync(
      'lib/utils/category-code-generator.ts',
      'utf8'
    );
    const duplicateKeyPattern = /'长':\s*'[CZ]'.*'长':\s*'[CZ]'/s;
    const hasDuplicateKey = duplicateKeyPattern.test(categoryCodeContent);

    results.push({
      name: '重复键值修复',
      success: !hasDuplicateKey,
      message: hasDuplicateKey ? '仍存在重复键值' : '重复键值已修复',
    });

    // 检查3：入库页面常量定义
    const inboundPageContent = require('fs').readFileSync(
      'app/(dashboard)/inventory/inbound/page.tsx',
      'utf8'
    );
    const hasInboundLabels = inboundPageContent.includes(
      'INBOUND_REASON_LABELS'
    );

    results.push({
      name: '入库页面常量定义',
      success: hasInboundLabels,
      message: hasInboundLabels ? '入库原因标签已定义' : '入库原因标签缺失',
    });

    // 检查4：产品Schema categoryId字段
    const productSchemaContent = require('fs').readFileSync(
      'lib/schemas/product.ts',
      'utf8'
    );
    const hasCategoryId = productSchemaContent.includes(
      'categoryId: z.string().optional()'
    );

    results.push({
      name: '产品Schema categoryId字段',
      success: hasCategoryId,
      message: hasCategoryId ? 'categoryId 字段已添加' : 'categoryId 字段缺失',
    });
  } catch (error) {
    results.push({
      name: '具体修复检查',
      success: false,
      message: `检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
    });
  }

  return results;
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 开始验证 TypeScript 错误修复...\n');

  const results: TestResult[] = [];

  // 运行各项检查
  results.push(await runTypeScriptCheck());
  results.push(await checkKeyFiles());
  results.push(...(await checkSpecificFixes()));

  // 输出结果
  console.log('\n📊 修复验证结果:');
  console.log('='.repeat(50));

  let successCount = 0;
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.name}: ${result.message}`);
    if (result.success) successCount++;
  });

  console.log('='.repeat(50));
  console.log(`总计: ${successCount}/${results.length} 项检查通过`);

  if (successCount === results.length) {
    console.log('\n🎉 所有 TypeScript 错误修复验证通过！');
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
