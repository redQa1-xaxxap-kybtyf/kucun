#!/usr/bin/env tsx

/**
 * 修复缺失的导入问题
 * 恢复被错误移除的必需导入
 */

import fs from 'fs';
import path from 'path';

interface ImportFix {
  file: string;
  missingImports: string[];
  importSource: string;
}

const importFixes: ImportFix[] = [
  {
    file: 'app/(dashboard)/inventory/adjust/page.tsx',
    missingImports: ['TrendingUp', 'TrendingDown', 'Badge'],
    importSource: 'lucide-react',
  },
  {
    file: 'app/(dashboard)/payments/page.tsx',
    missingImports: ['Badge', 'CreditCard'],
    importSource: 'lucide-react',
  },
  {
    file: 'app/(dashboard)/sales-orders/test/page.tsx',
    missingImports: ['Badge', 'Alert', 'AlertDescription'],
    importSource: '@/components/ui/badge',
  },
  {
    file: 'app/(dashboard)/test-api/page.tsx',
    missingImports: ['Badge', 'AlertCircle'],
    importSource: 'lucide-react',
  },
  {
    file: 'app/auth/error/page.tsx',
    missingImports: ['Alert', 'AlertDescription'],
    importSource: '@/components/ui/alert',
  },
  {
    file: 'app/auth/register/page.tsx',
    missingImports: ['Alert', 'AlertDescription'],
    importSource: '@/components/ui/alert',
  },
  {
    file: 'app/auth/signin/page.tsx',
    missingImports: ['Alert', 'AlertDescription'],
    importSource: '@/components/ui/alert',
  },
  {
    file: 'components/common/Breadcrumb.tsx',
    missingImports: ['ChevronRight'],
    importSource: 'lucide-react',
  },
  {
    file: 'components/common/GlobalSearch.tsx',
    missingImports: ['ScrollArea', 'Badge', 'TrendingUp'],
    importSource: 'lucide-react',
  },
  {
    file: 'components/common/Header.tsx',
    missingImports: ['Badge'],
    importSource: '@/components/ui/badge',
  },
  {
    file: 'components/common/image-upload.tsx',
    missingImports: ['Alert', 'AlertCircle', 'AlertDescription'],
    importSource: '@/components/ui/alert',
  },
  {
    file: 'components/common/MobileNav.tsx',
    missingImports: ['ScrollArea', 'Badge'],
    importSource: '@/components/ui/scroll-area',
  },
  {
    file: 'components/common/MobileOptimized.tsx',
    missingImports: ['Badge'],
    importSource: '@/components/ui/badge',
  },
  {
    file: 'components/common/Sidebar.tsx',
    missingImports: ['ChevronRight', 'ScrollArea', 'Badge'],
    importSource: 'lucide-react',
  },
];

function fixMissingImports(fix: ImportFix): boolean {
  try {
    if (!fs.existsSync(fix.file)) {
      console.log(`⚠️  文件不存在: ${fix.file}`);
      return false;
    }

    const content = fs.readFileSync(fix.file, 'utf-8');
    const lines = content.split('\n');

    // 查找现有的导入行
    let importLineIndex = -1;
    let existingImports: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.includes(`from '${fix.importSource}'`) ||
        line.includes(`from "${fix.importSource}"`)
      ) {
        importLineIndex = i;
        // 提取现有的导入
        const match = line.match(/import\s*\{([^}]+)\}/);
        if (match) {
          existingImports = match[1].split(',').map(imp => imp.trim());
        }
        break;
      }
    }

    // 合并导入
    const allImports = [...existingImports, ...fix.missingImports];
    const uniqueImports = [...new Set(allImports)].sort();

    if (importLineIndex >= 0) {
      // 更新现有导入行
      lines[importLineIndex] =
        `import { ${uniqueImports.join(', ')} } from '${fix.importSource}';`;
    } else {
      // 添加新的导入行
      // 找到合适的位置插入导入
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
          insertIndex = i + 1;
        } else if (lines[i].trim() === '' && insertIndex > 0) {
          break;
        }
      }
      lines.splice(
        insertIndex,
        0,
        `import { ${uniqueImports.join(', ')} } from '${fix.importSource}';`
      );
    }

    const newContent = lines.join('\n');
    fs.writeFileSync(fix.file, newContent);
    console.log(
      `✅ 修复缺失导入: ${fix.file} - ${fix.missingImports.join(', ')}`
    );
    return true;
  } catch (error) {
    console.error(`❌ 处理文件失败 ${fix.file}:`, error);
    return false;
  }
}

function main() {
  console.log('🔧 开始修复缺失的导入问题...');

  let fixedCount = 0;

  for (const fix of importFixes) {
    if (fixMissingImports(fix)) {
      fixedCount++;
    }
  }

  console.log(`\n✨ 修复完成！共处理 ${fixedCount} 个文件`);
}

if (require.main === module) {
  main();
}
