const mockGetCatalog = jest.fn();
import { readFileSync } from 'fs';
import path from 'path';

jest.mock('../../erpxcx/utils/catalog', () => ({
  getCatalog: mockGetCatalog,
}));

function loadHomePage() {
  jest.resetModules();
  let pageConfig: Record<string, any> | null = null;
  (global as any).Page = jest.fn(config => {
    pageConfig = config;
  });

  require('../../erpxcx/pages/index/index');

  if (!pageConfig) {
    throw new Error('首页 Page 配置未加载');
  }

  return pageConfig;
}

describe('小程序首页目录页级缓存', () => {
  const realDateNow = Date.now;

  beforeEach(() => {
    jest.clearAllMocks();
    Date.now = jest.fn(() => 1_000_000);
  });

  afterEach(() => {
    Date.now = realDateNow;
    delete (global as any).Page;
  });

  test('requestCatalog 命中页级缓存时不重复请求', async () => {
    const page = loadHomePage();
    const context = {
      catalogCache: {},
    };
    mockGetCatalog.mockResolvedValueOnce({ groups: [{ id: 'group-1' }] });

    await expect(
      page.requestCatalog.call(context, { seriesId: 'hot' })
    ).resolves.toEqual({ groups: [{ id: 'group-1' }] });
    await expect(
      page.requestCatalog.call(context, { seriesId: 'hot' })
    ).resolves.toEqual({ groups: [{ id: 'group-1' }] });

    expect(mockGetCatalog).toHaveBeenCalledTimes(1);
  });

  test('requestCatalog 页级缓存过期后重新请求', async () => {
    const page = loadHomePage();
    const context = {
      catalogCache: {},
    };
    mockGetCatalog
      .mockResolvedValueOnce({ groups: [{ id: 'old-group' }] })
      .mockResolvedValueOnce({ groups: [{ id: 'new-group' }] });

    await expect(
      page.requestCatalog.call(context, { seriesId: 'hot' })
    ).resolves.toEqual({ groups: [{ id: 'old-group' }] });

    (Date.now as jest.Mock).mockReturnValueOnce(1_000_000 + 120_001);

    await expect(
      page.requestCatalog.call(context, { seriesId: 'hot' })
    ).resolves.toEqual({ groups: [{ id: 'new-group' }] });

    expect(mockGetCatalog).toHaveBeenCalledTimes(2);
  });

  test('首页网络错误独占内容区并提供重试入口', () => {
    const wxml = readFileSync(
      path.join(process.cwd(), 'erpxcx', 'pages', 'index', 'index.wxml'),
      'utf8'
    );

    expect(wxml).not.toContain(
      '<view wx:if="{{error}}" class="notice">{{error}}</view>'
    );
    expect(wxml).toContain('wx:elif="{{error}}"');
    expect(wxml).toContain('bindtap="onRetryTap"');
    expect(wxml).toContain('<block wx:elif="{{isSearching}}">');
  });
});
