// 批量为 API Route Handlers 添加 dynamic 配置
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function getAllRouteFiles(dir) {
  const files = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllRouteFiles(fullPath));
    } else if (item === 'route.ts') {
      files.push(fullPath);
    }
  }

  return files;
}

function addDynamicConfig(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');

    // 检查是否已经有 dynamic 配置
    if (content.includes('export const dynamic')) {
      return { status: 'skipped', reason: '已有配置' };
    }

    // 找到最后一个 import 语句的位置
    const lines = content.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex === -1) {
      // 如果没有 import 语句，在文件开头添加
      const newContent = `export const dynamic = 'force-dynamic';\n\n${content}`;
      writeFileSync(filePath, newContent, 'utf-8');
      return { status: 'modified', reason: '在文件开头添加' };
    }

    // 在最后一个 import 语句后添加
    lines.splice(lastImportIndex + 1, 0, '', `export const dynamic = 'force-dynamic';`);
    const newContent = lines.join('\n');
    writeFileSync(filePath, newContent, 'utf-8');

    return { status: 'modified', reason: '在 import 后添加' };
  } catch (error) {
    return { status: 'error', reason: error.message };
  }
}

// 主函数
const apiDir = 'app/api';
const files = getAllRouteFiles(apiDir);

let modified = 0;
let skipped = 0;
let errors = 0;

console.log(`找到 ${files.length} 个 route.ts 文件\n`);

for (const file of files) {
  const result = addDynamicConfig(file);
  const relativePath = file.replace(/\\/g, '/').replace('app/api/', '');

  if (result.status === 'modified') {
    console.log(`✅ 已修改: ${relativePath}`);
    modified++;
  } else if (result.status === 'skipped') {
    console.log(`⏭️  已跳过: ${relativePath} (${result.reason})`);
    skipped++;
  } else {
    console.log(`❌ 错误: ${relativePath} (${result.reason})`);
    errors++;
  }
}

console.log(`\n总结:`);
console.log(`  已修改: ${modified}`);
console.log(`  已跳过: ${skipped}`);
console.log(`  错误: ${errors}`);
console.log(`  总计: ${files.length}`);

