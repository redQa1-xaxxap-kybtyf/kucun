# 运输查询系统安全风险分析与解决方案

## 🔍 安全风险分析

### 1. **URL 暴露风险** 🔴 高风险

#### 当前状态
- ✅ **API 层面**：`GET /api/shipping/sites` 返回完整的站点数据，**包括 `url` 字段**
- ✅ **前端显示**：站点管理页面直接显示 URL（`page.tsx` 第 454 行）
- ✅ **权限控制**：只有登录用户可以访问（`withAuth` 中间件）
- ❌ **角色限制**：普通用户也能看到 URL，只有创建/编辑需要管理员权限

#### 风险评估
```typescript
// app/api/shipping/sites/route.ts - 第 43 行
return successResponse({
  data: sites,  // ❌ 包含完整的 url 字段
  pagination: { ... }
});
```

**暴露的信息**：
1. 第三方数据源的完整 URL
2. 查询页面的路径结构
3. 可能包含的参数格式

**潜在风险**：
- 🔴 **竞争对手分析**：可以知道你使用哪些数据源
- 🔴 **第三方发现**：网站可能发现被爬取并采取反制措施
- 🟡 **内部泄露**：员工离职可能泄露数据源信息
- 🟡 **API 滥用**：如果 token 泄露，攻击者可以获取所有 URL

### 2. **Puppeteer 检测风险** 🟡 中风险

#### 当前状态
```typescript
// lib/services/puppeteer-service.ts
// ❌ 没有配置 User-Agent
// ❌ 没有使用 Stealth Plugin
// ❌ 没有随机延迟
// ❌ 没有代理 IP
```

**检测特征**：
1. **Headless 特征**：`navigator.webdriver === true`
2. **Chrome DevTools Protocol**：可被检测
3. **默认 User-Agent**：包含 "HeadlessChrome"
4. **行为模式**：请求速度过快，无人类行为特征

**风险**：
- 🟡 **被识别为机器人**：触发验证码或封禁
- 🟡 **IP 封禁**：频繁请求导致 IP 被封
- 🟢 **数据不准确**：网站可能返回假数据

### 3. **访问频率风险** 🟡 中风险

#### 当前状态
- ❌ **无 Rate Limiting**：API 没有请求频率限制
- ❌ **无缓存机制**：每次查询都访问第三方网站
- ❌ **无去重检查**：可能重复查询相同的单号

**风险**：
- 🟡 **触发反爬虫**：短时间大量请求
- 🟡 **资源浪费**：重复查询消耗服务器资源
- 🟢 **成本增加**：如果使用代理 IP，成本会增加

### 4. **审计和监控** 🟢 低风险

#### 当前状态
- ✅ **查询记录**：所有查询都保存在 `shipping_queries` 表
- ✅ **错误记录**：失败查询也会记录
- ❌ **无异常检测**：没有监控异常访问模式
- ❌ **无告警机制**：没有自动告警

---

## 💡 解决方案

### 方案 A: API 层面隐藏 URL（推荐）

#### 实施难度：⭐ 简单
#### 安全性提升：⭐⭐⭐ 高
#### 对现有功能影响：⭐ 低

#### 实现方案

**1. 修改 API 返回数据**

```typescript
// app/api/shipping/sites/route.ts
export const GET = withErrorHandling(
  withAuth(async (request: NextRequest, { user }) => {
    // ... 查询逻辑 ...

    // 根据用户角色决定是否返回 URL
    const sitesData = sites.map(site => {
      const { url, ...siteWithoutUrl } = site;
      
      // 只有管理员可以看到 URL
      if (user.role === 'admin') {
        return site;
      }
      
      // 普通用户不返回 URL
      return {
        ...siteWithoutUrl,
        urlMasked: '***' // 可选：显示已隐藏
      };
    });

    return successResponse({
      data: sitesData,
      pagination: { ... }
    });
  })
);
```

**2. 修改前端显示**

```typescript
// app/(dashboard)/settings/shipping-sites/page.tsx
<TableCell className="max-w-xs truncate">
  {user?.role === 'admin' ? site.url : '***（仅管理员可见）'}
</TableCell>
```

**3. 修改类型定义**

```typescript
// lib/types/shipping.ts
export interface ShippingSitePublic {
  id: string;
  name: string;
  description?: string;
  status: string;
  // url 字段不包含在公共接口中
}

export interface ShippingSiteAdmin extends ShippingSitePublic {
  url: string; // 只有管理员接口包含 URL
}
```

