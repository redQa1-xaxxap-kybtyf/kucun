#!/usr/bin/env tsx

/**
 * 修复导入组内的空行问题
 * 移除导入组内不应该存在的空行
 */

import fs from 'fs';
import path from 'path';

function fixImportEmptyLines(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let modified = false;
    const newLines: string[] = [];
    let inImportSection = false;
    let currentImportGroup: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 检查是否是导入语句
      if (trimmed.startsWith('import ')) {
        if (!inImportSection) {
          inImportSection = true;
        }
        currentImportGroup.push(line);
      }
      // 检查是否是空行
      else if (trimmed === '' && inImportSection) {
        // 检查下一行是否还是导入语句
        let nextImportIndex = -1;
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine === '') continue;
          if (nextLine.startsWith('import ')) {
            nextImportIndex = j;
            break;
          } else {
            break;
          }
        }

        if (nextImportIndex > -1) {
          // 下一个非空行是导入语句，检查是否是不同的导入组
          const nextImport = lines[nextImportIndex];
          const currentLastImport =
            currentImportGroup[currentImportGroup.length - 1];

          if (shouldKeepEmptyLine(currentLastImport, nextImport)) {
            // 保留空行，结束当前导入组
            newLines.push(...currentImportGroup);
            newLines.push(line);
            currentImportGroup = [];
          } else {
            // 移除空行，继续当前导入组
            modified = true;
            // 不添加空行，继续处理
          }
        } else {
          // 下一个非空行不是导入语句，结束导入部分
          newLines.push(...currentImportGroup);
          newLines.push(line);
          inImportSection = false;
          currentImportGroup = [];
        }
      }
      // 其他行
      else {
        if (inImportSection) {
          // 结束导入部分
          newLines.push(...currentImportGroup);
          inImportSection = false;
          currentImportGroup = [];
        }
        newLines.push(line);
      }
    }

    // 处理剩余的导入组
    if (currentImportGroup.length > 0) {
      newLines.push(...currentImportGroup);
    }

    if (modified) {
      const newContent = newLines.join('\n');
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ 修复导入空行: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}:`, error);
    return false;
  }
}

function shouldKeepEmptyLine(
  currentImport: string,
  nextImport: string
): boolean {
  // 判断是否应该在两个导入之间保留空行
  const currentFrom = extractFromClause(currentImport);
  const nextFrom = extractFromClause(nextImport);

  // React相关
  const isCurrentReact = currentFrom.includes('react');
  const isNextReact = nextFrom.includes('react');

  // 第三方库
  const isCurrentThirdParty =
    !currentFrom.includes('@/') &&
    !currentFrom.includes('./') &&
    !currentFrom.includes('../') &&
    !currentFrom.includes('next/');
  const isNextThirdParty =
    !nextFrom.includes('@/') &&
    !nextFrom.includes('./') &&
    !nextFrom.includes('../') &&
    !nextFrom.includes('next/');

  // Next.js相关
  const isCurrentNext = currentFrom.includes('next/');
  const isNextNext = nextFrom.includes('next/');

  // 绝对路径
  const isCurrentAbsolute = currentFrom.includes('@/');
  const isNextAbsolute = nextFrom.includes('@/');

  // 相对路径
  const isCurrentRelative =
    currentFrom.includes('./') || currentFrom.includes('../');
  const isNextRelative = nextFrom.includes('./') || nextFrom.includes('../');

  // 如果是不同的导入组，保留空行
  if (isCurrentReact && !isNextReact) return true;
  if (isCurrentThirdParty && !isNextThirdParty) return true;
  if (isCurrentNext && !isNextNext) return true;
  if (isCurrentAbsolute && !isNextAbsolute) return true;
  if (isCurrentRelative && !isNextRelative) return true;

  return false;
}

function extractFromClause(importLine: string): string {
  const match = importLine.match(/from\s+['"]([^'"]+)['"]/);
  return match ? match[1] : '';
}

function findTsFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!entry.startsWith('.') && entry !== 'node_modules') {
          traverse(fullPath);
        }
      } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function main() {
  console.log('🔧 开始修复导入组内空行问题...');

  const projectRoot = process.cwd();
  const files = findTsFiles(projectRoot);

  let fixedCount = 0;

  for (const file of files) {
    if (fixImportEmptyLines(file)) {
      fixedCount++;
    }
  }

  console.log(`\n✨ 修复完成！共处理 ${fixedCount} 个文件`);
}

if (require.main === module) {
  main();
}
