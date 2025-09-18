#!/usr/bin/env tsx
/* eslint-disable no-console */

/**
 * 提交前代码质量检查
 * 自动检测潜在的冗余代码和质量问题
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

interface QualityIssue {
  type: 'error' | 'warning' | 'info';
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

/**
 * 获取暂存区的文件
 */
function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: process.cwd()
    });
    return output.trim().split('\n').filter(file => 
      file.endsWith('.ts') || file.endsWith('.tsx')
    );
  } catch (error) {
    console.warn('无法获取暂存区文件，检查所有文件');
    return [];
  }
}

/**
 * 检查硬编码字符串
 */
function checkHardcodedStrings(filePath: string, content: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');
  
  // 常见的应该提取为常量的硬编码字符串
  const hardcodedPatterns = [
    { pattern: /'未授权访问'/, suggestion: 'API_ERROR_MESSAGES.UNAUTHORIZED' },
    { pattern: /'输入数据格式不正确'/, suggestion: 'API_ERROR_MESSAGES.INVALID_INPUT' },
    { pattern: /'资源不存在'/, suggestion: 'API_ERROR_MESSAGES.NOT_FOUND' },
    { pattern: /'创建成功'/, suggestion: 'SUCCESS_MESSAGES.CREATED' },
    { pattern: /'更新成功'/, suggestion: 'SUCCESS_MESSAGES.UPDATED' },
    { pattern: /'删除成功'/, suggestion: 'SUCCESS_MESSAGES.DELETED' },
    { pattern: /'active'/, suggestion: 'STATUS_VALUES.ACTIVE' },
    { pattern: /'inactive'/, suggestion: 'STATUS_VALUES.INACTIVE' },
  ];

  lines.forEach((line, index) => {
    hardcodedPatterns.forEach(({ pattern, suggestion }) => {
      if (pattern.test(line)) {
        issues.push({
          type: 'warning',
          file: filePath,
          line: index + 1,
          message: '发现硬编码字符串，建议使用常量',
          suggestion: `使用 ${suggestion} 替代`
        });
      }
    });
  });

  return issues;
}

/**
 * 检查重复的样式类名组合
 */
function checkDuplicateStyles(filePath: string, content: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');
  
  // 常见的重复样式组合
  const stylePatterns = [
    { pattern: /className="[^"]*flex items-center gap-\d+[^"]*"/, suggestion: 'layoutStyles.flexGap*' },
    { pattern: /className="[^"]*flex items-center justify-between[^"]*"/, suggestion: 'layoutStyles.flexBetween' },
    { pattern: /className="[^"]*flex items-center justify-center[^"]*"/, suggestion: 'layoutStyles.flexCenter' },
    { pattern: /className="[^"]*grid grid-cols-1 md:grid-cols-\d+[^"]*"/, suggestion: 'layoutStyles.gridResponsive' },
  ];

  lines.forEach((line, index) => {
    stylePatterns.forEach(({ pattern, suggestion }) => {
      if (pattern.test(line)) {
        issues.push({
          type: 'info',
          file: filePath,
          line: index + 1,
          message: '发现常用样式组合，建议使用预定义样式类',
          suggestion: `考虑使用 ${suggestion}`
        });
      }
    });
  });

  return issues;
}

/**
 * 检查可能的重复函数
 */
function checkPotentialDuplicateFunctions(filePath: string, content: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');
  
  // 常见的可能重复的函数模式
  const functionPatterns = [
    { pattern: /const\s+format\w*\s*=/, message: '发现格式化函数，检查是否已在 lib/utils 中存在' },
    { pattern: /const\s+validate\w*\s*=/, message: '发现验证函数，检查是否已在 lib/utils/validation-helpers 中存在' },
    { pattern: /const\s+\w*Date\w*\s*=/, message: '发现日期处理函数，检查是否已在 lib/utils 中存在' },
    { pattern: /const\s+\w*Currency\w*\s*=/, message: '发现货币处理函数，检查是否已在 lib/utils 中存在' },
  ];

  lines.forEach((line, index) => {
    functionPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(line)) {
        issues.push({
          type: 'warning',
          file: filePath,
          line: index + 1,
          message,
          suggestion: '检查现有工具函数库，避免重复实现'
        });
      }
    });
  });

  return issues;
}

/**
 * 检查导入规范
 */
function checkImportConventions(filePath: string, content: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // 检查是否使用了相对路径而不是别名
    if (line.includes('import') && line.includes('../')) {
      issues.push({
        type: 'warning',
        file: filePath,
        line: index + 1,
        message: '建议使用路径别名 @/ 而不是相对路径',
        suggestion: '使用 @/ 开头的绝对路径'
      });
    }
    
    // 检查是否直接使用了 process.env
    if (line.includes('process.env') && !filePath.includes('lib/env.ts')) {
      issues.push({
        type: 'error',
        file: filePath,
        line: index + 1,
        message: '不应直接使用 process.env，应从 lib/env.ts 导入',
        suggestion: '从 lib/env.ts 导入环境变量'
      });
    }
  });

  return issues;
}