#### 优点
- ✅ 实施简单，只需修改 API 和前端
- ✅ 不影响 Puppeteer 服务（服务端仍可访问完整数据）
- ✅ 符合最小权限原则
- ✅ 向后兼容（管理员功能不变）

#### 缺点
- ⚠️ 普通用户无法查看 URL（但这正是目的）
- ⚠️ 需要修改前端代码

---

### 方案 B: Puppeteer 反爬虫配置（推荐）

#### 实施难度：⭐⭐ 中等
#### 安全性提升：⭐⭐⭐ 高
#### 对现有功能影响：⭐ 低

#### 实现方案

**1. 安装依赖**

```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth
npm install puppeteer-extra-plugin-user-preferences
```

**2. 修改 Puppeteer 服务**

```typescript
// lib/services/puppeteer-service.ts
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// 使用 Stealth Plugin
puppeteer.use(StealthPlugin());

export class PuppeteerService {
  private static async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled', // 隐藏自动化特征
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
        // 自定义 User-Agent
        defaultViewport: {
          width: 1920,
          height: 1080,
        },
      });
    }
    return this.browser;
  }

  private static async createPage(browser: Browser): Promise<Page> {
    const page = await browser.newPage();

    // 设置真实的 User-Agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 设置额外的 headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // 隐藏 webdriver 特征
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    return page;
  }

  // 添加随机延迟
  private static async randomDelay(min: number = 1000, max: number = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  public static async queryShipping(...) {
    // ... 现有逻辑 ...

    // 在关键操作之间添加随机延迟
    await this.randomDelay(1000, 2000); // 输入前延迟
    await searchInput.type(trackingNumber, { delay: 100 }); // 模拟人类打字速度
    await this.randomDelay(500, 1500); // 点击前延迟
    await searchButton.click();
    
    // ... 其余逻辑 ...
  }
}
```

#### 优点
- ✅ 大幅降低被检测为机器人的风险
- ✅ 模拟真实用户行为
- ✅ 不影响现有功能
- ✅ 提升查询成功率

#### 缺点
- ⚠️ 查询速度略微降低（因为添加了延迟）
- ⚠️ 需要额外的 npm 包

---

### 方案 C: 访问频率控制和缓存（推荐）

#### 实施难度：⭐⭐ 中等
#### 安全性提升：⭐⭐ 中
#### 对现有功能影响：⭐ 低

#### 实现方案

**1. 添加 Rate Limiting 中间件**

```typescript
// lib/api/rate-limiter.ts
import { NextRequest } from 'next/server';
import { errorResponse } from '@/lib/auth/api-helpers';

const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function withRateLimit(
  handler: Function,
  options: { maxRequests: number; windowMs: number } = {
    maxRequests: 10, // 每个窗口最多10次请求
    windowMs: 60 * 1000, // 1分钟窗口
  }
) {
  return async (request: NextRequest, context?: unknown) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();

    const record = requestCounts.get(ip);

    if (!record || now > record.resetTime) {
      // 新窗口
      requestCounts.set(ip, {
        count: 1,
        resetTime: now + options.windowMs,
      });
    } else {
      // 现有窗口
      if (record.count >= options.maxRequests) {
        return errorResponse(
          `请求过于频繁，请在 ${Math.ceil((record.resetTime - now) / 1000)} 秒后重试`,
          429
        );
      }
      record.count++;
    }

    return handler(request, context);
  };
}
```

**2. 应用到查询 API**

```typescript
// app/api/shipping/query/route.ts
export const POST = withErrorHandling(
  withAuth(
    withRateLimit(
      async (request: NextRequest) => {
        // ... 现有逻辑 ...
      },
      { maxRequests: 10, windowMs: 60 * 1000 } // 每分钟最多10次查询
    )
  )
);
```

**3. 添加查询缓存**

```typescript
// lib/services/shipping-cache.ts
interface CacheEntry {
  data: ShippingQueryResult;
  timestamp: number;
}

export class ShippingCache {
  private static cache = new Map<string, CacheEntry>();
  private static readonly CACHE_TTL = 30 * 60 * 1000; // 30分钟

  static getCacheKey(siteId: string, trackingNumber: string): string {
    return `${siteId}:${trackingNumber}`;
  }

  static get(siteId: string, trackingNumber: string): ShippingQueryResult | null {
    const key = this.getCacheKey(siteId, trackingNumber);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  static set(siteId: string, trackingNumber: string, data: ShippingQueryResult) {
    const key = this.getCacheKey(siteId, trackingNumber);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  static clear() {
    this.cache.clear();
  }
}
```

**4. 在查询 API 中使用缓存**

