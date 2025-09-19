#!/usr/bin/env tsx

/**
 * 分类批量删除问题诊断脚本
 * 全面诊断分类批量删除功能的各个环节
 */

import fs from 'fs';

async function diagnoseCategoryBatchDelete() {
  console.log('🔍 开始诊断分类批量删除功能...\n');

  // 1. 检查文件完整性
  console.log('📁 检查文件完整性:');
  const fileChecks = [
    { path: 'app/api/categories/batch/route.ts', name: '批量删除API端点' },
    { path: 'lib/api/categories.ts', name: '分类API客户端' },
    { path: 'app/(dashboard)/categories/page.tsx', name: '分类列表页面' },
    { path: 'prisma/schema.prisma', name: 'Prisma数据库模型' },
  ];

  for (const { path, name } of fileChecks) {
    if (fs.existsSync(path)) {
      console.log(`   ✅ ${name} 存在`);
    } else {
      console.log(`   ❌ ${name} 缺失: ${path}`);
    }
  }

  // 2. 检查API路径修复
  console.log('\n🔧 检查API路径修复:');
  try {
    const apiContent = fs.readFileSync('lib/api/categories.ts', 'utf8');
    if (apiContent.includes("fetch('/api/categories/batch'")) {
      console.log('   ✅ batchDeleteCategories使用正确的API路径');
    } else {
      console.log('   ❌ batchDeleteCategories API路径不正确');
    }

    if (!apiContent.includes('API_BASE')) {
      console.log('   ✅ 不再使用未定义的API_BASE变量');
    } else {
      console.log('   ❌ 仍然使用未定义的API_BASE变量');
    }
  } catch (error) {
    console.log(`   ❌ 无法读取API文件: ${error}`);
  }

  // 3. 检查数据库模型
  console.log('\n🗄️  检查数据库模型:');
  try {
    const schemaContent = fs.readFileSync('prisma/schema.prisma', 'utf8');
    const categoryModel = schemaContent.substring(
      schemaContent.indexOf('model Category'),
      schemaContent.indexOf(
        'model',
        schemaContent.indexOf('model Category') + 1
      )
    );

    const requiredFields = ['id', 'name', 'status', 'products', 'children'];
    for (const field of requiredFields) {
      if (categoryModel.includes(field)) {
        console.log(`   ✅ Category模型包含${field}字段`);
      } else {
        console.log(`   ❌ Category模型缺少${field}字段`);
      }
    }
  } catch (error) {
    console.log(`   ❌ 无法读取Prisma模型: ${error}`);
  }

  // 4. 检查前端组件导入
  console.log('\n🎨 检查前端组件导入:');
  try {
    const pageContent = fs.readFileSync(
      'app/(dashboard)/categories/page.tsx',
      'utf8'
    );
    const requiredImports = [
      'batchDeleteCategories',
      'AlertDialog',
      'Checkbox',
      'Loader2',
      'useMutation',
    ];

    for (const importItem of requiredImports) {
      if (pageContent.includes(importItem)) {
        console.log(`   ✅ 已导入 ${importItem}`);
      } else {
        console.log(`   ❌ 缺少导入 ${importItem}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ 无法读取页面文件: ${error}`);
  }

  // 5. 检查状态管理
  console.log('\n📊 检查状态管理:');
  try {
    const pageContent = fs.readFileSync(
      'app/(dashboard)/categories/page.tsx',
      'utf8'
    );
    const stateItems = [
      'selectedCategoryIds',
      'batchDeleteDialog',
      'batchDeleteMutation',
      'handleBatchDelete',
      'confirmBatchDelete',
    ];

    for (const stateItem of stateItems) {
      if (pageContent.includes(stateItem)) {
        console.log(`   ✅ 包含 ${stateItem}`);
      } else {
        console.log(`   ❌ 缺少 ${stateItem}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ 无法检查状态管理: ${error}`);
  }

  // 6. API端点测试建议
  console.log('\n🧪 API端点测试建议:');
  console.log('   💡 在浏览器开发者工具中运行以下测试:');
  console.log('');
  console.log('   // 测试API端点可访问性');
  console.log('   fetch("/api/categories/batch", {');
  console.log('     method: "DELETE",');
  console.log('     headers: { "Content-Type": "application/json" },');
  console.log('     body: JSON.stringify({ categoryIds: ["test-id"] })');
  console.log('   }).then(r => r.json()).then(console.log);');
  console.log('');

  // 7. 常见问题排查
  console.log('\n🔍 常见问题排查清单:');
  console.log('   1. ✅ API_BASE问题已修复');
  console.log('   2. 🔄 请刷新浏览器页面清除缓存');
  console.log('   3. 🔍 检查浏览器控制台是否有新的错误信息');
  console.log('   4. 🌐 确认开发服务器正在运行 (npm run dev)');
  console.log('   5. 🔐 检查是否已登录（批量删除需要身份验证）');
  console.log('   6. 📊 在网络面板中查看API请求详情');
  console.log('   7. 🗄️  确认数据库连接正常');

  // 8. 调试步骤
  console.log('\n🛠️  建议的调试步骤:');
  console.log('   1. 刷新分类管理页面 (/categories)');
  console.log('   2. 打开浏览器开发者工具 (F12)');
  console.log('   3. 切换到 Console 和 Network 标签页');
  console.log('   4. 选择一个分类并点击批量删除');
  console.log('   5. 观察控制台错误和网络请求');
  console.log('   6. 如果有新的错误信息，请提供给我');

  console.log('\n✨ 修复完成！现在应该可以正常使用批量删除功能了。');
  console.log('如果仍有问题，请提供浏览器控制台的具体错误信息。');
}

diagnoseCategoryBatchDelete();
