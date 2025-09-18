#!/usr/bin/env tsx
/* eslint-disable no-console */

/**
 * 替换项目中重复的错误消息
 * 使用统一的错误消息常量
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

interface ReplacementRule {
  pattern: RegExp;
  replacement: string;
  importNeeded: boolean;
}

/**
 * 错误消息替换规则
 */
const REPLACEMENT_RULES: ReplacementRule[] = [
  {
    pattern: /'未授权访问'/g,
    replacement: 'API_ERROR_MESSAGES.UNAUTHORIZED',
    importNeeded: true,
  },
  {
    pattern: /'输入数据格式不正确'/g,
    replacement: 'API_ERROR_MESSAGES.INVALID_INPUT',
    importNeeded: true,
  },
  {
    pattern: /'权限不足'/g,
    replacement: 'API_ERROR_MESSAGES.FORBIDDEN',
    importNeeded: true,
  },
  {
    pattern: /'资源不存在'/g,
    replacement: 'API_ERROR_MESSAGES.NOT_FOUND',
    importNeeded: true,
  },
  {
    pattern: /'数据已存在'/g,
    replacement: 'API_ERROR_MESSAGES.ALREADY_EXISTS',
    importNeeded: true,
  },
  {
    pattern: /'操作失败'/g,
    replacement: 'API_ERROR_MESSAGES.OPERATION_FAILED',
    importNeeded: true,
  },
  {
    pattern: /'系统内部错误'/g,
    replacement: 'API_ERROR_MESSAGES.INTERNAL_ERROR',
    importNeeded: true,
  },
  {
    pattern: /'创建成功'/g,
    replacement: 'SUCCESS_MESSAGES.CREATED',
    importNeeded: true,
  },
  {
    pattern: /'更新成功'/g,
    replacement: 'SUCCESS_MESSAGES.UPDATED',
    importNeeded: true,
  },
  {
    pattern: /'删除成功'/g,
    replacement: 'SUCCESS_MESSAGES.DELETED',
    importNeeded: true,
  },
];

/**
 * 获取所有API路由文件
 */
function getApiFiles(): string[] {
  try {
    const output = execSync(
      'find app/api -name "*.ts" | grep -v node_modules',
      { encoding: 'utf8', cwd: process.cwd() }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('获取API文件列表失败:', error);
    return [];
  }
}

/**
 * 检查文件是否需要添加导入
 */
function needsImport(content: string): boolean {
  return !content.includes('API_ERROR_MESSAGES') && !content.includes('SUCCESS_MESSAGES');
}

/**
 * 添加导入语句
 */
function addImport(content: string): string {
  const importStatement = "import { API_ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/lib/constants/error-messages';";

  // 找到最后一个import语句的位置
  const lines = content.split('\n');
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('import{')) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex >= 0) {
    // 在最后一个import后添加
    lines.splice(lastImportIndex + 1, 0, importStatement);
  } else {
    // 在文件开头添加
    lines.unshift(importStatement);
  }

  return lines.join('\n');
}

/**
 * 处理单个文件
 */
function processFile(filePath: string): { updated: boolean; replacements: number } {
  try {
    let content = readFileSync(filePath, 'utf8');
    let replacements = 0;
    let needsImportAdd = false;

    // 应用所有替换规则
    REPLACEMENT_RULES.forEach(rule => {
      const matches = content.match(rule.pattern);
      if (matches) {
        content = content.replace(rule.pattern, rule.replacement);
        replacements += matches.length;
        if (rule.importNeeded) {
          needsImportAdd = true;
        }
      }
    });

    // 如果需要添加导入且文件中还没有
    if (needsImportAdd && needsImport(content)) {
      content = addImport(content);
    }

    // 如果有更改，写回文件
    if (replacements > 0) {
      writeFileSync(filePath, content, 'utf8');
      return { updated: true, replacements };
    }

    return { updated: false, replacements: 0 };
  } catch (error) {
    console.error(`处理文件失败 ${filePath}:`, error);
    return { updated: false, replacements: 0 };
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始替换项目中的重复错误消息...\n');

  const files = getApiFiles();
  console.log(`📁 发现 ${files.length} 个API文件\n`);

  let totalUpdated = 0;
  let totalReplacements = 0;

  files.forEach(filePath => {
    const result = processFile(filePath);
    if (result.updated) {
      console.log(`✅ ${filePath} - ${result.replacements} 个替换`);
      totalUpdated++;
      totalReplacements += result.replacements;
    }
  });

  console.log('\n📊 替换总结:');
  console.log(`   更新文件数: ${totalUpdated}`);
  console.log(`   总替换数: ${totalReplacements}`);

  if (totalUpdated > 0) {
    console.log('\n🎉 错误消息统一化完成！');
    console.log('💡 建议运行 TypeScript 检查确保没有错误');
  } else {
    console.log('\n✅ 没有发现需要替换的错误消息');
  }
}

main().catch(console.error);
