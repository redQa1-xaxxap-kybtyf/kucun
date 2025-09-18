#!/usr/bin/env tsx
/* eslint-disable no-console */

/**
 * 修复导入问题
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

/**
 * 需要修复导入的文件列表
 */
const FILES_TO_FIX = [
  'app/api/auth/register/route.ts',
  'app/api/auth/update-password/route.ts',
  'app/api/customers/route.ts',
  'app/api/customers/[id]/route.ts',
  'app/api/dashboard/alerts/route.ts',
  'app/api/dashboard/overview/route.ts',
  'app/api/dashboard/quick-actions/route.ts',
  'app/api/dashboard/route.ts',
  'app/api/dashboard/todos/route.ts',
  'app/api/inbound-records/route.ts',
  'app/api/inventory/inbound/route.ts',
  'app/api/inventory/inbound/[id]/route.ts',
  'app/api/inventory/route.ts',
  'app/api/product-variants/batch/route.ts',
  'app/api/product-variants/check-sku/route.ts',
  'app/api/product-variants/generate-sku/route.ts',
  'app/api/product-variants/route.ts',
  'app/api/product-variants/[id]/inventory-summary/route.ts',
  'app/api/product-variants/[id]/route.ts',
  'app/api/products/route.ts',
  'app/api/products/search/route.ts',
  'app/api/products/[id]/route.ts',
  'app/api/sales-orders/route.ts',
  'app/api/sales-orders/[id]/route.ts',
  'app/api/upload/route.ts',
  'app/api/users/route.ts',
  'app/api/users/[id]/route.ts',
];

/**
 * 添加导入语句到文件
 */
function addImportToFile(filePath: string): boolean {
  try {
    let content = readFileSync(filePath, 'utf8');
    
    // 检查是否已经有导入
    if (content.includes('API_ERROR_MESSAGES') || content.includes('SUCCESS_MESSAGES')) {
      return false; // 已经有导入了
    }
    
    // 检查是否使用了这些常量
    const needsImport = content.includes('API_ERROR_MESSAGES') || content.includes('SUCCESS_MESSAGES');
    if (!needsImport) {
      return false; // 不需要导入
    }
    
    const importStatement = "import { API_ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/lib/constants/error-messages';";
    
    // 找到最后一个import语句的位置
    const lines = content.split('\n');
    let lastImportIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') && !line.includes('type')) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex >= 0) {
      // 在最后一个import后添加
      lines.splice(lastImportIndex + 1, 0, importStatement);
    } else {
      // 在文件开头添加
      lines.unshift(importStatement);
    }
    
    writeFileSync(filePath, lines.join('\n'), 'utf8');
    return true;
  } catch (error) {
    console.error(`修复文件失败 ${filePath}:`, error);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始修复导入问题...\n');
  
  let fixedCount = 0;
  
  FILES_TO_FIX.forEach(filePath => {
    if (addImportToFile(filePath)) {
      console.log(`✅ 修复导入: ${filePath}`);
      fixedCount++;
    }
  });
  
  console.log(`\n📊 修复总结: ${fixedCount} 个文件`);
  
  if (fixedCount > 0) {
    console.log('\n🎉 导入修复完成！');
  } else {
    console.log('\n✅ 没有需要修复的导入');
  }
}

main().catch(console.error);
