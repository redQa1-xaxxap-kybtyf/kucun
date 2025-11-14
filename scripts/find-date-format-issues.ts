/**
 * 查找项目中日期格式不统一的问题
 *
 * 用途：
 * 1. 扫描所有 .tsx 和 .ts 文件
 * 2. 查找使用原生 JS 日期方法的位置
 * 3. 查找直接使用 date-fns format() 的位置
 * 4. 生成详细的问题报告
 *
 * 运行方式：
 * npx tsx scripts/find-date-format-issues.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface Issue {
  file: string;
  line: number;
  column: number;
  type:
    | 'toLocaleString'
    | 'toLocaleDateString'
    | 'direct-format'
    | 'missing-seconds';
  code: string;
  severity: 'high' | 'medium' | 'low';
}

const issues: Issue[] = [];

// 需要扫描的目录
const SCAN_DIRS = ['app', 'components', 'lib'];

// 需要排除的目录
const EXCLUDE_DIRS = ['node_modules', '.next', 'dist', 'build'];

// 问题模式
const PATTERNS = {
  toLocaleString: /\.toLocaleString\s*\(/g,
  toLocaleDateString: /\.toLocaleDateString\s*\(/g,
  directFormat: /import\s+{\s*[^}]*format[^}]*}\s+from\s+['"]date-fns['"]/g,
  missingSeconds: /['"]yyyy-MM-dd HH:mm['"]/g,
};

const formatMessage = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.stack ?? value.message;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const logInfo = (...messages: unknown[]): void => {
  process.stdout.write(`${messages.map(formatMessage).join(' ')}\n`);
};

const logError = (...messages: unknown[]): void => {
  process.stderr.write(`${messages.map(formatMessage).join(' ')}\n`);
};

/**
 * 递归扫描目录
 */
function scanDirectory(dir: string): void {
  try {
    const files = readdirSync(dir);

    for (const file of files) {
      const filePath = join(dir, file);
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        // 跳过排除的目录
        if (EXCLUDE_DIRS.includes(file)) {
          continue;
        }
        scanDirectory(filePath);
      } else if (stat.isFile()) {
        // 只扫描 .ts 和 .tsx 文件
        if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          scanFile(filePath);
        }
      }
    }
  } catch (error) {
    logError(`扫描目录失败: ${dir}`, error);
  }
}

/**
 * 扫描单个文件
 */
function scanFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // 检查 toLocaleString
      let match;
      while ((match = PATTERNS.toLocaleString.exec(line)) !== null) {
        issues.push({
          file: filePath,
          line: lineNumber,
          column: match.index,
          type: 'toLocaleString',
          code: line.trim(),
          severity: 'high',
        });
      }

      // 检查 toLocaleDateString
      PATTERNS.toLocaleDateString.lastIndex = 0;
      while ((match = PATTERNS.toLocaleDateString.exec(line)) !== null) {
        issues.push({
          file: filePath,
          line: lineNumber,
          column: match.index,
          type: 'toLocaleDateString',
          code: line.trim(),
          severity: 'high',
        });
      }

      // 检查直接导入 format
      PATTERNS.directFormat.lastIndex = 0;
      while ((match = PATTERNS.directFormat.exec(line)) !== null) {
        issues.push({
          file: filePath,
          line: lineNumber,
          column: match.index,
          type: 'direct-format',
          code: line.trim(),
          severity: 'medium',
        });
      }

      // 检查缺少秒的格式
      PATTERNS.missingSeconds.lastIndex = 0;
      while ((match = PATTERNS.missingSeconds.exec(line)) !== null) {
        issues.push({
          file: filePath,
          line: lineNumber,
          column: match.index,
          type: 'missing-seconds',
          code: line.trim(),
          severity: 'low',
        });
      }
    });
  } catch (error) {
    logError(`扫描文件失败: ${filePath}`, error);
  }
}

/**
 * 生成报告
 */
