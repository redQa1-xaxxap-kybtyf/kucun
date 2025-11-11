#!/usr/bin/env node

/**
 * 批量迁移 zodResolver 到 standardSchemaResolver
 * 
 * 背景: Zod 4.x 与 @hookform/resolvers 的 zodResolver 存在兼容性问题
 * 解决方案: 使用 standardSchemaResolver 替代 zodResolver
 * 
 * 参考: https://github.com/react-hook-form/resolvers/issues/768
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 查找所有使用 zodResolver 的文件
 */
function findFilesWithZodResolver() {
  const patterns = [
    'hooks/**/*.ts',
    'hooks/**/*.tsx',
    'components/**/*.ts',
    'components/**/*.tsx',
    'app/**/*.ts',
    'app/**/*.tsx',
  ];

  const files = [];
  patterns.forEach(pattern => {
    const matches = glob.sync(pattern, { cwd: process.cwd() });
    files.push(...matches);
  });

  // 过滤出包含 zodResolver 的文件
  return files.filter(file => {
    const fullPath = path.join(process.cwd(), file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    return content.includes("from '@hookform/resolvers/zod'");
  });
}

/**
 * 迁移单个文件
 */
function migrateFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;

  // 1. 替换导入语句
  const oldImport = "import { zodResolver } from '@hookform/resolvers/zod';";
  const newImport = "import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';";

  if (content.includes(oldImport)) {
    content = content.replace(oldImport, newImport);
    modified = true;
  }

  // 2. 替换 zodResolver 调用
  const zodResolverPattern = /resolver:\s*zodResolver\(/g;
  if (zodResolverPattern.test(content)) {
    content = content.replace(zodResolverPattern, 'resolver: standardSchemaResolver(');
    modified = true;
  }

  // 3. 保存文件
  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    return true;
  }

  return false;
}

/**
 * 主函数
 */
function main() {
  log('\n🔄 开始迁移 zodResolver 到 standardSchemaResolver...\n', 'cyan');

  try {
    // 1. 查找文件
    const files = findFilesWithZodResolver();
    log(`📁 找到 ${files.length} 个使用 zodResolver 的文件\n`, 'blue');

    if (files.length === 0) {
      log('✅ 没有需要迁移的文件', 'green');
      return;
    }

    // 2. 迁移文件
    let migratedCount = 0;
    files.forEach(file => {
      const migrated = migrateFile(file);
      if (migrated) {
        migratedCount++;
        log(`  ✓ ${file}`, 'green');
      } else {
        log(`  - ${file} (无需修改)`, 'yellow');
      }
    });

    // 3. 输出结果
    log(`\n✅ 迁移完成！`, 'green');
    log(`   - 总文件数: ${files.length}`, 'reset');
    log(`   - 已迁移: ${migratedCount}`, 'green');
    log(`   - 无需修改: ${files.length - migratedCount}`, 'yellow');

    log('\n📝 迁移说明:', 'cyan');
    log('   1. zodResolver → standardSchemaResolver', 'reset');
    log('   2. Zod 4 支持 Standard Schema', 'reset');
    log('   3. 修复了 onBlur 验证时抛出 ZodError 的问题', 'reset');
    log('\n📚 参考文档:', 'cyan');
    log('   - https://github.com/react-hook-form/resolvers/issues/768', 'reset');
    log('   - https://github.com/react-hook-form/react-hook-form/issues/12816', 'reset');

  } catch (error) {
    log(`\n❌ 错误: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// 运行
main();

