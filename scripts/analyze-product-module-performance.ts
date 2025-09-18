#!/usr/bin/env tsx

/**
 * 产品管理模块性能分析脚本
 * 分析代码质量、性能瓶颈和优化建议
 */

import { existsSync, readFileSync } from 'fs';
import { glob } from 'glob';
import { join } from 'path';

interface AnalysisResult {
  file: string;
  issues: Issue[];
  score: number;
  suggestions: string[];
}

interface Issue {
  type: 'performance' | 'quality' | 'security' | 'maintainability';
  severity: 'high' | 'medium' | 'low';
  line: number;
  message: string;
  code?: string;
}

/**
 * 分析单个文件
 */
function analyzeFile(filePath: string): AnalysisResult {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues: Issue[] = [];
  const suggestions: string[] = [];

  // 检查性能问题
  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // 检查缺少React.memo
    if (
      line.includes('export default function') &&
      !content.includes('React.memo')
    ) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        line: lineNumber,
        message: '组件未使用React.memo优化，可能导致不必要的重渲染',
        code: line.trim(),
      });
    }

    // 检查缺少useMemo（仅在React组件文件中）
    if (
      line.includes('const ') &&
      line.includes('= [') &&
      !line.includes('useMemo') &&
      (filePath.includes('page.tsx') || filePath.includes('component'))
    ) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        line: lineNumber,
        message: '数组/对象字面量未使用useMemo缓存，每次渲染都会重新创建',
        code: line.trim(),
      });
    }

    // 检查缺少useCallback
    if (
      line.includes('const handle') &&
      line.includes('=>') &&
      !line.includes('useCallback')
    ) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        line: lineNumber,
        message: '事件处理函数未使用useCallback缓存，可能导致子组件重渲染',
        code: line.trim(),
      });
    }

    // 检查fetch缺少credentials
    if (line.includes('fetch(') && !content.includes('credentials:')) {
      issues.push({
        type: 'security',
        severity: 'high',
        line: lineNumber,
        message: 'fetch请求缺少credentials配置，可能导致身份验证失败',
        code: line.trim(),
      });
    }

    // 检查any类型使用
    if (line.includes(': any') || line.includes('<any>')) {
      issues.push({
        type: 'quality',
        severity: 'medium',
        line: lineNumber,
        message: '使用了any类型，降低了类型安全性',
        code: line.trim(),
      });
    }

    // 检查console.log
    if (line.includes('console.log')) {
      issues.push({
        type: 'quality',
        severity: 'low',
        line: lineNumber,
        message: '包含调试代码，应该在生产环境中移除',
        code: line.trim(),
      });
    }

    // 检查重复的数字处理逻辑
    if (
      line.includes('!isNaN(Number(value))') &&
      content.match(/!isNaN\(Number\(value\)\)/g)?.length > 1
    ) {
      issues.push({
        type: 'maintainability',
        severity: 'medium',
        line: lineNumber,
        message: '重复的数字验证逻辑，建议提取为通用hook',
        code: line.trim(),
      });
    }
  });

  // 生成建议
  if (filePath.includes('page.tsx')) {
    suggestions.push('考虑使用React.memo包装组件以优化性能');
    suggestions.push('使用useMemo缓存计算结果和配置对象');
    suggestions.push('使用useCallback缓存事件处理函数');
  }

  if (filePath.includes('api/')) {
    suggestions.push('添加请求速率限制');
    suggestions.push('优化数据库查询，添加适当的索引');
    suggestions.push('考虑添加响应缓存');
  }

  if (filePath.includes('lib/api/')) {
    suggestions.push('统一API配置，包括credentials和headers');
    suggestions.push('添加请求重试机制');
    suggestions.push('改进错误处理和用户友好的错误消息');
  }

  // 计算分数 (100分制)
  let score = 100;
  issues.forEach(issue => {
    switch (issue.severity) {
      case 'high':
        score -= 15;
        break;
      case 'medium':
        score -= 8;
        break;
      case 'low':
        score -= 3;
        break;
    }
  });

  return {
    file: filePath,
    issues,
    score: Math.max(0, score),
    suggestions,
  };
}

/**
 * 分析整个产品模块
 */
async function analyzeProductModule(): Promise<void> {
  console.log('🔍 产品管理模块性能分析\n');

  // 定义要分析的文件模式
  const filePatterns = [
    'app/(dashboard)/products/**/*.tsx',
    'app/api/products/**/*.ts',
    'lib/api/products.ts',
    'lib/types/product.ts',
    'lib/schemas/product.ts',
    'lib/validations/product.ts',
  ];

  const allResults: AnalysisResult[] = [];

  // 分析每个文件模式
  for (const pattern of filePatterns) {
    try {
      const files = await glob(pattern, { cwd: process.cwd() });

      for (const file of files) {
        const fullPath = join(process.cwd(), file);
        if (existsSync(fullPath)) {
          const result = analyzeFile(fullPath);
          allResults.push(result);
        }
      }
    } catch (error) {
      console.warn(`⚠️  无法分析模式 ${pattern}:`, error);
    }
  }

  // 生成报告
  generateReport(allResults);
}

