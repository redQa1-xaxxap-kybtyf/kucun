#!/usr/bin/env tsx

/**
 * 修复非空断言操作符问题
 * 将所有!操作符替换为安全的空值检查模式
 */

import fs from 'fs';
import path from 'path';

interface NonNullAssertionFix {
  file: string;
  line: number;
  pattern: string;
  replacement: string;
  description: string;
}

const specificFixes: NonNullAssertionFix[] = [
  {
    file: 'components/customers/customer-edit-dialog.tsx',
    line: 69,
    pattern: 'customer?.id',
    replacement: 'customer?.id ?? ""',
    description: '客户ID安全访问',
  },
  {
    file: 'components/customers/customer-edit-dialog.tsx',
    line: 70,
    pattern: 'customer?.name',
    replacement: 'customer?.name ?? ""',
    description: '客户名称安全访问',
  },
  {
    file: 'components/customers/customer-form.tsx',
    line: 147,
    pattern: 'customer?.id',
    replacement: 'customer?.id ?? ""',
    description: '客户表单ID安全访问',
  },
  {
    file: 'components/customers/customer-hierarchy.tsx',
    line: 224,
    pattern: 'parent?.id',
    replacement: 'parent?.id ?? ""',
    description: '父级客户ID安全访问',
  },
  {
    file: 'components/customers/customer-hierarchy.tsx',
    line: 232,
    pattern: 'node?.id',
    replacement: 'node?.id ?? ""',
    description: '节点ID安全访问',
  },
  {
    file: 'components/customers/erp-customer-form.tsx',
    line: 98,
    pattern: 'customer?.id',
    replacement: 'customer?.id ?? ""',
    description: 'ERP客户表单ID安全访问',
  },
  {
    file: 'components/customers/erp-customer-form.tsx',
    line: 107,
    pattern: 'customer?.name',
    replacement: 'customer?.name ?? ""',
    description: 'ERP客户表单名称安全访问',
  },
  {
    file: 'components/sales-orders/sales-order-form.tsx',
    line: 145,
    pattern: 'customer?.id',
    replacement: 'customer?.id ?? ""',
    description: '销售订单客户ID安全访问',
  },
  {
    file: 'components/sales-orders/sales-order-form.tsx',
    line: 149,
    pattern: 'customer?.name',
    replacement: 'customer?.name ?? ""',
    description: '销售订单客户名称安全访问',
  },
  {
    file: 'components/sales-orders/sales-order-form.tsx',
    line: 152,
    pattern: 'customer?.code',
    replacement: 'customer?.code ?? ""',
    description: '销售订单客户代码安全访问',
  },
];

function fixNonNullAssertion(fix: NonNullAssertionFix): boolean {
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
    if (targetLine.includes(fix.pattern)) {
      lines[fix.line - 1] = targetLine.replace(fix.pattern, fix.replacement);

      const newContent = lines.join('\n');
      fs.writeFileSync(fix.file, newContent);
      console.log(
        `✅ 修复非空断言: ${fix.file}:${fix.line} - ${fix.description}`
      );
      return true;
    } else {
      console.log(
        `⚠️  未找到目标模式: ${fix.file}:${fix.line} - ${fix.pattern}`
      );
      return false;
    }
  } catch (error) {
    console.error(`❌ 处理文件失败 ${fix.file}:`, error);
    return false;
  }
}

function fixGenericNonNullAssertions(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // 通用的非空断言模式替换
    let newContent = content;

    // 替换简单的属性访问
    newContent = newContent.replace(/(\w+)!\.(\w+)/g, (match, obj, prop) => {
      modified = true;
      return `${obj}?.${prop}`;
    });

    // 替换数组访问
    newContent = newContent.replace(/(\w+)!\[(\d+)\]/g, (match, arr, index) => {
      modified = true;
      return `${arr}?.[${index}]`;
    });

    // 替换方法调用
    newContent = newContent.replace(
      /(\w+)!\.(\w+)\(/g,
      (match, obj, method) => {
        modified = true;
        return `${obj}?.${method}(`;
      }
    );

    if (modified) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ 修复通用非空断言: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}:`, error);
    return false;
  }
}

function findTsFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!entry.startsWith('.') && entry !== 'node_modules') {
          traverse(fullPath);
        }
      } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function main() {
  console.log('🔧 开始修复非空断言问题...');

  let fixedCount = 0;

  // 1. 先处理特定的修复
  console.log('\n📋 处理特定的非空断言修复...');
  for (const fix of specificFixes) {
    if (fixNonNullAssertion(fix)) {
      fixedCount++;
    }
  }

  // 2. 处理通用的非空断言
  console.log('\n🔄 处理通用的非空断言修复...');
  const projectRoot = process.cwd();
  const files = findTsFiles(projectRoot);

  for (const file of files) {
    if (fixGenericNonNullAssertions(file)) {
      fixedCount++;
    }
  }

  console.log(`\n✨ 修复完成！共处理 ${fixedCount} 个修复`);
}

if (require.main === module) {
  main();
}