```typescript
// app/api/shipping/query/route.ts
export const POST = withErrorHandling(
  withAuth(async (request: NextRequest) => {
    const { siteId, keyword } = body;

    // 检查缓存
    const cached = ShippingCache.get(siteId, trackingNumber);
    if (cached) {
      logger.info(`使用缓存数据: ${trackingNumber}`);
      return successResponse(cached, 200, '使用缓存数据');
    }

    // ... 执行查询 ...

    // 保存到缓存
    ShippingCache.set(siteId, trackingNumber, result);

    return successResponse(result);
  })
);
```

#### 优点
- ✅ 减少对第三方网站的请求频率
- ✅ 提升响应速度（缓存命中时）
- ✅ 降低被封禁风险
- ✅ 节省服务器资源

#### 缺点
- ⚠️ 缓存数据可能不是最新的
- ⚠️ 需要管理缓存过期和清理

---

### 方案 D: 审计和监控（可选）

#### 实施难度：⭐⭐⭐ 复杂
#### 安全性提升：⭐⭐ 中
#### 对现有功能影响：⭐ 低

#### 实现方案

**1. 添加审计日志表**

```prisma
// prisma/schema.prisma
model AuditLog {
  id        String   @id @default(uuid())
  userId    String
  action    String   // 'view_sites', 'create_site', 'query_shipping'
  resource  String   // 资源ID
  ipAddress String?
  userAgent String?
  metadata  Json?    // 额外信息
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

**2. 创建审计日志服务**

```typescript
// lib/services/audit-logger.ts
export class AuditLogger {
  static async log(params: {
    userId: string;
    action: string;
    resource: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }) {
    await prisma.auditLog.create({
      data: params,
    });
  }

  // 检测异常访问模式
  static async detectAnomalies(userId: string): Promise<boolean> {
    const recentLogs = await prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // 最近1小时
        },
      },
    });

    // 检测异常：1小时内超过100次查询
    if (recentLogs.length > 100) {
      logger.warn(`用户 ${userId} 访问频率异常: ${recentLogs.length} 次/小时`);
      return true;
    }

    return false;
  }
}
```

**3. 在 API 中记录审计日志**

```typescript
// app/api/shipping/sites/route.ts
export const GET = withErrorHandling(
  withAuth(async (request: NextRequest, { user }) => {
    // 记录审计日志
    await AuditLogger.log({
      userId: user.id,
      action: 'view_sites',
      resource: 'shipping_sites',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // ... 现有逻辑 ...
  })
);
```

#### 优点
- ✅ 完整的操作记录
- ✅ 可追溯性
- ✅ 异常检测和告警
- ✅ 合规性（如 GDPR）

#### 缺点
- ⚠️ 增加数据库写入
- ⚠️ 需要额外的存储空间
- ⚠️ 实施复杂度较高

---

## 📊 方案对比

| 方案 | 实施难度 | 安全性提升 | 性能影响 | 维护成本 | 推荐度 |
|------|---------|-----------|---------|---------|--------|
| A. 隐藏 URL | ⭐ 简单 | ⭐⭐⭐ 高 | 无 | ⭐ 低 | ⭐⭐⭐⭐⭐ 强烈推荐 |
| B. 反爬虫配置 | ⭐⭐ 中等 | ⭐⭐⭐ 高 | 略降低 | ⭐⭐ 中 | ⭐⭐⭐⭐⭐ 强烈推荐 |
| C. 频率控制 | ⭐⭐ 中等 | ⭐⭐ 中 | 提升 | ⭐⭐ 中 | ⭐⭐⭐⭐ 推荐 |
| D. 审计监控 | ⭐⭐⭐ 复杂 | ⭐⭐ 中 | 略降低 | ⭐⭐⭐ 高 | ⭐⭐⭐ 可选 |

---

## 🎯 推荐实施顺序

### 第一阶段（立即实施）- 核心安全
1. ✅ **方案 A**: 隐藏 URL（1-2小时）
2. ✅ **方案 B**: Puppeteer 反爬虫配置（2-3小时）

### 第二阶段（1周内）- 性能优化
3. ✅ **方案 C**: 访问频率控制和缓存（3-4小时）

### 第三阶段（可选）- 合规和监控
4. ⭕ **方案 D**: 审计和监控（1-2天）

---

## 🎓 设计原则遵循

- ✅ **SOLID-S**: 每个方案职责单一，互不干扰
- ✅ **KISS**: 方案 A 和 B 实现简单直接
- ✅ **YAGNI**: 方案 D 标记为可选，避免过度设计
- ✅ **DRY**: 中间件和服务可复用

---

**下一步**: 我将为你提供具体的代码实现。你想先实施哪个方案？

