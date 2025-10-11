# 运输查询系统完整实现计划

## 概述

基于 Puppeteer 的运输查询系统，支持多站点配置、中文自动转拼音、浏览器自动化查询。

## ✅ 已完成

1. **数据库设计** - ShippingSite 和 ShippingQuery 表
2. **类型定义** - lib/types/shipping.ts

## 📋 待实现任务

### 1. 安装依赖

```bash
npm install puppeteer
npm install pinyin-pro  # 中文转拼音库
npm install @types/puppeteer --save-dev
```

### 2. 创建 Puppeteer 服务 (lib/services/puppeteer-service.ts)

**职责：** 封装浏览器自动化逻辑

```typescript
import puppeteer, { Browser, Page } from 'puppeteer';
import { ExtractSelectors } from '@/lib/types/shipping';

export class PuppeteerService {
  private static browser: Browser | null = null;

  /**
   * 获取或创建浏览器实例 (单例模式)
   * SOLID-S: 单一职责 - 只负责浏览器生命周期管理
   */
  static async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await puppeteer.launch({
        headless: 'new', // 使用新的无头模式
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  /**
   * 执行查询操作
   * @param url 站点URL
   * @param keyword 查询关键词(已转换为大写)
   * @param selectors 选择器配置
   * @param extractSelectors 数据提取选择器
   */
  static async queryShipping(
    url: string,
    keyword: string,
    selectors: {
      searchInput: string;
      searchButton: string;
      resultContainer: string;
    },
    extractSelectors: ExtractSelectors
  ): Promise<{
    status?: string;
    destination?: string;
    estimatedArrival?: string;
    lastUpdateTime?: string;
  }> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // 设置超时
      page.setDefaultTimeout(30000);

      // 访问页面
      await page.goto(url, { waitUntil: 'networkidle2' });

      // 输入查询关键词
      await page.waitForSelector(selectors.searchInput);
      await page.type(selectors.searchInput, keyword);

      // 点击搜索按钮
      await page.click(selectors.searchButton);

      // 等待结果容器出现
      await page.waitForSelector(selectors.resultContainer, {
        timeout: 15000,
      });

      // 等待额外的加载时间(可选)
      await page.waitForTimeout(2000);

      // 提取数据
      const result = await page.evaluate(selectors => {
        const getTextContent = (selector: string) => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || undefined;
        };

        return {
          status: getTextContent(selectors.status),
          destination: getTextContent(selectors.destination),
          estimatedArrival: getTextContent(selectors.estimatedArrival),
          lastUpdateTime: getTextContent(selectors.updateTime),
        };
      }, extractSelectors);

      return result;
    } finally {
      await page.close();
    }
  }

  /**
   * 关闭浏览器
   */
  static async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
```

### 3. 创建中文转拼音工具 (lib/utils/pinyin.ts)

```typescript
import { pinyin } from 'pinyin-pro';

/**
 * 中文转拼音大写
 * KISS原则: 简单直接的转换逻辑
 */
export function chineseToPinyinUppercase(text: string): string {
  // 如果已经是英文,直接转大写
  if (/^[A-Za-z0-9]+$/.test(text)) {
    return text.toUpperCase();
  }

  // 转换为拼音
  const pinyinText = pinyin(text, {
    toneType: 'none', // 不带声调
    type: 'array', // 返回数组
  }).join('');

  return pinyinText.toUpperCase();
}
```

### 4. API 路由 - 站点管理 (app/api/shipping/sites/route.ts)

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/auth/api-helpers';
import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';

/**
 * GET /api/shipping/sites - 获取站点列表
 */
export const GET = withErrorHandling(
  withAuth(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const sites = await prisma.shippingSite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return successResponse({ data: sites });
  })
);

/**
 * POST /api/shipping/sites - 创建站点
 */
