#!/usr/bin/env tsx

/**
 * 修复JSX中的引号转义问题
 * 将JSX中的直接引号替换为HTML实体或使用单引号包裹
 */

import fs from 'fs';
import path from 'path';

function fixJsxQuotes(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    let newContent = content;
    
    // 修复JSX中的引号问题
    // 1. 修复JSX文本中的双引号
    newContent = newContent.replace(
      />(.*?)"(.*?)</g,
      (match, before, after) => {
        if (before.includes('<') || after.includes('>')) {
          return match; // 跳过复杂的JSX结构
        }
        modified = true;
        return `>${before}&quot;${after}<`;
      }
    );
    
    // 2. 修复JSX属性中的引号问题
    newContent = newContent.replace(
      /(\w+)=\{`([^`]*)"([^`]*)`\}/g,
      (match, attr, before, after) => {
        modified = true;
        return `${attr}={\`${before}&quot;${after}\`}`;
      }
    );
    
    // 3. 修复字符串模板中的引号
    newContent = newContent.replace(
      /`([^`]*)"([^`]*)`/g,
      (match, before, after) => {
        // 只在JSX上下文中修复
        if (match.includes('className') || match.includes('title') || match.includes('aria-')) {
          modified = true;
          return `\`${before}&quot;${after}\``;
        }
        return match;
      }
    );
    
    // 4. 修复简单的JSX文本中的引号
    newContent = newContent.replace(
      />\s*([^<]*)"([^<]*)\s*</g,
      (match, before, after) => {
        // 确保这是简单的文本内容
        if (!before.includes('{') && !after.includes('}') && 
            !before.includes('<') && !after.includes('>')) {
          modified = true;
          return `> ${before}&quot;${after} <`;
        }
        return match;
      }
    );
    
    if (modified) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ 修复JSX引号: ${filePath}`);
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
  console.log('🔧 开始修复JSX引号转义问题...');
  
  const projectRoot = process.cwd();
  const files = findTsxFiles(projectRoot);
  
  let fixedCount = 0;
  
  for (const file of files) {
    if (fixJsxQuotes(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✨ 修复完成！共处理 ${fixedCount} 个文件`);
}

if (require.main === module) {
  main();
}
