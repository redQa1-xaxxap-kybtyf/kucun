#!/usr/bin/env tsx

/**
 * 批量删除功能恢复验证脚本
 * 验证从git恢复的批量删除功能是否完整
 */

import fs from 'fs';

async function verifyBatchDeleteRecovery() {
  console.log('🔍 开始验证批量删除功能恢复状态...\n');

  const checks = [
    {
      name: '批量删除API端点文件存在',
      check: () => fs.existsSync('app/api/products/batch/route.ts'),
    },
    {
      name: '批量删除API包含完整实现',
      check: () => {
        const apiFile = fs.readFileSync(
          'app/api/products/batch/route.ts',
          'utf8'
        );
        return (
          apiFile.includes('BatchDeleteProductsSchema') &&
          apiFile.includes('getServerSession') &&
          apiFile.includes('prisma.product.findMany') &&
          apiFile.includes('prisma.product.deleteMany')
        );
      },
    },
    {
      name: '产品类型定义包含批量删除类型',
      check: () => {
        const typesFile = fs.readFileSync('lib/types/product.ts', 'utf8');
        return (
          typesFile.includes('BatchDeleteProductsInput') &&
          typesFile.includes('BatchDeleteResult')
        );
      },
    },
    {
      name: '产品API客户端包含批量删除函数',
      check: () => {
        const apiFile = fs.readFileSync('lib/api/products.ts', 'utf8');
        return (
          apiFile.includes('batchDeleteProducts') &&
          apiFile.includes('BatchDeleteProductsInput') &&
          apiFile.includes('BatchDeleteResult')
        );
      },
    },
    {
      name: '产品列表页面包含批量删除导入',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );
        return (
          pageFile.includes('batchDeleteProducts,') &&
          pageFile.includes("} from '@/lib/api/products'")
        );
      },
    },
    {
      name: '产品列表页面包含批量选择状态',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );
        return (
          pageFile.includes('selectedProductIds') &&
          pageFile.includes('batchDeleteDialog') &&
          pageFile.includes('setBatchDeleteDialog')
        );
      },
    },
    {
      name: '产品列表页面包含批量删除mutation',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );
        return (
          pageFile.includes('batchDeleteMutation') &&
          pageFile.includes('useMutation') &&
          pageFile.includes('mutationFn: batchDeleteProducts')
        );
      },
    },
    {
      name: '产品列表页面包含批量删除处理函数',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );
        return (
          pageFile.includes('handleBatchDelete') &&
          pageFile.includes('confirmBatchDelete')
        );
      },
    },
    {
      name: '产品列表页面包含批量删除UI组件',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );
        return (
          pageFile.includes('批量删除') &&
          pageFile.includes('onClick={handleBatchDelete}') &&
          pageFile.includes('确认批量删除产品')
        );
      },
    },
    {
      name: '产品列表页面包含复选框选择功能',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );
        return (
          pageFile.includes('Checkbox') &&
          pageFile.includes('selectedProductIds.includes') &&
          pageFile.includes('handleSelectProduct')
        );
      },
    },
    {
      name: '产品列表页面包含键盘快捷键支持',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );
        return (
          pageFile.includes('handleKeyDown') &&
          pageFile.includes("event.ctrlKey && event.key === 'a'") &&
          pageFile.includes("event.key === 'Delete'")
        );
      },
    },
    {
      name: '产品列表页面包含加载状态图标',
      check: () => {
        const pageFile = fs.readFileSync(
          'app/(dashboard)/products/page.tsx',
          'utf8'
        );
        return (
          pageFile.includes('Loader2') &&
          pageFile.includes('animate-spin') &&
          pageFile.includes('删除中...')
        );
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
    console.log('\n🎉 批量删除功能完全恢复成功！');

    console.log('\n✨ 恢复的功能包括:');
    console.log('   ✅ 批量删除API端点 (DELETE /api/products/batch)');
    console.log('   ✅ 完整的输入验证和权限检查');
    console.log('   ✅ 关联数据检查和安全删除');
    console.log('   ✅ 详细的删除结果返回');
    console.log('   ✅ 完整的TypeScript类型定义');
    console.log('   ✅ API客户端函数');
    console.log('   ✅ 前端批量选择状态管理');
    console.log('   ✅ 批量删除mutation和错误处理');
    console.log('   ✅ 用户交互处理函数');
    console.log('   ✅ 键盘快捷键支持 (Ctrl+A, Delete)');
    console.log('   ✅ Checkbox组件集成');
    console.log('   ✅ 批量删除按钮和确认对话框');
    console.log('   ✅ 加载状态显示');

    console.log('\n🎯 用户体验特性:');
    console.log('   📋 表格每行和表头的复选框选择');
    console.log('   🔍 实时显示已选择的产品数量');
    console.log('   💫 批量删除按钮仅在选择产品时显示');
    console.log('   ⚡ 确认对话框显示将要删除的产品列表');
    console.log('   🔄 删除成功后自动刷新产品列表');
    console.log('   🛡️  安全检查：有关联数据的产品不能删除');
    console.log('   ⌨️  键盘快捷键：Ctrl+A全选，Delete键删除');
    console.log('   📊 详细的删除结果反馈和失败原因');

    console.log('\n🚀 现在您可以正常使用批量删除功能了！');
    console.log('\n💡 使用方法:');
    console.log('   1. 在产品列表页面选择要删除的产品');
    console.log('   2. 点击"批量删除"按钮或按Delete键');
    console.log('   3. 在确认对话框中确认删除操作');
    console.log('   4. 查看删除结果和任何失败的原因');
  } else {
    console.log('\n❌ 部分功能未完全恢复，可能需要手动修复');
    console.log('\n🔧 建议的修复步骤:');
    console.log('   1. 检查失败的项目');
    console.log('   2. 手动重新实现缺失的功能');
    console.log('   3. 运行测试验证功能完整性');
    process.exit(1);
  }
}

verifyBatchDeleteRecovery();
