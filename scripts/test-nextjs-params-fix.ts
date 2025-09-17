#!/usr/bin/env npx tsx

/**
 * Next.js 15.4 参数访问修复验证脚本
 * 验证动态路由页面是否正确使用 React.use() 来访问 Promise 参数
 */

import * as fs from 'fs';
import * as path from 'path';

// 需要检查的动态路由页面文件
const dynamicRouteFiles = [
  'app/(dashboard)/products/[id]/page.tsx',
  'app/(dashboard)/products/[id]/edit/page.tsx',
  'app/(dashboard)/categories/[id]/edit/page.tsx',
];

let allTestsPassed = true;

for (const filePath of dynamicRouteFiles) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // 检查是否有正确的类型定义
    const hasPromiseParamsType = content.includes('params: Promise<{') || content.includes('params: Promise<{ id: string }');

    // 检查是否使用了 React.use()
    const usesReactUse = content.includes('React.use(params)');

    // 检查是否还有直接访问 params 的情况（应该没有）
    const hasDirectParamsAccess = content.match(/const\s+{\s*\w+\s*}\s*=\s+params[^.]/) && !content.includes('React.use(params)');

    // 输出调试信息
    process.stdout.write(`${filePath}: Promise=${hasPromiseParamsType}, ReactUse=${usesReactUse}, DirectAccess=${!!hasDirectParamsAccess}\n`);

    if (!hasPromiseParamsType || !usesReactUse || hasDirectParamsAccess) {
      allTestsPassed = false;
    }

  } catch (error) {
    process.stdout.write(`${filePath}: Error reading file\n`);
    allTestsPassed = false;
  }
}

// 如果测试失败，退出并返回错误码
if (!allTestsPassed) {
  process.exit(1);
}