export const POST = withErrorHandling(
  withAuth(async (request: NextRequest) => {
    const body = await request.json();

    const site = await prisma.shippingSite.create({
      data: {
        name: body.name,
        url: body.url,
        description: body.description,
        searchInputSelector: body.searchInputSelector,
        searchButtonSelector: body.searchButtonSelector,
        resultContainerSelector: body.resultContainerSelector,
        extractSelectors: JSON.stringify(body.extractSelectors),
      },
    });

    return successResponse(site, 201);
  })
);
```

### 5. API 路由 - 运输查询 (app/api/shipping/query/route.ts)

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/auth/api-helpers';
import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { PuppeteerService } from '@/lib/services/puppeteer-service';
import { chineseToPinyinUppercase } from '@/lib/utils/pinyin';

/**
 * POST /api/shipping/query - 执行查询
 */
export const POST = withErrorHandling(
  withAuth(async (request: NextRequest) => {
    const { siteId, keyword } = await request.json();

    // 获取站点配置
    const site = await prisma.shippingSite.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return errorResponse('站点不存在', 404);
    }

    // 转换关键词
    const trackingNumber = chineseToPinyinUppercase(keyword);

    try {
      // 解析选择器配置
      const extractSelectors = JSON.parse(site.extractSelectors);

      // 执行查询
      const result = await PuppeteerService.queryShipping(
        site.url,
        trackingNumber,
        {
          searchInput: site.searchInputSelector,
          searchButton: site.searchButtonSelector,
          resultContainer: site.resultContainerSelector,
        },
        extractSelectors
      );

      // 保存查询记录
      const query = await prisma.shippingQuery.create({
        data: {
          siteId,
          trackingNumber,
          inputKeyword: keyword,
          status: result.status,
          destination: result.destination,
          estimatedArrival: result.estimatedArrival
            ? new Date(result.estimatedArrival)
            : null,
          lastUpdateTime: result.lastUpdateTime
            ? new Date(result.lastUpdateTime)
            : null,
          queryStatus: 'success',
        },
      });

      return successResponse(query);
    } catch (error) {
      // 保存失败记录
      const query = await prisma.shippingQuery.create({
        data: {
          siteId,
          trackingNumber,
          inputKeyword: keyword,
          queryStatus: 'failed',
          errorMessage: error instanceof Error ? error.message : '查询失败',
        },
      });

      return successResponse(query);
    }
  })
);
```

### 6. 前端页面 - 站点管理 (app/(dashboard)/settings/shipping-sites/page.tsx)

**布局结构：**

- 顶部：页面标题 + 新增站点按钮
- 表格：展示所有站点配置
- 弹窗：站点配置表单(新增/编辑)

**关键字段：**

- 站点名称、URL、描述
- 搜索框选择器、搜索按钮选择器、结果容器选择器
- 数据提取选择器配置(status, destination, estimatedArrival, updateTime)

### 7. 前端页面 - 运输查询 (app/(dashboard)/settings/shipping-query/page.tsx)

**布局结构：**

- 查询表单：
  - 选择站点(下拉框)
  - 输入追踪单号(支持中文)
  - 查询按钮
- 查询结果展示：
  - 当前状态
  - 目的地
  - 预计到达时间
  - 最后更新时间
- 历史记录表格：
  - 分页展示所有查询记录
  - 支持按站点、状态筛选

### 8. 添加菜单项

在布局文件或配置中添加:

```typescript
{
  label: '系统设置',
  icon: Settings,
  children: [
    {
      label: '运输查询站点',
      href: '/settings/shipping-sites',
    },
    {
      label: '运输查询',
      href: '/settings/shipping-query',
    },
  ],
}
```

## 注意事项

### TypeScript 问题处理

1. 确保所有类型定义完整
2. Puppeteer 类型正确导入: `import type { Browser, Page } from 'puppeteer'`
3. ExtractSelectors 配置使用 JSON.parse/JSON.stringify

### Puppeteer 最佳实践

1. **浏览器复用** - 使用单例模式,避免频繁创建/关闭浏览器
2. **超时控制** - 设置合理的超时时间(30秒)
3. **资源清理** - 确保 page 在 finally 块中关闭
4. **错误处理** - 捕获所有可能的异常,记录到数据库
5. **无头模式** - 生产环境使用 headless: 'new'

### 性能优化

1. 浏览器实例复用
2. 查询结果缓存(可选)
3. 并发查询控制(避免过载)

### 安全考虑

1. 管理员权限验证(withAuth)
2. 输入验证(防止 XSS)
3. 选择器配置验证(防止恶意代码)

## 测试场景

1. **站点配置测试**
   - 创建/编辑/删除站点
   - 验证选择器配置格式

2. **中文转拼音测试**
   - 纯中文: "广州" → "GUANGZHOU"
   - 纯英文: "sf123" → "SF123"
   - 混合: "广州SF123" → "GUANGZHOUSF123"

3. **查询功能测试**
   - 成功查询
   - 失败查询(超时、选择器错误)
   - 查询历史记录

4. **并发测试**
   - 多用户同时查询
   - 浏览器实例复用验证

## 完成标准

- [ ] Puppeteer 服务正常运行
- [ ] 中文转拼音功能正确
- [ ] 站点 CRUD 功能完整
- [ ] 查询功能稳定(成功率 >95%)
- [ ] 前端页面用户体验流畅
- [ ] 错误处理完善
- [ ] 类型安全无警告

## 预计工作量

- Puppeteer 服务: 2-3小时
- API 路由: 1-2小时
- 前端页面: 3-4小时
- 测试调试: 2-3小时
- **总计: 8-12小时**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
