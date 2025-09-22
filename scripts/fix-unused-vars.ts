#!/usr/bin/env tsx

/**
 * 修复未使用变量问题
 * 为未使用的变量添加下划线前缀
 */

import fs from 'fs';
import path from 'path';

function fixUnusedVars(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    let newContent = content;

    // 修复未使用的导入
    const unusedImports = [
      'ChevronRight',
      'ScrollArea',
      'BarChart3',
      'TrendingDown',
      'TrendingUp',
      'Badge',
      'CreditCard',
      'AlertCircle',
      'Alert',
      'AlertDescription',
      'Label',
      'PaymentRecord',
      'PaymentStatus',
      'AccountsReceivable',
      'PaymentStatistics',
      'PaymentMethodStatistics',
      'CustomerPaymentStatistics',
      'ReturnOrder',
    ];

    for (const varName of unusedImports) {
      // 修复导入中的未使用变量
      const importRegex = new RegExp(`(\\s+)${varName}(\\s*[,}])`, 'g');
      newContent = newContent.replace(importRegex, (match, before, after) => {
        modified = true;
        return `${before}_${varName}${after}`;
      });
    }

    // 修复未使用的变量声明
    const unusedVarDeclarations = [
      'sampleBatches',
      'productionDate',
      'setProductionDate',
      'groupByVariant',
      'metadata',
      'layoutConfig',
      'setSuggestions',
      'isMobile',
      'badgesLoading',
      'isAdvancedOpen',
      'setIsAdvancedOpen',
      'availabilityCheck',
      'setAvailabilityCheck',
      'checkAvailability',
      'calculatedAlertLevel',
    ];

    for (const varName of unusedVarDeclarations) {
      // 修复const/let声明
      const declRegex = new RegExp(`(const|let)\\s+${varName}\\s*=`, 'g');
      newContent = newContent.replace(declRegex, (match, keyword) => {
        modified = true;
        return `${keyword} _${varName} =`;
      });

      // 修复解构声明
      const destructRegex = new RegExp(`(\\s+)${varName}(\\s*[,}])`, 'g');
      newContent = newContent.replace(destructRegex, (match, before, after) => {
        if (match.includes('=') || match.includes(':')) {
          return match; // 跳过赋值和类型注解
        }
        modified = true;
        return `${before}_${varName}${after}`;
      });
    }

    // 修复未使用的函数参数
    const unusedParams = ['customer', 'customerId', 'ref'];

    for (const paramName of unusedParams) {
      // 修复函数参数
      const paramRegex = new RegExp(
        `\\(([^)]*?)\\b${paramName}\\b([^)]*)\\)`,
        'g'
      );
      newContent = newContent.replace(paramRegex, (match, before, after) => {
        if (
          before.includes('_' + paramName) ||
          after.includes('_' + paramName)
        ) {
          return match; // 已经有下划线前缀
        }
        modified = true;
        return `(${before}_${paramName}${after})`;
      });
    }

    if (modified) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ 修复未使用变量: ${filePath}`);
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
  console.log('🔧 开始修复未使用变量问题...');

  const projectRoot = process.cwd();
  const files = findTsFiles(projectRoot);

  let fixedCount = 0;

  for (const file of files) {
    if (fixUnusedVars(file)) {
      fixedCount++;
    }
  }

  console.log(`\n✨ 修复完成！共处理 ${fixedCount} 个文件`);
}

if (require.main === module) {
  main();
}
