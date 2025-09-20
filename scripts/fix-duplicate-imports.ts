#!/usr/bin/env tsx

/**
 * 批量修复重复导入问题
 * 专门处理next/server等常见的重复导入
 */

import fs from 'fs';
import path from 'path';

function fixDuplicateImports(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let modified = false;
    const importMap = new Map<string, string[]>();
    const nonImportLines: string[] = [];
    let inImportSection = true;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('import ') && inImportSection) {
        // 解析导入语句
        const match = trimmed.match(/import\s+(.+?)\s+from\s+['"](.+?)['"]/);
        if (match) {
          const [, imports, module] = match;
          
          if (importMap.has(module)) {
            // 合并导入
            const existingImports = importMap.get(module)!;
            
            // 处理不同类型的导入
            if (imports.includes('type ') && !existingImports.some(imp => imp.includes('type '))) {
              existingImports.push(imports);
            } else if (!imports.includes('type ') && !existingImports.some(imp => !imp.includes('type '))) {
              existingImports.push(imports);
            }
            
            modified = true;
          } else {
            importMap.set(module, [imports]);
          }
        } else {
          // 无法解析的导入语句，直接保留
          nonImportLines.push(line);
        }
      } else {
        if (inImportSection && trimmed !== '') {
          inImportSection = false;
        }
        nonImportLines.push(line);
      }
    }
    
    if (modified) {
      // 重新构建文件内容
      const newLines: string[] = [];
      
      // 添加合并后的导入语句
      for (const [module, importsList] of importMap) {
        if (importsList.length === 1) {
          newLines.push(`import ${importsList[0]} from '${module}';`);
        } else {
          // 合并多个导入
          const typeImports: string[] = [];
          const regularImports: string[] = [];
          
          for (const imp of importsList) {
            if (imp.includes('type ')) {
              typeImports.push(imp);
            } else {
              regularImports.push(imp);
            }
          }
          
          // 合并同类型的导入
          if (regularImports.length > 0 && typeImports.length > 0) {
            // 有类型导入和普通导入，需要合并
            const regularParts = regularImports.join(', ').replace(/[{}]/g, '').split(',').map(s => s.trim());
            const typeParts = typeImports.join(', ').replace(/type\s+/g, '').replace(/[{}]/g, '').split(',').map(s => s.trim());
            
            const allParts = [...regularParts, ...typeParts.map(p => `type ${p}`)];
            newLines.push(`import { ${allParts.join(', ')} } from '${module}';`);
          } else if (regularImports.length > 0) {
            const parts = regularImports.join(', ').replace(/[{}]/g, '').split(',').map(s => s.trim());
            newLines.push(`import { ${parts.join(', ')} } from '${module}';`);
          } else if (typeImports.length > 0) {
            const parts = typeImports.join(', ').replace(/type\s+/g, '').replace(/[{}]/g, '').split(',').map(s => s.trim());
            newLines.push(`import type { ${parts.join(', ')} } from '${module}';`);
          }
        }
      }
      
      // 添加非导入行
      newLines.push(...nonImportLines);
      
      const newContent = newLines.join('\n');
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ 修复重复导入: ${filePath}`);
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
  console.log('🔧 开始修复重复导入问题...');
  
  const projectRoot = process.cwd();
  const files = findTsFiles(projectRoot);
  
  let fixedCount = 0;
  
  for (const file of files) {
    if (fixDuplicateImports(file)) {
      fixedCount++;
    }
  }
  
  console.log(`\n✨ 修复完成！共处理 ${fixedCount} 个文件`);
}

if (require.main === module) {
  main();
}
