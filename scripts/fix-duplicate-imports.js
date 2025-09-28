const fs = require('fs');
const path = require('path');

const glob = require('glob');

/**
 * 修复重复导入问题的脚本
 */
function fixDuplicateImports() {
  // 查找所有API路由文件
  const files = glob.sync('app/api/**/route.ts', { cwd: process.cwd() });

  console.log(`找到 ${files.length} 个API路由文件`);

  let fixedCount = 0;

  files.forEach(filePath => {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      const content = fs.readFileSync(fullPath, 'utf8');

      // 检查是否有重复的next/server导入
      const lines = content.split('\n');
      let hasTypeImport = false;
      let hasNamedImport = false;
      let typeImportLine = -1;
      let namedImportLine = -1;

      lines.forEach((line, index) => {
        if (
          line.includes('import type { NextRequest }') &&
          line.includes("from 'next/server'")
        ) {
          hasTypeImport = true;
          typeImportLine = index;
        }
        if (
          line.includes('import { NextResponse }') &&
          line.includes("from 'next/server'")
        ) {
          hasNamedImport = true;
          namedImportLine = index;
        }
      });

      // 如果有重复导入，进行修复
      if (hasTypeImport && hasNamedImport) {
        console.log(`修复文件: ${filePath}`);

        // 合并导入语句
        const typeImport = lines[typeImportLine];
        const namedImport = lines[namedImportLine];

        // 提取导入的内容
        const typeMatch = typeImport.match(/import type \{ ([^}]+) \}/);
        const namedMatch = namedImport.match(/import \{ ([^}]+) \}/);

        if (typeMatch && namedMatch) {
          const typeImports = typeMatch[1].trim();
          const namedImports = namedMatch[1].trim();

          // 创建合并的导入语句
          const mergedImport = `import { ${namedImports}, type ${typeImports} } from 'next/server';`;

          // 替换第一个导入，删除第二个
          if (typeImportLine < namedImportLine) {
            lines[typeImportLine] = mergedImport;
            lines.splice(namedImportLine, 1);
          } else {
            lines[namedImportLine] = mergedImport;
            lines.splice(typeImportLine, 1);
          }

          // 写回文件
          const newContent = lines.join('\n');
          fs.writeFileSync(fullPath, newContent, 'utf8');
          fixedCount++;
        }
      }
    } catch (error) {
      console.error(`处理文件 ${filePath} 时出错:`, error.message);
    }
  });

  console.log(`\n修复完成！共修复了 ${fixedCount} 个文件的重复导入问题。`);
}

// 运行修复
fixDuplicateImports();
