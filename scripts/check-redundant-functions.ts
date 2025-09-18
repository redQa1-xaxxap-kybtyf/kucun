#!/usr/bin/env tsx
/* eslint-disable no-console */

/**
 * 检查项目中的冗余函数
 * 识别重复定义的工具函数、验证函数等
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

interface FunctionDefinition {
  name: string;
  filePath: string;
  lineNumber: number;
  content: string;
  type: 'function' | 'arrow' | 'method';
}

interface RedundantFunction {
  name: string;
  definitions: FunctionDefinition[];
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

/**
 * 获取所有TypeScript文件
 */
function getAllTSFiles(): string[] {
  try {
    const output = execSync(
      'find app components lib -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v .next',
      { encoding: 'utf8', cwd: process.cwd() }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('获取文件列表失败:', error);
    return [];
  }
}

/**
 * 解析文件中的函数定义
 */
function parseFunctions(filePath: string): FunctionDefinition[] {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const functions: FunctionDefinition[] = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // 匹配函数声明
      const functionMatch = trimmedLine.match(/^export\s+(function|const|let)\s+(\w+)/);
      if (functionMatch) {
        functions.push({
          name: functionMatch[2],
          filePath,
          lineNumber: index + 1,
          content: trimmedLine,
          type: functionMatch[1] === 'function' ? 'function' : 'arrow',
        });
      }

      // 匹配箭头函数
      const arrowMatch = trimmedLine.match(/^export\s+const\s+(\w+)\s*=\s*\(/);
      if (arrowMatch) {
        functions.push({
          name: arrowMatch[1],
          filePath,
          lineNumber: index + 1,
          content: trimmedLine,
          type: 'arrow',
        });
      }

      // 匹配对象方法
      const methodMatch = trimmedLine.match(/(\w+):\s*\([^)]*\)\s*=>/);
      if (methodMatch) {
        functions.push({
          name: methodMatch[1],
          filePath,
          lineNumber: index + 1,
          content: trimmedLine,
          type: 'method',
        });
      }
    });

    return functions;
  } catch (error) {
    console.error(`解析文件失败 ${filePath}:`, error);
    return [];
  }
}

/**
 * 检查已知的冗余函数
 */
function checkKnownRedundantFunctions(allFunctions: FunctionDefinition[]): RedundantFunction[] {
  const knownRedundant = [
    'formatCurrency',
    'formatDate', 
    'formatDateTime',
    'validateProductionDate',
    'validateColorCode',
    'formatTimeAgo',
    'calculateGrowth',
    'formatNumber',
    'formatPercentage',
    'validatePaymentAmount',
  ];

  const redundantFunctions: RedundantFunction[] = [];

  knownRedundant.forEach(funcName => {
    const definitions = allFunctions.filter(func => func.name === funcName);
    
    if (definitions.length > 1) {
      let severity: 'high' | 'medium' | 'low' = 'medium';
      let recommendation = '';

      // 根据函数类型确定严重程度和建议
      if (funcName.startsWith('format')) {
        severity = 'high';
        recommendation = `将 ${funcName} 统一到 lib/utils.ts 中，其他地方导入使用`;
      } else if (funcName.startsWith('validate')) {
        severity = 'high';
        recommendation = `将 ${funcName} 统一到对应的验证文件中，避免重复定义`;
      } else if (funcName.startsWith('calculate')) {
        severity = 'medium';
        recommendation = `检查 ${funcName} 的实现是否相同，考虑统一到工具函数中`;
      } else {
        severity = 'low';
        recommendation = `检查 ${funcName} 是否可以合并或重构`;
      }

      redundantFunctions.push({
        name: funcName,
        definitions,
        severity,
        recommendation,
      });
    }
  });

  return redundantFunctions;
}

/**
 * 生成报告
 */
function generateReport(redundantFunctions: RedundantFunction[]): void {
  console.log('🔍 项目冗余函数检查报告');
  console.log('='.repeat(80));
  
  if (redundantFunctions.length === 0) {
    console.log('✅ 未发现已知的冗余函数');
    return;
  }

  // 按严重程度分组
  const grouped = redundantFunctions.reduce((acc, func) => {
    if (!acc[func.severity]) acc[func.severity] = [];
    acc[func.severity].push(func);
    return acc;
  }, {} as Record<string, RedundantFunction[]>);

  // 显示高优先级问题
  if (grouped.high) {
    console.log('\n🚨 高优先级冗余函数 (需要立即处理):');
    console.log('-'.repeat(50));
    grouped.high.forEach(func => {
      console.log(`\n📍 函数: ${func.name} (${func.definitions.length} 个定义)`);
      func.definitions.forEach(def => {
        console.log(`   - ${def.filePath}:${def.lineNumber}`);
        console.log(`     ${def.content}`);
      });
      console.log(`   💡 建议: ${func.recommendation}`);
    });
  }

  // 显示中优先级问题
  if (grouped.medium) {
    console.log('\n⚠️  中优先级冗余函数:');
    console.log('-'.repeat(50));
    grouped.medium.forEach(func => {
      console.log(`\n📍 函数: ${func.name} (${func.definitions.length} 个定义)`);
      func.definitions.forEach(def => {
        console.log(`   - ${def.filePath}:${def.lineNumber}`);
      });
      console.log(`   💡 建议: ${func.recommendation}`);
    });
  }

  // 显示低优先级问题
  if (grouped.low) {
    console.log('\n📝 低优先级冗余函数:');
    console.log('-'.repeat(50));
    grouped.low.forEach(func => {
      console.log(`\n📍 函数: ${func.name} (${func.definitions.length} 个定义)`);
      func.definitions.forEach(def => {
        console.log(`   - ${def.filePath}:${def.lineNumber}`);
      });
      console.log(`   💡 建议: ${func.recommendation}`);
    });
  }

  // 总结
  console.log('\n📊 总结:');
  console.log(`   总冗余函数数: ${redundantFunctions.length}`);
  console.log(`   高优先级: ${grouped.high?.length || 0}`);
  console.log(`   中优先级: ${grouped.medium?.length || 0}`);
  console.log(`   低优先级: ${grouped.low?.length || 0}`);
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始检查项目中的冗余函数...\n');

  const files = getAllTSFiles();
  console.log(`📁 扫描 ${files.length} 个文件...\n`);

  // 解析所有函数
  const allFunctions: FunctionDefinition[] = [];
  files.forEach(file => {
    const functions = parseFunctions(file);
    allFunctions.push(...functions);
  });

  console.log(`🔍 发现 ${allFunctions.length} 个函数定义\n`);

  // 检查冗余函数
  const redundantFunctions = checkKnownRedundantFunctions(allFunctions);

  // 生成报告
  generateReport(redundantFunctions);

  console.log('\n✅ 检查完成！');
}

main().catch(console.error);