function generateReport(): void {
  logInfo('\n📊 日期格式问题扫描报告');
  logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 按严重程度分组
  const highIssues = issues.filter(i => i.severity === 'high');
  const mediumIssues = issues.filter(i => i.severity === 'medium');
  const lowIssues = issues.filter(i => i.severity === 'low');

  logInfo(`总问题数: ${issues.length}`);
  logInfo(`  🚨 高优先级: ${highIssues.length}`);
  logInfo(`  ⚠️  中优先级: ${mediumIssues.length}`);
  logInfo(`  💡 低优先级: ${lowIssues.length}\n`);

  // 按类型分组
  const byType = issues.reduce(
    (acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  logInfo('问题类型分布:');
  logInfo(`  toLocaleString: ${byType['toLocaleString'] || 0}`);
  logInfo(`  toLocaleDateString: ${byType['toLocaleDateString'] || 0}`);
  logInfo(`  直接使用 format: ${byType['direct-format'] || 0}`);
  logInfo(`  缺少秒显示: ${byType['missing-seconds'] || 0}\n`);

  // 详细问题列表
  if (highIssues.length > 0) {
    logInfo('🚨 高优先级问题（必须修复）:');
    logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    highIssues.slice(0, 20).forEach(issue => {
      logInfo(`📁 ${issue.file}:${issue.line}:${issue.column}`);
      logInfo(`   类型: ${issue.type}`);
      logInfo(`   代码: ${issue.code}`);
      logInfo('');
    });
    if (highIssues.length > 20) {
      logInfo(`   ... 还有 ${highIssues.length - 20} 个问题\n`);
    }
  }

  if (mediumIssues.length > 0) {
    logInfo('⚠️  中优先级问题（建议修复）:');
    logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    mediumIssues.slice(0, 10).forEach(issue => {
      logInfo(`📁 ${issue.file}:${issue.line}:${issue.column}`);
      logInfo(`   类型: ${issue.type}`);
      logInfo(`   代码: ${issue.code}`);
      logInfo('');
    });
    if (mediumIssues.length > 10) {
      logInfo(`   ... 还有 ${mediumIssues.length - 10} 个问题\n`);
    }
  }

  // 按文件分组统计
  const byFile = issues.reduce(
    (acc, issue) => {
      acc[issue.file] = (acc[issue.file] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const topFiles = Object.entries(byFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (topFiles.length > 0) {
    logInfo('📊 问题最多的文件（Top 10）:');
    logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    topFiles.forEach(([file, count], index) => {
      logInfo(`${index + 1}. ${file}: ${count} 个问题`);
    });
    logInfo('');
  }

  // 修复建议
  logInfo('💡 修复建议:');
  logInfo('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  logInfo('1. 替换 toLocaleString():');
  logInfo('   ❌ new Date(date).toLocaleString("zh-CN")');
  logInfo('   ✅ formatDateTime(date)\n');

  logInfo('2. 替换 toLocaleDateString():');
  logInfo('   ❌ new Date(date).toLocaleDateString("zh-CN")');
  logInfo('   ✅ formatDate(date)\n');

  logInfo('3. 替换直接使用 format():');
  logInfo('   ❌ import { format } from "date-fns"');
  logInfo('   ❌ format(new Date(), "yyyy-MM-dd HH:mm:ss")');
  logInfo('   ✅ import { formatDateTime } from "@/lib/utils/datetime"');
  logInfo('   ✅ formatDateTime(new Date())\n');

  logInfo('4. 添加秒显示:');
  logInfo('   ❌ formatDateTime(date, "yyyy-MM-dd HH:mm")');
  logInfo('   ✅ formatDateTime(date, DATE_FORMATS.DATETIME_FULL)\n');

  logInfo('📚 参考文档:');
  logInfo('   - docs/date-format-analysis.md');
  logInfo('   - docs/date-format-migration-guide.md\n');
}

/**
 * 主函数
 */
function main(): void {
  logInfo('🔍 开始扫描项目中的日期格式问题...\n');

  const startTime = Date.now();

  // 扫描所有目录
  for (const dir of SCAN_DIRS) {
    logInfo(`扫描目录: ${dir}/`);
    scanDirectory(dir);
  }

  const duration = Date.now() - startTime;

  logInfo(`\n✅ 扫描完成，耗时: ${duration}ms`);

  // 生成报告
  generateReport();
}

// 执行扫描
main();