/**
 * 检查单个文件
 */
function checkFile(filePath: string): QualityIssue[] {
  try {
    const content = readFileSync(filePath, 'utf8');
    const issues: QualityIssue[] = [];
    
    // 跳过某些文件
    if (filePath.includes('node_modules') || 
        filePath.includes('.next') || 
        filePath.includes('dist')) {
      return issues;
    }
    
    issues.push(...checkHardcodedStrings(filePath, content));
    issues.push(...checkDuplicateStyles(filePath, content));
    issues.push(...checkPotentialDuplicateFunctions(filePath, content));
    issues.push(...checkImportConventions(filePath, content));
    
    return issues;
  } catch (error) {
    return [{
      type: 'error',
      file: filePath,
      message: `无法读取文件: ${error}`
    }];
  }
}

/**
 * 运行TypeScript检查
 */
function runTypeScriptCheck(): boolean {
  try {
    console.log('🔍 运行 TypeScript 类型检查...');
    execSync('npx tsc --noEmit --skipLibCheck', { 
      stdio: 'pipe',
      cwd: process.cwd()
    });
    console.log('✅ TypeScript 类型检查通过');
    return true;
  } catch (error) {
    console.log('❌ TypeScript 类型检查失败');
    console.log(error.toString());
    return false;
  }
}

/**
 * 运行ESLint检查
 */
function runESLintCheck(): boolean {
  try {
    console.log('🔍 运行 ESLint 检查...');
    execSync('npx eslint . --ext .ts,.tsx --quiet', { 
      stdio: 'pipe',
      cwd: process.cwd()
    });
    console.log('✅ ESLint 检查通过');
    return true;
  } catch (error) {
    console.log('❌ ESLint 检查发现问题');
    console.log(error.toString());
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始代码质量检查...\n');
  
  // 获取要检查的文件
  const stagedFiles = getStagedFiles();
  const filesToCheck = stagedFiles.length > 0 ? stagedFiles : [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}'
  ];
  
  console.log(`📁 检查 ${filesToCheck.length} 个文件...\n`);
  
  // 收集所有问题
  const allIssues: QualityIssue[] = [];
  
  if (stagedFiles.length > 0) {
    // 检查暂存区文件
    stagedFiles.forEach(file => {
      const issues = checkFile(file);
      allIssues.push(...issues);
    });
  } else {
    // 检查所有相关文件
    try {
      const allFiles = execSync(
        'find app components lib -name "*.ts" -o -name "*.tsx" | head -50',
        { encoding: 'utf8', cwd: process.cwd() }
      ).trim().split('\n').filter(Boolean);
      
      allFiles.forEach(file => {
        const issues = checkFile(file);
        allIssues.push(...issues);
      });
    } catch (error) {
      console.warn('无法获取文件列表，跳过文件检查');
    }
  }
  
  // 分类显示问题
  const errors = allIssues.filter(issue => issue.type === 'error');
  const warnings = allIssues.filter(issue => issue.type === 'warning');
  const infos = allIssues.filter(issue => issue.type === 'info');
  
  if (errors.length > 0) {
    console.log('🚨 错误 (必须修复):');
    errors.forEach(issue => {
      console.log(`   ${issue.file}:${issue.line || '?'} - ${issue.message}`);
      if (issue.suggestion) {
        console.log(`      💡 建议: ${issue.suggestion}`);
      }
    });
    console.log();
  }
  
  if (warnings.length > 0) {
    console.log('⚠️  警告 (建议修复):');
    warnings.forEach(issue => {
      console.log(`   ${issue.file}:${issue.line || '?'} - ${issue.message}`);
      if (issue.suggestion) {
        console.log(`      💡 建议: ${issue.suggestion}`);
      }
    });
    console.log();
  }
  
  if (infos.length > 0) {
    console.log('💡 信息 (优化建议):');
    infos.forEach(issue => {
      console.log(`   ${issue.file}:${issue.line || '?'} - ${issue.message}`);
      if (issue.suggestion) {
        console.log(`      💡 建议: ${issue.suggestion}`);
      }
    });
    console.log();
  }
  
  // 运行其他检查
  const tsCheckPassed = runTypeScriptCheck();
  const eslintCheckPassed = runESLintCheck();
  
  // 总结
  console.log('📊 检查总结:');
  console.log(`   错误: ${errors.length}`);
  console.log(`   警告: ${warnings.length}`);
  console.log(`   信息: ${infos.length}`);
  console.log(`   TypeScript: ${tsCheckPassed ? '✅' : '❌'}`);
  console.log(`   ESLint: ${eslintCheckPassed ? '✅' : '❌'}`);
  
  // 决定是否允许提交
  const hasBlockingIssues = errors.length > 0 || !tsCheckPassed;
  
  if (hasBlockingIssues) {
    console.log('\n❌ 发现阻塞性问题，请修复后再提交');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('\n⚠️  发现警告，建议修复后提交');
    console.log('如需强制提交，请使用 git commit --no-verify');
  } else {
    console.log('\n✅ 代码质量检查通过！');
  }
}

main().catch(console.error);
