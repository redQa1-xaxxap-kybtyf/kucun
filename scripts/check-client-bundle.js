/**
 * Client bundle regression check (lightweight)
 *
 * Goal:
 * - Ensure a few known large/optional libraries are NOT shipped in the initial
 *   JS for non-API routes (they should be loaded via dynamic import).
 *
 * How it works:
 * 1) Requires a Next.js production build (`.next/app-build-manifest.json`)
 * 2) Collects all JS chunks referenced by non-API routes (initial load list)
 * 3) Scans `.next/static/chunks` (recursive) for a few sentinel strings that are
 *    expected to exist inside the corresponding library bundles
 * 4) Fails if any matched chunk is referenced by a non-API route
 *
 * Usage:
 * - `npm run build`
 * - `npm run bundle:check`
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const NEXT_DIR = path.join(PROJECT_ROOT, '.next');
const MANIFEST_PATH = path.join(NEXT_DIR, 'app-build-manifest.json');
const CHUNKS_DIR = path.join(NEXT_DIR, 'static', 'chunks');

function normalizeToPosixPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function listFilesRecursive(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath));
      continue;
    }
    results.push(fullPath);
  }

  return results;
}

function getNonApiRouteChunks(manifestPages) {
  const routeChunkSet = new Set();
  const routeChunkUsage = new Map();

  for (const [route, files] of Object.entries(manifestPages)) {
    if (route.startsWith('/api/')) {
      continue;
    }

    for (const file of files) {
      if (!file.startsWith('static/chunks/') || !file.endsWith('.js')) {
        continue;
      }
      routeChunkSet.add(file);
      const routes = routeChunkUsage.get(file) ?? [];
      routes.push(route);
      routeChunkUsage.set(file, routes);
    }
  }

  return { routeChunkSet, routeChunkUsage };
}

function scanChunksForSentinels(chunkFiles, checks) {
  const results = new Map(checks.map(check => [check.name, new Set()]));

  for (const filePath of chunkFiles) {
    if (!filePath.endsWith('.js')) {
      continue;
    }

    const relFromNext = normalizeToPosixPath(path.relative(NEXT_DIR, filePath));
    if (!relFromNext.startsWith('static/chunks/')) {
      continue;
    }

    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    for (const check of checks) {
      if (check.sentinels.some(sentinel => content.includes(sentinel))) {
        results.get(check.name).add(relFromNext);
      }
    }
  }

  return results;
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(
      `[bundle-check] Missing build manifest: ${MANIFEST_PATH}\n` +
        `[bundle-check] Run \`npm run build\` first.`
    );
    process.exit(1);
  }

  const manifest = require(MANIFEST_PATH);
  const pages = manifest?.pages;
  if (!pages || typeof pages !== 'object') {
    console.error('[bundle-check] Invalid app-build-manifest.json format.');
    process.exit(1);
  }

  if (!fs.existsSync(CHUNKS_DIR)) {
    console.error(`[bundle-check] Missing chunks dir: ${CHUNKS_DIR}`);
    process.exit(1);
  }

  const { routeChunkSet, routeChunkUsage } = getNonApiRouteChunks(pages);

  const checks = [
    {
      name: 'xlsx',
      sentinels: ['writeFileXLSX'],
    },
    {
      name: 'recharts',
      sentinels: ['recharts-symbols', 'recharts-'],
    },
    {
      name: 'pinyin-pro',
      sentinels: ['The first param of pinyin is error'],
    },
  ];

  const chunkFiles = listFilesRecursive(CHUNKS_DIR);
  const matchedChunksByCheck = scanChunksForSentinels(chunkFiles, checks);

  let hasViolation = false;

  for (const check of checks) {
    const matched = Array.from(matchedChunksByCheck.get(check.name) ?? []);
    if (matched.length === 0) {
      console.warn(
        `[bundle-check] WARNING: no chunks matched sentinels for "${check.name}". ` +
          `If this library is still used, update the sentinels.`
      );
      continue;
    }

    const violations = matched.filter(file => routeChunkSet.has(file));
    if (violations.length === 0) {
      continue;
    }

    hasViolation = true;
    console.error(`\n[bundle-check] FAIL: "${check.name}" detected in initial route chunks:`);
    for (const file of violations) {
      const routes = routeChunkUsage.get(file) ?? [];
      console.error(`- ${file} (routes: ${routes.slice(0, 8).join(', ')}${routes.length > 8 ? ', ...' : ''})`);
    }
  }

  if (hasViolation) {
    process.exit(1);
  }

  console.log('[bundle-check] OK: no heavy libs detected in initial non-API route chunks.');
}

main();
