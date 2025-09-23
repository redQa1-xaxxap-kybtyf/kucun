#!/usr/bin/env tsx

/**
 * 批量更新 Next-Auth.js 导入和使用方式
 * 从 getServerSession(authOptions) 更新为 auth()
 */

import * as fs from 'fs';
import * as path from 'path';

interface FileUpdate {
  filePath: string;
  description: string;
  oldImport: string;
  newImport: string;
  oldUsage: string;
  newUsage: string;
}

// 需要更新的文件列表
const filesToUpdate: FileUpdate[] = [
  {
    filePath: 'lib/api/inbound-handlers.ts',
    description: '入库处理器',
    oldImport: "import { getServerSession } from 'next-auth';\n\nimport { authOptions } from '@/lib/auth';",
    newImport: "import { auth } from '@/lib/auth';",
    oldUsage: 'const session = await getServerSession(authOptions);',
    newUsage: 'const session = await auth();'
  },
  {
    filePath: 'lib/api/sales-order-handlers.ts',
    description: '销售订单处理器',
    oldImport: "import { getServerSession } from 'next-auth';\n\nimport { authOptions } from '@/lib/auth';",
    newImport: "import { auth } from '@/lib/auth';",
    oldUsage: 'const session = await getServerSession(authOptions);',
    newUsage: 'const session = await auth();'
  },
  {
    filePath: 'lib/api/customer-handlers.ts',
    description: '客户处理器',
    oldImport: "import { getServerSession } from 'next-auth';\n\nimport { authOptions } from '@/lib/auth';",
    newImport: "import { auth } from '@/lib/auth';",
    oldUsage: 'const session = await getServerSession(authOptions);',
    newUsage: 'const session = await auth();'
  },
  {
    filePath: 'app/api/dashboard/config/route.ts',
    description: '仪表盘配置API',
    oldImport: "import { getServerSession } from 'next-auth';\nimport type { NextRequest } from 'next/server';\nimport { NextResponse } from 'next/server';\n\nimport { authOptions } from '@/lib/auth';",
    newImport: "import type { NextRequest } from 'next/server';\nimport { NextResponse } from 'next/server';\n\nimport { auth } from '@/lib/auth';",
    oldUsage: 'const session = await getServerSession(authOptions);',
    newUsage: 'const session = await auth();'
  },
  {
    filePath: 'app/api/auth/update-password/route.ts',
    description: '密码更新API',
    oldImport: "import { getServerSession } from 'next-auth';\nimport { z } from 'zod';\n\nimport { authOptions, updatePassword } from '@/lib/auth';",
    newImport: "import { z } from 'zod';\n\nimport { auth, updatePassword } from '@/lib/auth';",
    oldUsage: 'const session = await getServerSession(authOptions);',
    newUsage: 'const session = await auth();'
  },
  {
    filePath: 'app/api/sales-orders/[id]/route.ts',
    description: '销售订单详情API',
    oldImport: "import { getServerSession } from 'next-auth';\n\nimport { authOptions } from '@/lib/auth';",
    newImport: "import { auth } from '@/lib/auth';",
    oldUsage: 'const session = await getServerSession(authOptions);',
    newUsage: 'const session = await auth();'
  }
];

/**
 * 更新单个文件
 */
function updateFile(update: FileUpdate): boolean {
  try {
    const fullPath = path.join(process.cwd(), update.filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  文件不存在: ${update.filePath}`);
      return false;
    }

    let content = fs.readFileSync(fullPath, 'utf-8');
    let modified = false;

    // 更新导入语句
    if (content.includes(update.oldImport)) {
      content = content.replace(update.oldImport, update.newImport);
      modified = true;
    }

    // 更新使用方式
    if (content.includes(update.oldUsage)) {
      content = content.replace(new RegExp(update.oldUsage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), update.newUsage);
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ 更新成功: ${update.description} (${update.filePath})`);
      return true;
    } else {
      console.log(`ℹ️  无需更新: ${update.description} (${update.filePath})`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 更新失败: ${update.filePath}`, error);
    return false;
  }
}

/**
 * 查找所有包含 getServerSession 的文件
 */
function findFilesWithGetServerSession(): string[] {
  try {
    const { execSync } = require('child_process');
    const output = execSync(
      'find app lib -name "*.ts" -o -name "*.tsx" | xargs grep -l "getServerSession" 2>/dev/null || true',
      { encoding: 'utf8', cwd: process.cwd() }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('查找文件失败:', error);
    return [];
  }
}

/**
 * 通用更新函数，处理未在列表中的文件
 */
function updateGenericFile(filePath: string): boolean {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    let content = fs.readFileSync(fullPath, 'utf-8');
    let modified = false;

    // 替换导入语句
    const importPattern = /import\s+{\s*getServerSession\s*}\s+from\s+['"]next-auth['"];?\s*\n\s*import\s+{\s*authOptions\s*}\s+from\s+['"]@\/lib\/auth['"];?/g;
    if (importPattern.test(content)) {
      content = content.replace(importPattern, "import { auth } from '@/lib/auth';");
      modified = true;
    }

    // 替换使用方式
    const usagePattern = /getServerSession\(authOptions\)/g;
    if (usagePattern.test(content)) {
      content = content.replace(usagePattern, 'auth()');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ 通用更新成功: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ 通用更新失败: ${filePath}`, error);
    return false;
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🔧 开始更新 Next-Auth.js 导入和使用方式...\n');

  let updatedCount = 0;

  // 1. 更新预定义的文件
  console.log('📋 更新预定义文件...');
  for (const update of filesToUpdate) {
    if (updateFile(update)) {
      updatedCount++;
    }
  }

  // 2. 查找并更新其他文件
  console.log('\n🔍 查找其他包含 getServerSession 的文件...');
  const allFiles = findFilesWithGetServerSession();
  const predefinedPaths = filesToUpdate.map(u => u.filePath);
  const remainingFiles = allFiles.filter(file => !predefinedPaths.includes(file));

  if (remainingFiles.length > 0) {
    console.log('📝 更新其他文件...');
    for (const file of remainingFiles) {
      if (updateGenericFile(file)) {
        updatedCount++;
      }
    }
  }

  console.log(`\n✨ 更新完成！共更新 ${updatedCount} 个文件`);
  
  // 3. 验证更新结果
  console.log('\n🔍 验证更新结果...');
  const remainingGetServerSession = findFilesWithGetServerSession();
  if (remainingGetServerSession.length === 0) {
    console.log('✅ 所有文件已成功更新！');
  } else {
    console.log('⚠️  以下文件仍包含 getServerSession:');
    remainingGetServerSession.forEach(file => console.log(`  - ${file}`));
  }
}

if (require.main === module) {
  main();
}
