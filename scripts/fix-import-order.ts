#!/usr/bin/env tsx

/**
 * 批量修复导入顺序问题
 * 严格遵循全栈项目统一约定规范
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface ImportGroup {
  react: string[];
  thirdParty: string[];
  nextjs: string[];
  absolute: string[];
  relative: string[];
  types: string[];
}

function parseImports(content: string): ImportGroup {
  const lines = content.split('\n');
  const imports: ImportGroup = {
    react: [],
    thirdParty: [],
    nextjs: [],
    absolute: [],
    relative: [],
    types: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('import ')) continue;

    // React相关导入（包括类型导入）
    if (trimmed.includes("from 'react'") || trimmed.includes('from "react"')) {
      imports.react.push(line);
    }
    // Next.js相关导入
    else if (
      trimmed.includes("from 'next/") ||
      trimmed.includes('from "next/')
    ) {
      imports.nextjs.push(line);
    }
    // 绝对路径导入（@/开头）
    else if (trimmed.includes("from '@/") || trimmed.includes('from "@/')) {
      imports.absolute.push(line);
    }
    // 相对路径导入
    else if (
      trimmed.includes("from './") ||
      trimmed.includes('from "../') ||
      trimmed.includes('from "./') ||
      trimmed.includes('from "../')
    ) {
      imports.relative.push(line);
    }
    // 独立的类型导入（不属于上述分类的）
    else if (trimmed.startsWith('import type ')) {
      // 根据来源进一步分类类型导入
      if (trimmed.includes("from '@/") || trimmed.includes('from "@/')) {
        imports.absolute.push(line);
      } else if (
        trimmed.includes("from './") ||
        trimmed.includes('from "../')
      ) {
        imports.relative.push(line);
      } else {
        imports.thirdParty.push(line);
      }
    }
    // 第三方库导入
    else {
      imports.thirdParty.push(line);
    }
  }

  return imports;
}

function organizeImports(imports: ImportGroup): string {
  const organized: string[] = [];
  const groups: string[][] = [];

  // 1. React相关
  if (imports.react.length > 0) {
    groups.push(imports.react);
  }

  // 2. 第三方库
  if (imports.thirdParty.length > 0) {
    groups.push(imports.thirdParty);
  }

  // 3. Next.js相关
  if (imports.nextjs.length > 0) {
    groups.push(imports.nextjs);
  }

  // 4. 绝对路径导入
  if (imports.absolute.length > 0) {
    groups.push(imports.absolute);
  }

  // 5. 相对路径导入
  if (imports.relative.length > 0) {
    groups.push(imports.relative);
  }

  // 组装导入，组间用空行分隔，组内不加空行
  for (let i = 0; i < groups.length; i++) {
    organized.push(...groups[i]);
    // 只在非最后一组后添加空行
    if (i < groups.length - 1) {
      organized.push('');
    }
  }

  return organized.join('\n');
}

function fixImportOrder(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // 找到导入部分的结束位置
    let importEndIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ')) {
        continue;
      }
      if (line === '' && i > 0 && lines[i - 1].trim().startsWith('import ')) {
        importEndIndex = i;
        break;
      }
      if (
        line !== '' &&
        !line.startsWith('import ') &&
        !line.startsWith('//') &&
        !line.startsWith('/*')
      ) {
        importEndIndex = i;
        break;
      }
    }

    if (importEndIndex === -1) return false;

    const importSection = lines.slice(0, importEndIndex).join('\n');
    const restOfFile = lines.slice(importEndIndex).join('\n');

    const imports = parseImports(importSection);
    const organizedImports = organizeImports(imports);

    const newContent = organizedImports + restOfFile;

    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ 修复导入顺序: ${filePath}`);
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
      } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

function main() {
  console.log('🔧 开始修复导入顺序问题...');

  const projectRoot = process.cwd();
  const files = findTsxFiles(projectRoot);

  let fixedCount = 0;

  for (const file of files) {
    if (fixImportOrder(file)) {
      fixedCount++;
    }
  }

  console.log(`\n✨ 修复完成！共处理 ${fixedCount} 个文件`);

  // 运行ESLint自动修复
  try {
    console.log('\n🔧 运行ESLint自动修复...');
    execSync('npm run lint:fix', { stdio: 'inherit' });
  } catch (error) {
    console.error('ESLint自动修复失败:', error);
  }
}

if (require.main === module) {
  main();
}
