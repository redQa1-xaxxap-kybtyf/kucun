import fs from 'fs';
import path from 'path';

const miniProgramRoot = path.join(process.cwd(), 'erpxcx');

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<
    string,
    unknown
  >;
}

function flattenMiniProgramPages(appJson: Record<string, unknown>) {
  const pages = Array.isArray(appJson.pages) ? appJson.pages : [];
  const subpackages = Array.isArray(appJson.subpackages)
    ? appJson.subpackages
    : [];
  const rootPages = pages.map(String);
  const packagePages = subpackages.flatMap(item => {
    const pkg = item as { root?: string; pages?: string[] };
    return (pkg.pages || []).map(page => `${pkg.root}/${page}`);
  });

  return rootPages.concat(packagePages);
}

describe('微信小程序配置', () => {
  test('客户首屏留在主包，管理端页面移入分包且路径不重复', () => {
    const appJson = readJson(path.join(miniProgramRoot, 'app.json'));
    const pages = Array.isArray(appJson.pages)
      ? appJson.pages.map(String)
      : [];
    const allPages = flattenMiniProgramPages(appJson);
    const uniquePages = new Set(allPages);
    const subpackages = Array.isArray(appJson.subpackages)
      ? appJson.subpackages
      : [];

    expect(pages).toContain('pages/index/index');
    expect(pages).toContain('pages/group/detail');
    expect(pages).toContain('pages/product/detail');
    expect(pages.some(page => page.startsWith('pages/admin/'))).toBe(false);
    expect(allPages).toContain('pages/admin/login');
    expect(allPages).toContain('pages/admin/workspace');
    expect(subpackages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ root: 'pages/admin' }),
      ])
    );
    expect(uniquePages.size).toBe(allPages.length);

    allPages.forEach(page => {
      expect(fs.existsSync(path.join(miniProgramRoot, `${page}.json`))).toBe(
        true
      );
      expect(fs.existsSync(path.join(miniProgramRoot, `${page}.js`))).toBe(
        true
      );
      expect(fs.existsSync(path.join(miniProgramRoot, `${page}.wxml`))).toBe(
        true
      );
    });
  });

  test('启用按需注入并排除非运行文件', () => {
    const appJson = readJson(path.join(miniProgramRoot, 'app.json'));
    const projectConfig = readJson(
      path.join(miniProgramRoot, 'project.config.json')
    );
    const packOptions = projectConfig.packOptions as {
      ignore?: Array<{ type?: string; value?: string }>;
    };
    const ignoreValues = (packOptions.ignore || []).map(item => item.value);

    expect(appJson.lazyCodeLoading).toBe('requiredComponents');
    expect(projectConfig.libVersion).toBe('3.15.1');
    expect((projectConfig.setting as Record<string, unknown>).urlCheck).toBe(
      true
    );
    expect(
      (projectConfig.setting as Record<string, unknown>).uploadWithSourceMap
    ).toBe(false);
    expect(ignoreValues).toEqual(
      expect.arrayContaining([
        '.md',
        '.log',
        '.tmp-',
        'project.private.config.json',
      ])
    );
  });
});
