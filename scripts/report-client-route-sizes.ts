import fs from 'node:fs';
import path from 'node:path';

type AppBuildManifest = {
  pages?: Record<string, string[]>;
};

function parseFlagNumber(name: string, fallback: number) {
  const prefix = `--${name}=`;
  const raw = process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function main() {
  const top = parseFlagNumber('top', 20);

  const projectRoot = process.cwd();
  const nextDir = path.join(projectRoot, '.next');
  const manifestPath = path.join(nextDir, 'app-build-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`[bundle-report] Missing: ${manifestPath}`);
    console.error('[bundle-report] Run `npm run build` first.');
    process.exit(1);
  }

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8')
  ) as AppBuildManifest;
  const pages = manifest.pages;
  if (!pages || typeof pages !== 'object') {
    console.error('[bundle-report] Invalid app-build-manifest.json format.');
    process.exit(1);
  }

  const results = Object.entries(pages)
    .filter(([entry, files]) => {
      if (!Array.isArray(files)) {
        return false;
      }
      if (entry.startsWith('/api/')) {
        return false;
      }
      return entry.endsWith('/page');
    })
    .map(([entry, files]) => {
      const uniqueJs = new Set(
        files.filter(file => typeof file === 'string' && file.endsWith('.js'))
      );

      let totalBytes = 0;
      for (const rel of uniqueJs) {
        const abs = path.join(nextDir, rel);
        if (!fs.existsSync(abs)) {
          continue;
        }
        totalBytes += fs.statSync(abs).size;
      }

      return { entry, totalBytes, jsFiles: uniqueJs.size };
    })
    .sort((a, b) => b.totalBytes - a.totalBytes);

  console.log('KiB\tFiles\tRoute');
  for (const r of results.slice(0, top)) {
    console.log(`${(r.totalBytes / 1024).toFixed(1)}\t${r.jsFiles}\t${r.entry}`);
  }
}

main();

