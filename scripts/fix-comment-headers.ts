#!/usr/bin/env tsx

/**
 * 批量修复文件头部注释格式问题
 * 将缺少开头 /** 的注释修复为正确格式
 */

import fs from 'fs';
import path from 'path';

const filesToFix = [
  'lib/api/products.ts',
  'lib/api/sales-orders.ts',
  'lib/schemas/address.ts',
  'lib/schemas/category.ts',
  'lib/schemas/customer.ts',
  'lib/schemas/layout.ts',
  'lib/schemas/product.ts',
  'lib/schemas/sales-order.ts',
  'lib/types/api.ts',
  'lib/types/layout.ts',
  'lib/types/user.ts',
  'lib/utils/category-code-generator.ts',
  'lib/utils/performance.ts',
  'lib/utils/permissions.tsx',
  'lib/utils/piece-calculation.ts',
  'lib/utils/type-guards.ts',
  'lib/validations/base.ts',
  'app/not-found.tsx',
];

function fixCommentHeader(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  文件不存在: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // 检查第一行是否以 " * " 开头（缺少 /**）
    if (lines.length > 0 && lines[0].trim().startsWith('* ')) {
      // 找到注释块的结束位置
      let endIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '*/') {
          endIndex = i;
          break;
        }
      }

      if (endIndex > 0) {
        // 修复注释格式
        lines[0] = '/**' + lines[0].substring(lines[0].indexOf('*') + 1);

        const newContent = lines.join('\n');
        fs.writeFileSync(filePath, newContent);
        console.log(`✅ 修复注释格式: ${filePath}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}:`, error);
    return false;
  }
}

function main() {
  console.log('🔧 开始修复文件头部注释格式...');

  let fixedCount = 0;

  for (const file of filesToFix) {
    if (fixCommentHeader(file)) {
      fixedCount++;
    }
  }

  console.log(`\n✨ 修复完成！共处理 ${fixedCount} 个文件`);
}

if (require.main === module) {
  main();
}
