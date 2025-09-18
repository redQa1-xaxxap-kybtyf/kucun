#!/usr/bin/env tsx
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 色号和生产日期字段清理脚本
 * 全面检查并清理前端代码中的colorCode和productionDate字段残留引用
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface FileAnalysis {
  filePath: string;
  colorCodeReferences: string[];
  productionDateReferences: string[];
  needsCleanup: boolean;
  fileType: 'frontend' | 'api' | 'component' | 'type' | 'validation';
}

interface CleanupResult {
  totalFiles: number;
  frontendFiles: number;
  cleanedFiles: number;
  skippedFiles: number;
  errors: string[];
}

/**
 * 获取所有包含colorCode或productionDate的文件
 */
function getFilesWithReferences(): string[] {
  try {
    const output = execSync(
      'find app components lib -name "*.tsx" -o -name "*.ts" | xargs grep -l "colorCode\\|productionDate"',
      { encoding: 'utf8', cwd: process.cwd() }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('获取文件列表失败:', error);
    return [];
  }
}

/**
 * 分析文件内容
 */
function analyzeFile(filePath: string): FileAnalysis {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  const colorCodeReferences: string[] = [];
  const productionDateReferences: string[] = [];
  
  lines.forEach((line, index) => {
    if (line.includes('colorCode')) {
      colorCodeReferences.push(`Line ${index + 1}: ${line.trim()}`);
    }
    if (line.includes('productionDate')) {
      productionDateReferences.push(`Line ${index + 1}: ${line.trim()}`);
    }
  });
  
  // 确定文件类型
  let fileType: FileAnalysis['fileType'] = 'api';
  if (filePath.includes('components/')) {
    fileType = 'component';
  } else if (filePath.includes('app/') && filePath.includes('.tsx')) {
    fileType = 'frontend';
  } else if (filePath.includes('lib/types/')) {
    fileType = 'type';
  } else if (filePath.includes('lib/validations/')) {
    fileType = 'validation';
  }
  
  // 判断是否需要清理（前端相关文件）
  const needsCleanup = (fileType === 'frontend' || fileType === 'component') && 
                       (colorCodeReferences.length > 0 || productionDateReferences.length > 0);
  
  return {
    filePath,
    colorCodeReferences,
    productionDateReferences,
    needsCleanup,
    fileType,
  };
}

/**
 * 检查文件是否应该保留colorCode/productionDate（API文件等）
 */
function shouldPreserveReferences(filePath: string): boolean {
  // API路由文件需要保留，因为它们处理数据库交互
  if (filePath.includes('app/api/')) return true;
  
  // 类型定义文件可能需要保留（向后兼容）
  if (filePath.includes('lib/types/')) return true;
  
  // 验证文件可能需要保留
  if (filePath.includes('lib/validations/')) return true;
  
  // 测试文件保留
  if (filePath.includes('test') || filePath.includes('Test')) return true;
  
  return false;
}

/**
 * 清理前端组件文件
 */
function cleanupFrontendFile(filePath: string): boolean {
  try {
    let content = readFileSync(filePath, 'utf8');
    let modified = false;
    
    // 移除ColorCodeDisplay导入
    const colorCodeDisplayImportRegex = /import.*ColorCodeDisplay.*from.*@\/components\/ui\/color-code-display.*;\n?/g;
    if (colorCodeDisplayImportRegex.test(content)) {
      content = content.replace(colorCodeDisplayImportRegex, '');
      modified = true;
    }
    
    // 移除colorCode相关的JSX和逻辑
    const colorCodePatterns = [
      // JSX中的colorCode引用
      /\{[^}]*colorCode[^}]*\}/g,
      // colorCode属性
      /colorCode\s*[=:][^,}\n]*/g,
      // colorCode相关的条件渲染
      /\{[^}]*colorCode[^}]*&&[^}]*\}/g,
      // colorCode相关的函数调用
      /[a-zA-Z_$][a-zA-Z0-9_$]*\([^)]*colorCode[^)]*\)/g,
    ];
    
    colorCodePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, '');
        modified = true;
      }
    });
    
    // 移除productionDate相关的JSX和逻辑
    const productionDatePatterns = [
      // JSX中的productionDate引用
      /\{[^}]*productionDate[^}]*\}/g,
      // productionDate属性
      /productionDate\s*[=:][^,}\n]*/g,
      // productionDate相关的条件渲染
      /\{[^}]*productionDate[^}]*&&[^}]*\}/g,
      // productionDate相关的函数调用
      /[a-zA-Z_$][a-zA-Z0-9_$]*\([^)]*productionDate[^)]*\)/g,
    ];
    
    productionDatePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, '');
        modified = true;
      }
    });
    
    // 清理空行
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (modified) {
      writeFileSync(filePath, content, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`清理文件失败 ${filePath}:`, error);
    return false;
  }
}

