#!/usr/bin/env tsx

/**
 * 通用any类型修复脚本
 * 查找并修复常见的any类型使用
 */

import fs from 'fs';
import path from 'path';

function fixAnyTypes(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    let newContent = content;
    
    // 修复函数参数中的any类型
    newContent = newContent.replace(/\(([^)]*?): any\)/g, (match, param) => {
      modified = true;
      return `(${param}: unknown)`;
    });
    
    // 修复变量声明中的any类型
    newContent = newContent.replace(/: any(\s*[=;])/g, (match, suffix) => {
      modified = true;
      return `: unknown${suffix}`;
    });
    
    // 修复数组类型中的any
    newContent = newContent.replace(/: any\[\]/g, ': unknown[]');
    
    // 修复对象类型中的any
    newContent = newContent.replace(/: any\s*\}/g, ': unknown }');
    
    // 修复泛型中的any
    newContent = newContent.replace(/<any>/g, '<unknown>');
    
    // 修复Record类型中的any
    newContent = newContent.replace(/Record<string, any>/g, 'Record<string, unknown>');
    
    // 修复特定的API响应类型
    newContent = newContent.replace(/data: any/g, 'data: unknown');
    newContent = newContent.replace(/response: any/g, 'response: unknown');
    newContent = newContent.replace(/result: any/g, 'result: unknown');
    
    if (modified) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ 修复any类型: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}:`, error);
    return false;
  }
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
  console.log('🔧 开始修复any类型问题...');
  
  const projectRoot = process.cwd();
  const files = findTsFiles(projectRoot);
  
  let fixedCount = 0;
  
  for (const file of files) {
    if (fixAnyTypes(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✨ 修复完成！共处理 ${fixedCount} 个文件`);
}

if (require.main === module) {
  main();
}
