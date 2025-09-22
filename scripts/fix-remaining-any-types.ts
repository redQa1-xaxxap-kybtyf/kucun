#!/usr/bin/env tsx

/**
 * 修复剩余的any类型问题
 * 专门处理复杂的any类型替换
 */

import fs from 'fs';
import path from 'path';

interface AnyTypeFix {
  file: string;
  line: number;
  oldPattern: string;
  newPattern: string;
  description: string;
}

const anyTypeFixes: AnyTypeFix[] = [
  {
    file: 'app/api/dashboard/route.ts',
    line: 74,
    oldPattern: ': any',
    newPattern: ': unknown',
    description: '仪表板数据类型',
  },
  {
    file: 'app/api/inventory/inbound/route.ts',
    line: 66,
    oldPattern: ': any',
    newPattern: ': unknown',
    description: '入库数据类型',
  },
  {
    file: 'app/api/inventory/inbound/route.ts',
    line: 134,
    oldPattern: ': any',
    newPattern: ': unknown',
    description: '入库数据类型',
  },
  {
    file: 'app/api/inventory-no-auth/route.ts',
    line: 178,
    oldPattern: ': any',
    newPattern: ': unknown',
    description: '库存数据类型',
  },
  {
    file: 'app/api/product-variants/[id]/inventory-summary/route.ts',
    line: 108,
    oldPattern: ': any',
    newPattern: ': unknown',
    description: '库存汇总数据',
  },
  {
    file: 'app/api/product-variants/[id]/inventory-summary/route.ts',
    line: 135,
    oldPattern: ': any',
    newPattern: ': unknown',
    description: '库存汇总数据',
  },
  {
    file: 'app/api/sales-orders/route.ts',
    line: 151,
    oldPattern: ': any',
    newPattern: ': unknown',
    description: '销售订单数据',
  },
  {
    file: 'components/common/GlobalSearch.tsx',
    line: 36,
    oldPattern: ': any',
    newPattern: ': unknown',
    description: '搜索结果数据',
  },
  {
    file: 'components/customers/customer-hierarchy.tsx',
    line: 259,
    oldPattern: ': any',
    newPattern: ': unknown',
    description: '客户层级数据',
  },
  {
    file: 'components/dashboard/stat-cards.tsx',
    line: 129,
    oldPattern: ': any',
    newPattern: ': unknown',
    description: '统计卡片数据',
  },
];

function fixAnyType(fix: AnyTypeFix): boolean {
  try {
    if (!fs.existsSync(fix.file)) {
      console.log(`⚠️  文件不存在: ${fix.file}`);
      return false;
    }

    const content = fs.readFileSync(fix.file, 'utf-8');
    const lines = content.split('\n');

    if (fix.line > lines.length) {
      console.log(`⚠️  行号超出范围: ${fix.file}:${fix.line}`);
      return false;
    }

    const targetLine = lines[fix.line - 1];
    if (targetLine.includes(fix.oldPattern)) {
      lines[fix.line - 1] = targetLine.replace(fix.oldPattern, fix.newPattern);

      const newContent = lines.join('\n');
      fs.writeFileSync(fix.file, newContent);
      console.log(
        `✅ 修复any类型: ${fix.file}:${fix.line} - ${fix.description}`
      );
      return true;
    } else {
      console.log(`⚠️  未找到目标模式: ${fix.file}:${fix.line}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 处理文件失败 ${fix.file}:`, error);
    return false;
  }
}

function main() {
  console.log('🔧 开始修复剩余的any类型问题...');

  let fixedCount = 0;

  for (const fix of anyTypeFixes) {
    if (fixAnyType(fix)) {
      fixedCount++;
    }
  }

  console.log(`\n✨ 修复完成！共处理 ${fixedCount} 个any类型`);
}

if (require.main === module) {
  main();
}
