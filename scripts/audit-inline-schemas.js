#!/usr/bin/env node

/**
 * 审计内联 Zod Schema 定义
 * 
 * 功能:
 * 1. 扫描 app/api 目录下的所有 TypeScript 文件
 * 2. 查找内联定义的 Zod Schema
 * 3. 生成审计报告
 * 
 * 使用方法:
 * node scripts/audit-inline-schemas.js
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  scanDir: path.join(process.cwd(), 'app/api'),
  outputFile: path.join(process.cwd(), 'inline-schemas-audit.json'),
  patterns: {
    // 匹配 const xxxSchema = z.object({
    schemaDefinition: /const\s+(\w+Schema)\s*=\s*z\.object\s*\(/g,
    // 匹配 z.object({ 但不在 const 定义中
    inlineObject: /(?<!const\s+\w+\s*=\s*)z\.object\s*\(/g,
  },
};

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
 * 递归扫描目录
 */
function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      scanDirectory(filePath, fileList);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * 分析文件中的 Schema 定义
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  
  const results = {
    file: relativePath,
    hasInlineSchema: false,
    schemas: [],
    issues: [],
  };

  // 检查是否导入了 zod
  const hasZodImport = content.includes("from 'zod'") || content.includes('from "zod"');
  
  if (!hasZodImport) {
    return null; // 不使用 zod 的文件跳过
  }

  // 查找 Schema 定义
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // 匹配 const xxxSchema = z.object({
    const schemaMatch = line.match(/const\s+(\w+Schema)\s*=\s*z\.object/);
    if (schemaMatch) {
      const schemaName = schemaMatch[1];
      
      // 检查是否从 lib/validations 导入
      const isImported = content.includes(`import.*${schemaName}.*from.*@/lib/validations`);
      
      if (!isImported) {
        results.hasInlineSchema = true;
        results.schemas.push({
          name: schemaName,
          line: lineNumber,
          code: line.trim(),
        });
      }
    }
  });

  // 检查是否有验证逻辑但没有使用统一的验证中间件
  if (results.hasInlineSchema) {
    const hasValidationMiddleware = 
      content.includes('withBodyValidation') || 
      content.includes('withQueryValidation');
    
    if (!hasValidationMiddleware) {
      results.issues.push({
        type: 'no-validation-middleware',
        message: '未使用统一的验证中间件',
      });
    }
  }

  return results.hasInlineSchema ? results : null;
}

/**
 * 生成报告
 */
function generateReport(results) {
  const totalFiles = results.length;
  const totalSchemas = results.reduce((sum, r) => sum + r.schemas.length, 0);

  log('\n========================================', 'cyan');
  log('内联 Schema 审计报告', 'cyan');
  log('========================================\n', 'cyan');

  log(`扫描目录: ${CONFIG.scanDir}`, 'blue');
  log(`发现问题文件: ${totalFiles}`, 'yellow');
  log(`发现内联 Schema: ${totalSchemas}\n`, 'yellow');

  if (totalFiles === 0) {
    log('✅ 太棒了! 没有发现内联 Schema 定义', 'green');
    return;
  }

  log('问题文件列表:\n', 'red');

  results.forEach((result, index) => {
    log(`${index + 1}. ${result.file}`, 'yellow');
    
    result.schemas.forEach(schema => {
      log(`   - ${schema.name} (第 ${schema.line} 行)`, 'reset');
      log(`     ${schema.code}`, 'cyan');
    });

    if (result.issues.length > 0) {
      result.issues.forEach(issue => {
        log(`   ⚠️  ${issue.message}`, 'yellow');
      });
    }

    log('');
  });

  log('========================================', 'cyan');
  log('建议操作:', 'green');
  log('========================================\n', 'cyan');

  log('1. 将内联 Schema 迁移到 lib/validations/ 目录', 'reset');
  log('2. 使用统一的验证中间件 (withBodyValidation/withQueryValidation)', 'reset');
  log('3. 参考文档: docs/VALIDATION_ARCHITECTURE_OPTIMIZATION.md\n', 'reset');

  // 保存 JSON 报告
  fs.writeFileSync(
    CONFIG.outputFile,
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  log(`详细报告已保存到: ${CONFIG.outputFile}`, 'green');
}

/**
 * 主函数
 */
function main() {
  log('\n开始扫描内联 Schema 定义...\n', 'cyan');

  try {
    // 扫描文件
    const files = scanDirectory(CONFIG.scanDir);
    log(`找到 ${files.length} 个 TypeScript 文件`, 'blue');

    // 分析文件
    const results = [];
    files.forEach(file => {
      const result = analyzeFile(file);
      if (result) {
        results.push(result);
      }
    });

    // 生成报告
    generateReport(results);

  } catch (error) {
    log(`\n❌ 错误: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// 运行
main();

