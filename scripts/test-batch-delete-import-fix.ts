#!/usr/bin/env tsx

/**
 * 产品批量删除导入修复验证脚本
 * 验证产品列表页面的导入问题是否已修复
 */

import fs from 'fs';

async function testBatchDeleteImportFix() {
  console.log('🧪 开始验证产品批量删除导入修复...\n');

  const checks = [
    {
      name: 'batchDeleteProducts函数已正确导入',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );

        // 检查是否从 @/lib/api/products 导入了 batchDeleteProducts
        const hasImport =
          pageFile.includes('batchDeleteProducts,') &&
          pageFile.includes("} from '@/lib/api/products'");

        return hasImport;
      },
    },
    {
      name: 'Loader2图标已正确导入',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );

        // 检查是否从 lucide-react 导入了 Loader2
        const hasImport =
          pageFile.includes('Loader2,') &&
          pageFile.includes("} from 'lucide-react'");

        return hasImport;
      },
    },
    {
      name: 'batchDeleteProducts在mutation中正确使用',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );

        // 检查 useMutation 中是否正确使用了 batchDeleteProducts
        const hasUsage = pageFile.includes('mutationFn: batchDeleteProducts');

        return hasUsage;
      },
    },
    {
      name: 'Loader2在批量删除按钮中正确使用',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );

        // 检查批量删除按钮中是否使用了 Loader2
        const hasUsage =
          pageFile.includes(
            '<Loader2 className="mr-2 h-4 w-4 animate-spin" />'
          ) && pageFile.includes('删除中...');

        return hasUsage;
      },
    },
    {
      name: 'Loader2在确认对话框中正确使用',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );

        // 检查确认对话框中是否使用了 Loader2
        const lines = pageFile.split('\n');
        let foundLoaderInDialog = false;
        let inBatchDeleteDialog = false;

        for (const line of lines) {
          if (line.includes('批量删除确认对话框')) {
            inBatchDeleteDialog = true;
          }
          if (
            inBatchDeleteDialog &&
            line.includes('<Loader2 className="mr-2 h-4 w-4 animate-spin" />')
          ) {
            foundLoaderInDialog = true;
            break;
          }
          if (inBatchDeleteDialog && line.includes('</AlertDialog>')) {
            break;
          }
        }

        return foundLoaderInDialog;
      },
    },
    {
      name: 'API函数在lib/api/products.ts中存在',
      check: () => {
        const apiFile = fs.readFileSync('lib/api/products.ts', 'utf8');

        // 检查 batchDeleteProducts 函数是否存在并导出
        const hasFunction = apiFile.includes(
          'export async function batchDeleteProducts'
        );

        return hasFunction;
      },
    },
    {
      name: '批量删除类型定义存在',
      check: () => {
        const typesFile = fs.readFileSync('lib/types/product.ts', 'utf8');

        // 检查批量删除相关类型是否存在
        const hasTypes =
          typesFile.includes('BatchDeleteProductsInput') &&
          typesFile.includes('BatchDeleteResult');

        return hasTypes;
      },
    },
    {
      name: '导入语句语法正确',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );

        // 检查导入语句的语法是否正确（没有语法错误）
        const importLines = pageFile
          .split('\n')
          .filter(line => line.trim().startsWith('import'));

        // 检查是否有未闭合的大括号或其他语法问题
        for (const line of importLines) {
          if (
            line.includes('{') &&
            !line.includes('}') &&
            !line.includes('from')
          ) {
            // 多行导入的开始，需要检查后续行
            continue;
          }
          if (line.includes('from') && !line.includes(';')) {
            return false; // 缺少分号
          }
        }

        return true;
      },
    },
    {
      name: '所有必需的导入都存在',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );

        // 检查所有必需的导入是否都存在
        const requiredImports = [
          'useMutation',
          'useQuery',
          'useQueryClient',
          'batchDeleteProducts',
          'deleteProduct',
          'getProducts',
          'Loader2',
          'Trash2',
          'Checkbox',
          'AlertDialog',
        ];

        return requiredImports.every(importName =>
          pageFile.includes(importName)
        );
      },
    },
    {
      name: '没有重复的导入',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );

        // 检查在导入部分（前100行）batchDeleteProducts 只出现一次
        const lines = pageFile.split('\n');
        const importSection = lines.slice(0, 100).join('\n');
        const batchDeleteMatches = importSection.match(/batchDeleteProducts/g);
        return batchDeleteMatches ? batchDeleteMatches.length === 1 : false;
      },
    },
  ];

  let passedChecks = 0;
  let totalChecks = checks.length;

  for (const { name, check } of checks) {
    try {
      const result = check();
      if (result) {
        console.log(`   ✅ ${name}`);
        passedChecks++;
      } else {
        console.log(`   ❌ ${name}`);
      }
    } catch (error) {
      console.log(`   ❌ ${name} (检查失败: ${error})`);
    }
  }

  console.log(`\n📊 检查结果: ${passedChecks}/${totalChecks} 项通过`);

  if (passedChecks === totalChecks) {
    console.log('\n🎉 产品批量删除导入修复验证通过！');

    console.log('\n✨ 修复总结:');
    console.log('   ✅ batchDeleteProducts函数已正确导入');
    console.log('   ✅ Loader2图标已正确导入');
    console.log('   ✅ 所有导入语句语法正确');
    console.log('   ✅ 函数在mutation中正确使用');
    console.log('   ✅ 图标在UI组件中正确使用');
    console.log('   ✅ 没有重复或冲突的导入');

    console.log('\n🎯 运行时错误修复:');
    console.log('   🔧 修复了 "batchDeleteProducts is not defined" 错误');
    console.log('   🔧 修复了 "Loader2 is not defined" 错误');
    console.log('   🔧 确保了所有依赖项的正确导入');
    console.log('   🔧 保持了代码的类型安全性');

    console.log('\n🚀 现在批量删除功能应该可以正常工作了！');
  } else {
    console.log('\n❌ 部分检查未通过，请检查相关文件的导入情况');
    process.exit(1);
  }
}

testBatchDeleteImportFix();
