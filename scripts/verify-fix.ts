/**
 * 验证缓存刷新修复的脚本
 *
 * 这个脚本会检查所有修复的文件，确保：
 * 1. invalidateQueries 已被替换为 refetchQueries
 * 2. 添加了 type: 'active' 参数
 * 3. 添加了注释说明
 */

import fs from 'fs';
import path from 'path';

interface VerificationResult {
  file: string;
  status: 'pass' | 'fail';
  issues: string[];
  refetchCount: number;
  invalidateCount: number;
}

const filesToCheck = [
  // 第一批：核心业务流程
  'lib/api/return-orders.ts',
  'lib/api/payments.ts',
  'lib/api/payables.ts',
  'lib/api/factory-shipments.ts',

  // 第二批：日常操作
  'components/inventory/counts/count-form.tsx',
  'components/inventory/counts/count-list.tsx',
  'app/(dashboard)/inventory/counts/[id]/execute/page-client.tsx',
  'app/(dashboard)/inventory/counts/[id]/page-client.tsx',
  'components/customers/customer-form.tsx',
  'components/customers/customer-delete-dialog.tsx',
  'components/customers/customer-edit-dialog.tsx',
  'components/customers/erp-customer-form.tsx',
  'components/customers/quick-add-customer-dialog.tsx',
  'components/suppliers/quick-add-supplier-dialog.tsx',
  'components/suppliers/suppliers-page-client.tsx',
  'hooks/use-product-form.ts',
  'hooks/use-product-delete.ts',
  'components/products/quick-create-product-dialog.tsx',
  'components/products/erp-product-detail.tsx',
  'hooks/use-categories.ts',
  'app/(dashboard)/categories/create/page.tsx',
  'app/(dashboard)/categories/[id]/edit/page.tsx',
  'app/(dashboard)/settings/users/page.tsx',

  // 第三批：优化体验
  'components/finance/expenses/expense-list.tsx',
  'components/finance/expenses/expense-detail.tsx',
  'components/inventory/hooks/useInventoryOperationForm.ts',
  'hooks/use-optimized-inventory-query.ts',
  'lib/api/batch-specifications.ts',
  'hooks/use-price-history.ts',
  'hooks/use-payable-form.ts',
];

function verifyFile(filePath: string): VerificationResult {
  const fullPath = path.join(process.cwd(), filePath);
  const result: VerificationResult = {
    file: filePath,
    status: 'pass',
    issues: [],
    refetchCount: 0,
    invalidateCount: 0,
  };

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');

    // 检查是否还有 invalidateQueries（排除注释中的）
    const invalidateMatches = content.match(
      /queryClient\.invalidateQueries\(/g
    );
    if (invalidateMatches) {
      result.invalidateCount = invalidateMatches.length;
      // 检查是否在注释中
      const lines = content.split('\n');
      let actualInvalidateCount = 0;
      lines.forEach(line => {
        if (
          line.includes('invalidateQueries') &&
          !line.trim().startsWith('//') &&
          !line.trim().startsWith('*')
        ) {
          actualInvalidateCount++;
        }
      });
      if (actualInvalidateCount > 0) {
        result.status = 'fail';
        result.issues.push(
          `仍有 ${actualInvalidateCount} 处使用 invalidateQueries`
        );
      }
    }

    // 检查 refetchQueries 的使用
    const refetchMatches = content.match(/queryClient\.refetchQueries\(/g);
    if (refetchMatches) {
      result.refetchCount = refetchMatches.length;
    }

    // 检查是否添加了 type: 'active' 参数
    const refetchWithType = content.match(
      /refetchQueries\(\s*\{[^}]*type:\s*['"]active['"]/g
    );
    if (refetchWithType && refetchWithType.length < result.refetchCount) {
      result.status = 'fail';
      result.issues.push(`部分 refetchQueries 缺少 type: 'active' 参数`);
    }

    // 检查是否添加了注释
    const hasComment = content.includes('✅ 使用 refetchQueries 强制立即刷新');
    if (result.refetchCount > 0 && !hasComment) {
      result.issues.push('缺少修复注释说明');
    }
  } catch (error) {
    result.status = 'fail';
    result.issues.push(`文件读取失败: ${error}`);
  }

  return result;
}

function main() {
  console.log('🔍 开始验证缓存刷新修复...\n');

  const results: VerificationResult[] = [];
  let totalRefetch = 0;
  let totalInvalidate = 0;
  let passCount = 0;
  let failCount = 0;

  filesToCheck.forEach(file => {
    const result = verifyFile(file);
    results.push(result);
    totalRefetch += result.refetchCount;
    totalInvalidate += result.invalidateCount;

    if (result.status === 'pass') {
      passCount++;
      console.log(`✅ ${file}`);
      if (result.refetchCount > 0) {
        console.log(`   - 使用 refetchQueries: ${result.refetchCount} 处`);
      }
    } else {
      failCount++;
      console.log(`❌ ${file}`);
      result.issues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
    }
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 验证结果汇总\n');
  console.log(`总文件数: ${filesToCheck.length}`);
  console.log(`✅ 通过: ${passCount}`);
  console.log(`❌ 失败: ${failCount}`);
  console.log(`\n总 refetchQueries 使用: ${totalRefetch} 处`);
  console.log(`总 invalidateQueries 残留: ${totalInvalidate} 处`);

  if (failCount === 0) {
    console.log('\n🎉 所有文件验证通过！缓存刷新修复已完成！');
  } else {
    console.log('\n⚠️  部分文件验证失败，请检查上述问题');
  }

  console.log(`${'='.repeat(60)}\n`);

  // 返回退出码
  process.exit(failCount > 0 ? 1 : 0);
}

main();
