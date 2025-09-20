#!/usr/bin/env tsx

/**
 * 批量修复解析错误问题
 * 主要修复缺少注释开始标记的文件
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function fixParsingError(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // 检查第一行是否以 " *" 开头但缺少 "/**"
    if (lines[0] && lines[0].trim().startsWith('* ')) {
      // 在第一行前添加 "/**"
      lines[0] = '/**\n' + lines[0];

      const newContent = lines.join('\n');
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ 修复解析错误: ${filePath}`);
      return true;
    }

    // 检查是否以 " * " 开头（没有开始的斜杠）
    if (lines[0] && lines[0].trim().match(/^\* .+/)) {
      lines[0] = '/**\n ' + lines[0];

      const newContent = lines.join('\n');
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ 修复解析错误: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}:`, error);
    return false;
  }
}

function findFilesWithParsingErrors(): string[] {
  try {
    // 运行ESLint获取解析错误的文件
    const output = execSync('npm run lint 2>&1', { encoding: 'utf-8' });
    const lines = output.split('\n');

    const errorFiles: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('Parsing error: Expression expected')) {
        // 查找前面的文件路径
        for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j];
          if (prevLine.startsWith('./')) {
            const filePath = prevLine.trim();
            errorFiles.push(filePath.replace('./', ''));
            break;
          }
        }
      }
    }

    return [...new Set(errorFiles)]; // 去重
  } catch (error) {
    console.error('获取解析错误文件失败:', error);
    return [];
  }
}

function main() {
  console.log('🔧 开始修复解析错误问题...');

  const errorFiles = findFilesWithParsingErrors();
  console.log(`发现 ${errorFiles.length} 个有解析错误的文件`);

  let fixedCount = 0;

  for (const file of errorFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      if (fixParsingError(fullPath)) {
        fixedCount++;
      }
    } else {
      console.log(`⚠️ 文件不存在: ${file}`);
    }
  }

  console.log(`\n✨ 修复完成！共处理 ${fixedCount} 个文件`);

  // 再次运行ESLint检查
  try {
    console.log('\n🔧 验证修复效果...');
    const output = execSync('npm run lint 2>&1', { encoding: 'utf-8' });
    const remainingErrors = (
      output.match(/Parsing error: Expression expected/g) || []
    ).length;
    console.log(`剩余解析错误: ${remainingErrors} 个`);
  } catch (error) {
    console.log('验证过程中出现错误，但修复可能已生效');
  }
}

if (require.main === module) {
  main();
}