/**
 * 主清理函数
 */
async function runCleanup(): Promise<CleanupResult> {
  console.log('🚀 开始全面检查色号和生产日期字段残留引用...\n');
  
  const files = getFilesWithReferences();
  const result: CleanupResult = {
    totalFiles: files.length,
    frontendFiles: 0,
    cleanedFiles: 0,
    skippedFiles: 0,
    errors: [],
  };
  
  console.log(`📊 发现 ${files.length} 个文件包含 colorCode 或 productionDate 引用\n`);
  
  // 分析所有文件
  const analyses: FileAnalysis[] = [];
  for (const filePath of files) {
    try {
      const analysis = analyzeFile(filePath);
      analyses.push(analysis);
      
      if (analysis.fileType === 'frontend' || analysis.fileType === 'component') {
        result.frontendFiles++;
      }
    } catch (error) {
      result.errors.push(`分析文件失败 ${filePath}: ${error}`);
    }
  }
  
  // 按文件类型分组显示
  console.log('📋 文件分析结果:');
  console.log('='.repeat(80));
  
  const groupedByType = analyses.reduce((acc, analysis) => {
    if (!acc[analysis.fileType]) acc[analysis.fileType] = [];
    acc[analysis.fileType].push(analysis);
    return acc;
  }, {} as Record<string, FileAnalysis[]>);
  
  Object.entries(groupedByType).forEach(([type, fileAnalyses]) => {
    console.log(`\n${type.toUpperCase()} 文件 (${fileAnalyses.length}个):`);
    fileAnalyses.forEach(analysis => {
      const colorCount = analysis.colorCodeReferences.length;
      const dateCount = analysis.productionDateReferences.length;
      const status = analysis.needsCleanup ? '🔧 需要清理' : '✅ 保留';
      console.log(`  ${status} ${analysis.filePath} (colorCode: ${colorCount}, productionDate: ${dateCount})`);
    });
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('\n🔧 开始清理前端文件...\n');
  
  // 清理需要清理的文件
  for (const analysis of analyses) {
    if (analysis.needsCleanup && !shouldPreserveReferences(analysis.filePath)) {
      try {
        const cleaned = cleanupFrontendFile(analysis.filePath);
        if (cleaned) {
          console.log(`✅ 已清理: ${analysis.filePath}`);
          result.cleanedFiles++;
        } else {
          console.log(`⚪ 无需修改: ${analysis.filePath}`);
          result.skippedFiles++;
        }
      } catch (error) {
        const errorMsg = `清理失败 ${analysis.filePath}: ${error}`;
        result.errors.push(errorMsg);
        console.log(`❌ ${errorMsg}`);
      }
    } else {
      result.skippedFiles++;
    }
  }
  
  return result;
}

/**
 * 验证清理结果
 */
async function validateCleanup(): Promise<boolean> {
  console.log('\n🔍 验证清理结果...\n');
  
  try {
    // 检查TypeScript编译
    console.log('📝 检查TypeScript编译...');
    execSync('npx tsc --noEmit --skipLibCheck', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log('✅ TypeScript编译通过');
    
    // 重新扫描前端文件
    const remainingFiles = execSync(
      'find app components -name "*.tsx" | xargs grep -l "colorCode\\|productionDate" || true',
      { encoding: 'utf8', cwd: process.cwd() }
    ).trim();
    
    if (remainingFiles) {
      console.log('⚠️  仍有前端文件包含引用:');
      remainingFiles.split('\n').forEach(file => {
        if (file.trim()) console.log(`  - ${file}`);
      });
      return false;
    } else {
      console.log('✅ 所有前端文件已清理完成');
      return true;
    }
    
  } catch (error) {
    console.log('❌ 验证失败:', error);
    return false;
  }
}

// 运行清理
if (require.main === module) {
  runCleanup()
    .then(async (result) => {
      console.log('\n📊 清理结果总结:');
      console.log('='.repeat(50));
      console.log(`总文件数: ${result.totalFiles}`);
      console.log(`前端文件数: ${result.frontendFiles}`);
      console.log(`已清理文件: ${result.cleanedFiles}`);
      console.log(`跳过文件: ${result.skippedFiles}`);
      console.log(`错误数: ${result.errors.length}`);
      
      if (result.errors.length > 0) {
        console.log('\n❌ 错误详情:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      // 验证清理结果
      const isValid = await validateCleanup();
      
      if (isValid && result.errors.length === 0) {
        console.log('\n🎉 清理任务完成！所有前端文件已成功清理。');
      } else {
        console.log('\n⚠️  清理任务完成，但存在一些问题需要手动处理。');
      }
    })
    .catch(console.error);
}

export { runCleanup, validateCleanup };
