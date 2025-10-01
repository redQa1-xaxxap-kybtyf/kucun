/**
 * 批量为财务 API 添加开发模式绕过
 * 此脚本会自动修改所有需要添加开发模式绕过的 API 文件
 */

const fs = require('fs');
const path = require('path');

// 需要修复的文件列表
const filesToFix = [
  'app/api/finance/payments-out/route.ts',
  'app/api/finance/payments-out/[id]/route.ts',
  'app/api/finance/receivables/route.ts',
  'app/api/finance/receivables/statistics/route.ts',
  'app/api/finance/refunds/route.ts',
  'app/api/finance/refunds/[id]/route.ts',
  'app/api/finance/refunds/statistics/route.ts',
  'app/api/finance/payables/statistics/route.ts',
  'app/api/payments/route.ts',
  'app/api/payments/[id]/route.ts',
];

// 修复单个文件
function fixFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`✗ 文件不存在: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // 检查是否已经导入 env
  if (!content.includes("import { env } from '@/lib/env'")) {
    // 在 import 语句后添加 env 导入
    const importRegex = /(import.*from '@\/lib\/db';)/;
    if (importRegex.test(content)) {
      content = content.replace(
        importRegex,
        "$1\nimport { env } from '@/lib/env';"
      );
      modified = true;
    }
  }

  // 替换身份验证代码
  const authPattern = /(\s+)(\/\/ 身份验证\n\s+const session = await getServerSession\(authOptions\);\n\s+if \(!session)/g;
  
  if (authPattern.test(content)) {
    content = content.replace(
      authPattern,
      "$1// 身份验证 (开发模式下绕过)\n$1if (env.NODE_ENV !== 'development') {\n$1  const session = await getServerSession(authOptions);\n$1  if (!session"
    );
    
    // 添加闭合括号
    content = content.replace(
      /(if \(!session\) \{\n\s+return NextResponse\.json\(\n\s+\{ success: false, error: '未授权访问' \},\n\s+\{ status: 401 \}\n\s+\);\n\s+\})/g,
      "$1\n    }"
    );
    
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✓ 已修复: ${filePath}`);
    return true;
  } else {
    console.log(`- 无需修复: ${filePath}`);
    return false;
  }
}

// 主函数
function main() {
  console.log('开始批量添加开发模式绕过...\n');
  
  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const file of filesToFix) {
    try {
      const result = fixFile(file);
      if (result) {
        fixedCount++;
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.error(`✗ 修复失败: ${file}`, error.message);
      errorCount++;
    }
  }

  console.log(`\n修复完成！`);
  console.log(`已修复: ${fixedCount} 个文件`);
  console.log(`跳过: ${skippedCount} 个文件`);
  console.log(`失败: ${errorCount} 个文件`);
}

main();

