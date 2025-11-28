#!/usr/bin/env tsx

/**
 * 创建生产发布包脚本
 *
 * 用途：
 * - 在开发机上打一个可分发的 tar.gz 包，供宝塔/服务器上传、解压、安装
 *
 * 发布包内容（只包含运行所需文件，不带 node_modules）：
 * - app, components, lib, prisma, public, .next, ecosystem*.config.js
 * - package.json, package-lock.json（如果存在）, .env.production.example（如果存在）
 *
 * 使用方式：
 *   1. 在本机运行： npm run build   （或让本脚本自动执行）
 *   2. 运行：       npx tsx scripts/create-release.ts
 *   3. 在 release/ 目录下会生成 kucun-<version>.tar.gz
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import tar from 'tar';

async function main() {
  const rootDir = process.cwd();

  // 1. 读取版本号
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(await fsp.readFile(pkgPath, 'utf8')) as {
    name: string;
    version: string;
  };
  const version = pkg.version || '0.0.0';

  // 2. 安装生产依赖并构建（可以注释掉这两步，如果你想手动执行）
  console.log('> Installing production dependencies (npm ci --omit=dev)...');
  execSync('npm ci --omit=dev', { stdio: 'inherit' });

  console.log('> Building Next.js app (npm run build)...');
  execSync('npm run build', { stdio: 'inherit' });

  // 3. 准备 release 目录
  const releaseRoot = path.join(rootDir, 'release');
  if (!fs.existsSync(releaseRoot)) {
    await fsp.mkdir(releaseRoot);
  }

  const folderName = `kucun-${version}`;
  const targetDir = path.join(releaseRoot, folderName);

  console.log(`> Preparing release directory: ${targetDir}`);
  await fsp.rm(targetDir, { recursive: true, force: true });
  await fsp.mkdir(targetDir, { recursive: true });

  // 4. 需要复制的文件/目录
  const entriesToCopy = [
    'app',
    'components',
    'lib',
    'prisma',
    'public',
    '.next',
    'ecosystem.config.js',
    'ecosystem.cluster.config.js',
    'package.json',
    'package-lock.json',
    '.env.production.example',
    '.env.example',
    'README.md',
  ];

  const exists = async (p: string) =>
    !!(await fsp
      .access(p)
      .then(() => true)
      .catch(() => false));

  // 5. 递归复制函数
  async function copyEntry(srcRel: string) {
    const src = path.join(rootDir, srcRel);
    if (!(await exists(src))) {
      return;
    }
    const dest = path.join(targetDir, srcRel);
    const stat = await fsp.stat(src);
    if (stat.isDirectory()) {
      await fsp.mkdir(dest, { recursive: true });
      const children = await fsp.readdir(src);
      for (const child of children) {
        await copyEntry(path.join(srcRel, child));
      }
    } else {
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.copyFile(src, dest);
    }
  }

  // 6. 复制文件
  for (const entry of entriesToCopy) {
    console.log(`> Copying ${entry} ...`);
    await copyEntry(entry);
  }

  // 7. 创建 tar.gz 包
  const archiveName = `kucun-${version}.tar.gz`;
  const archivePath = path.join(releaseRoot, archiveName);

  console.log(`> Creating archive: ${archivePath}`);
  await tar.create(
    {
      gzip: true,
      file: archivePath,
      cwd: releaseRoot,
    },
    [folderName]
  );

  console.log('✅ Release package created successfully:');
  console.log(`   ${archivePath}`);
  console.log('');
  console.log('下一步：');
  console.log(
    '1. 将该 tar.gz 上传到宝塔服务器（例如 /www/wwwroot/kucun-release）'
  );
  console.log(
    '2. 在服务器解压，进入解压目录后执行安装脚本（install-on-server.sh 或文档指引）'
  );
}

main().catch(err => {
  console.error('❌ Failed to create release package:', err);
  process.exit(1);
});
