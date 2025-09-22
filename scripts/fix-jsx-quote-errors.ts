#!/usr/bin/env tsx

/**
 * 修复JSX引号修复脚本引入的错误
 * 恢复被错误修改的className和其他属性
 */

import fs from 'fs';
import path from 'path';

function fixJsxQuoteErrors(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    let newContent = content;

    // 修复被错误修改的className属性
    newContent = newContent.replace(
      /className="([^"]*?)&quot;([^"]*?)"/g,
      (match, before, after) => {
        modified = true;
        return `className="${before}"${after}"`;
      }
    );

    // 修复被错误修改的其他属性
    newContent = newContent.replace(
      /(\w+)="([^"]*?)&quot;([^"]*?)"/g,
      (match, attr, before, after) => {
        // 跳过已经正确的HTML实体
        if (before.includes('&') || after.includes('&')) {
          return match;
        }
        modified = true;
        return `${attr}="${before}"${after}"`;
      }
    );

    // 修复字符串模板中的错误转义
    newContent = newContent.replace(
      /`([^`]*?)&quot;([^`]*?)`/g,
      (match, before, after) => {
        // 只修复明显错误的情况
        if (
          !before.includes('title') &&
          !before.includes('aria-') &&
          !before.includes('alt')
        ) {
          modified = true;
          return `\`${before}"${after}\``;
        }
        return match;
      }
    );

    // 修复JSX表达式中的错误转义
    newContent = newContent.replace(
      /\{`([^`]*?)&quot;([^`]*?)`\}/g,
      (match, before, after) => {
        // 只修复明显错误的情况
        if (
          !before.includes('title') &&
          !before.includes('aria-') &&
          !before.includes('alt')
        ) {
          modified = true;
          return `{\`${before}"${after}\`}`;
        }
        return match;
      }
    );

    // 修复简单的JSX文本中的错误转义（保留正确的HTML实体）
    newContent = newContent.replace(
      />\s*([^<]*?)&quot;([^<]*?)\s*</g,
      (match, before, after) => {
        // 如果是在文本内容中，且不是HTML实体的一部分，则恢复
        if (
          !before.includes('&') &&
          !after.includes(';') &&
          !before.includes('{') &&
          !after.includes('}')
        ) {
          modified = true;
          return `> ${before}"${after} <`;
        }
        return match;
      }
    );

    if (modified) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ 修复JSX引号错误: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}:`, error);
    return false;
  }
}

function findTsxFiles(dir: string): string[] {
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
      } else if (entry.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function main() {
  console.log('🔧 开始修复JSX引号错误...');

  const projectRoot = process.cwd();
  const files = findTsxFiles(projectRoot);

  let fixedCount = 0;

  for (const file of files) {
    if (fixJsxQuoteErrors(file)) {
      fixedCount++;
    }
  }

  console.log(`\n✨ 修复完成！共处理 ${fixedCount} 个文件`);
}

if (require.main === module) {
  main();
}