/**
 * 生成分析报告
 */
function generateReport(results: AnalysisResult[]): void {
  console.log('📊 分析结果汇总\n');
  console.log('='.repeat(80));

  // 总体统计
  const totalFiles = results.length;
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const averageScore =
    results.reduce((sum, r) => sum + r.score, 0) / totalFiles;

  console.log(`📁 分析文件数: ${totalFiles}`);
  console.log(`🐛 发现问题数: ${totalIssues}`);
  console.log(`📈 平均分数: ${averageScore.toFixed(1)}/100`);
  console.log();

  // 按严重程度统计
  const severityStats = {
    high: 0,
    medium: 0,
    low: 0,
  };

  const typeStats = {
    performance: 0,
    quality: 0,
    security: 0,
    maintainability: 0,
  };

  results.forEach(result => {
    result.issues.forEach(issue => {
      severityStats[issue.severity]++;
      typeStats[issue.type]++;
    });
  });

  console.log('🚨 问题严重程度分布:');
  console.log(`   🔴 高危: ${severityStats.high}`);
  console.log(`   🟡 中等: ${severityStats.medium}`);
  console.log(`   🟢 低危: ${severityStats.low}`);
  console.log();

  console.log('📋 问题类型分布:');
  console.log(`   ⚡ 性能问题: ${typeStats.performance}`);
  console.log(`   🔧 质量问题: ${typeStats.quality}`);
  console.log(`   🛡️  安全问题: ${typeStats.security}`);
  console.log(`   🔄 可维护性: ${typeStats.maintainability}`);
  console.log();

  // 详细文件分析
  console.log('📄 详细文件分析:\n');

  results
    .sort((a, b) => a.score - b.score) // 按分数排序，最低分在前
    .forEach((result, index) => {
      const fileName = result.file
        .replace(process.cwd(), '')
        .replace(/\\/g, '/');
      const scoreColor =
        result.score >= 90 ? '🟢' : result.score >= 70 ? '🟡' : '🔴';

      console.log(
        `${index + 1}. ${scoreColor} ${fileName} (${result.score}/100)`
      );

      if (result.issues.length > 0) {
        console.log('   问题列表:');
        result.issues.forEach(issue => {
          const severityIcon =
            issue.severity === 'high'
              ? '🔴'
              : issue.severity === 'medium'
                ? '🟡'
                : '🟢';
          console.log(`   ${severityIcon} 第${issue.line}行: ${issue.message}`);
          if (issue.code) {
            console.log(`      代码: ${issue.code}`);
          }
        });
      }

      if (result.suggestions.length > 0) {
        console.log('   优化建议:');
        result.suggestions.forEach(suggestion => {
          console.log(`   💡 ${suggestion}`);
        });
      }

      console.log();
    });

  // 总体建议
  console.log('🎯 总体优化建议:\n');

  if (severityStats.high > 0) {
    console.log('🔴 高优先级修复:');
    console.log('   • 立即修复所有高危安全问题');
    console.log('   • 统一API配置，添加credentials');
    console.log('   • 修复类型安全问题');
    console.log();
  }

  if (typeStats.performance > 5) {
    console.log('⚡ 性能优化建议:');
    console.log('   • 为大型组件添加React.memo');
    console.log('   • 使用useMemo缓存计算结果');
    console.log('   • 使用useCallback缓存事件处理函数');
    console.log('   • 考虑代码分割和懒加载');
    console.log();
  }

  if (typeStats.maintainability > 3) {
    console.log('🔄 可维护性改进:');
    console.log('   • 提取重复逻辑为自定义hooks');
    console.log('   • 统一验证规则定义');
    console.log('   • 改进错误处理机制');
    console.log();
  }

  // 评级
  let overallGrade = '';
  if (averageScore >= 90) {
    overallGrade = '🏆 优秀 (A)';
  } else if (averageScore >= 80) {
    overallGrade = '✅ 良好 (B)';
  } else if (averageScore >= 70) {
    overallGrade = '⚠️  一般 (C)';
  } else {
    overallGrade = '❌ 需要改进 (D)';
  }

  console.log('='.repeat(80));
  console.log(`🎖️  总体评级: ${overallGrade}`);
  console.log(`📊 综合得分: ${averageScore.toFixed(1)}/100`);

  if (averageScore < 85) {
    console.log('\n💡 建议按照《产品管理模块修复方案.md》进行优化');
  }

  console.log('\n✨ 分析完成！');
}

/**
 * 主函数
 */
async function main() {
  try {
    await analyzeProductModule();
  } catch (error) {
    console.error('❌ 分析过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行分析
if (require.main === module) {
  main();
}

export { analyzeFile, analyzeProductModule };
