#!/usr/bin/env tsx

/**
 * 分类批量删除API_BASE修复验证脚本
 * 验证API_BASE问题是否已修复
 */

import fs from 'fs';

async function verifyCategoryBatchDeleteFix() {
  console.log('🔍 验证分类批量删除API_BASE修复...\n');

  const checks = [
    {
      name: 'batchDeleteCategories函数不再使用API_BASE',
      check: () => {
        const content = fs.readFileSync('lib/api/categories.ts', 'utf8');
        const batchDeleteFunction = content.substring(
          content.indexOf('export async function batchDeleteCategories'),
          content.indexOf('export const categoryQueryKeys')
        );
        return (
          !batchDeleteFunction.includes('API_BASE') &&
          batchDeleteFunction.includes('/api/categories/batch')
        );
      },
    },
    {
      name: 'batchDeleteCategories使用正确的API路径',
      check: () => {
        const content = fs.readFileSync('lib/api/categories.ts', 'utf8');
        return content.includes("fetch('/api/categories/batch'");
      },
    },
    {
      name: '其他API函数使用一致的路径格式',
      check: () => {
        const content = fs.readFileSync('lib/api/categories.ts', 'utf8');
        const apiCalls = content.match(/fetch\(['"`][^'"`]+['"`]/g) || [];
        return apiCalls.every(
          call => call.includes('/api/categories') && !call.includes('API_BASE')
        );
      },
    },
    {
      name: '批量删除函数语法正确',
      check: () => {
        const content = fs.readFileSync('lib/api/categories.ts', 'utf8');
        const batchDeleteFunction = content.substring(
          content.indexOf('export async function batchDeleteCategories'),
          content.indexOf('export const categoryQueryKeys')
        );
        return (
          batchDeleteFunction.includes("method: 'DELETE'") &&
          batchDeleteFunction.includes('Content-Type') &&
          batchDeleteFunction.includes('JSON.stringify(input)')
        );
      },
    },
    {
      name: '批量删除函数返回类型正确',
      check: () => {
        const content = fs.readFileSync('lib/api/categories.ts', 'utf8');
        return (
          content.includes('Promise<BatchDeleteResult>') &&
          content.includes('const result = await response.json()') &&
          content.includes('return result.data')
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
    console.log('\n🎉 API_BASE问题修复成功！');

    console.log('\n✅ 修复内容:');
    console.log('   🔧 将 `${API_BASE}/batch` 修改为 `/api/categories/batch`');
    console.log('   🔧 确保与其他API函数使用一致的路径格式');
    console.log('   🔧 保持函数签名和返回类型不变');

    console.log('\n🚀 现在可以重新测试批量删除功能:');
    console.log('   1. 刷新分类管理页面');
    console.log('   2. 选择要删除的分类');
    console.log('   3. 点击"批量删除"按钮');
    console.log('   4. 确认删除操作');

    console.log('\n💡 如果仍有问题，请检查:');
    console.log('   🔍 浏览器控制台是否有其他错误');
    console.log('   🔍 网络请求是否成功发送');
    console.log('   🔍 API响应状态码和内容');
    console.log('   🔍 身份验证是否正确配置');
  } else {
    console.log('\n❌ 修复验证失败，需要进一步检查');
    process.exit(1);
  }
}

verifyCategoryBatchDeleteFix();
