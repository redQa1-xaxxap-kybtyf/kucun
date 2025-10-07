# API 速率限制 (Rate Limiting) - 使用说明

## 功能概述

速率限制中间件已成功实现，用于防止 DDoS 攻击和暴力破解，保护 API 免受滥用。

### 核心特性

- **滑动窗口算法**：比固定窗口更精确，避免边界突发流量
- **双存储支持**：优先使用 Redis，自动降级到内存存储
- **多层限制策略**：支持全局、认证、读取、写入等多种限制类型
- **基于身份识别**：支持用户 ID 和 IP 地址两种标识方式
- **标准 HTTP 响应**：返回 429 状态码和详细的重试信息

## 速率限制配置

### 环境变量配置

在 `.env.local` 或 `.env.production` 中添加：

```env
# 是否启用速率限制 (true/false)
RATE_LIMIT_ENABLED=true

# 全局速率限制 (请求数/分钟)
RATE_LIMIT_GLOBAL=100

# 认证API速率限制 (请求数/分钟)
RATE_LIMIT_AUTH=5

# 读取API速率限制 (请求数/分钟)
RATE_LIMIT_READ=60

# 写入API速率限制 (请求数/分钟)
RATE_LIMIT_WRITE=30

# 登录速率限制 (请求数/分钟)
RATE_LIMIT_LOGIN=5

# 验证码速率限制 (请求数/分钟)
RATE_LIMIT_CAPTCHA=10
```

### 速率限制类型说明

| 类型      | 默认限制 | 适用场景               |
| --------- | -------- | ---------------------- |
| `GLOBAL`  | 100/分钟 | 所有 API 请求          |
| `AUTH`    | 5/分钟   | 登录、注册、验证码     |
| `READ`    | 60/分钟  | GET 请求               |
| `WRITE`   | 30/分钟  | POST/PUT/DELETE        |
| `LOGIN`   | 5/分钟   | 登录接口（防暴力破解） |
| `CAPTCHA` | 10/分钟  | 验证码接口             |

## 使用方法

### 方式1: 在 `withAuth` 中启用速率限制

最简单的方式，在现有认证中间件中添加速率限制：

```typescript
import { withAuth } from '@/lib/api/middleware';
import { RateLimitType } from '@/lib/rate-limit';

// 示例：产品列表 API（读取限制）
export const GET = withAuth(
  async (request, context, session) => {
    const products = await getProducts();
    return successResponse(products);
  },
  {
    rateLimit: RateLimitType.READ, // 添加速率限制
  }
);

// 示例：创建产品 API（写入限制）
export const POST = withAuth(
  async (request, context, session) => {
    const data = await request.json();
    const product = await createProduct(data);
    return successResponse(product);
  },
  {
    rateLimit: RateLimitType.WRITE, // 写入限制
  }
);
```

### 方式2: 使用 `withRateLimit` 包装器

独立使用速率限制（不需要认证）：

```typescript
import { withRateLimit, RateLimitType } from '@/lib/rate-limit';
import { successResponse } from '@/lib/api/response';

// 示例：验证码 API（无需认证，但需要限制）
export const POST = withRateLimit(RateLimitType.CAPTCHA)(async request => {
  const { phone } = await request.json();
  const captcha = await generateCaptcha(phone);
  return successResponse({ captcha });
});
```

### 方式3: 手动检查速率限制

需要更细粒度控制时：

```typescript
import { checkRateLimit, RateLimitType } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // 手动检查速率限制
  const rateLimitResult = await checkRateLimit(request, RateLimitType.LOGIN);

  if (rateLimitResult.limited && rateLimitResult.response) {
    return rateLimitResult.response; // 返回 429 错误
  }

  // 继续处理登录逻辑
  const { username, password } = await request.json();
  // ...
}
```

## API 响应格式

### 成功响应（未触发限制）

请求成功时，响应头会包含速率限制信息：

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2025-10-04T12:45:00.000Z
```

### 限制触发响应

触发速率限制时，返回 429 状态码：

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-10-04T12:45:00.000Z
Content-Type: application/json
```

```json
{
  "success": false,
  "error": {
    "type": "RATE_LIMIT_EXCEEDED",
    "message": "请求过于频繁，请稍后再试",
    "retryAfter": "2025-10-04T12:45:00.000Z",
    "details": {
      "limit": 60,
      "remaining": 0,
      "resetAt": "2025-10-04T12:45:00.000Z"
    }
  }
}
```

## 实际应用示例

### 1. 登录 API 防暴力破解

```typescript
// app/api/auth/signin/route.ts
import { withRateLimit, RateLimitType } from '@/lib/rate-limit';

export const POST = withRateLimit(RateLimitType.LOGIN)(async request => {
  const { username, password } = await request.json();

  // 验证登录凭证
  const user = await authenticateUser(username, password);

  if (!user) {
    return errorResponse('用户名或密码错误');
  }

  return successResponse({ user });
});
```

### 2. 验证码 API 防滥用

```typescript
// app/api/captcha/route.ts
import { withRateLimit, RateLimitType } from '@/lib/rate-limit';

export const POST = withRateLimit(RateLimitType.CAPTCHA)(async request => {
  const { phone } = await request.json();

  // 生成并发送验证码
  const code = await generateAndSendCaptcha(phone);

  return successResponse({ message: '验证码已发送' });
});
```

### 3. 公开 API 限制（基于 IP）

```typescript
// app/api/public/search/route.ts
import { withRateLimit, RateLimitType } from '@/lib/rate-limit';

// 未认证用户基于 IP 限制
export const GET = withRateLimit(RateLimitType.READ)(async request => {
  const { q } = await request.json();
  const results = await searchPublicData(q);
  return successResponse(results);
});
```

### 4. 管理员 API（已认证用户）

```typescript
// app/api/admin/users/route.ts
import { withAuth } from '@/lib/api/middleware';
import { RateLimitType } from '@/lib/rate-limit';

// 已认证用户基于用户 ID 限制
export const GET = withAuth(
  async (request, context, session) => {
    const users = await getAllUsers();
    return successResponse(users);
  },
  {
    rateLimit: RateLimitType.READ,
  }
);
```

## 高级用法

### 自定义速率限制配置

如果需要自定义配置（不使用预设类型）：

```typescript
import { createRateLimiter, createRateLimitStorage } from '@/lib/rate-limit';
import { redis } from '@/lib/redis';

// 创建自定义限制器
const customLimiter = createRateLimiter(
  createRateLimitStorage(redis.getClient()),
  {
    maxRequests: 10, // 10次
    windowMs: 5 * 60 * 1000, // 5分钟
    keyPrefix: 'custom:api',
    type: 'CUSTOM' as any,
  }
);

// 在 API 中使用
export async function POST(request: NextRequest) {
  const identifier = getIdentifier(request);
  const result = await customLimiter.checkLimit(identifier);

  if (!result.allowed) {
    return new Response(JSON.stringify({ error: '自定义限制' }), {
      status: 429,
    });
  }

  // 处理请求
}
```

### 重置用户限制（管理员功能）

```typescript
import { getRateLimiter, RateLimitType } from '@/lib/rate-limit';

// 管理员重置用户的速率限制
export async function resetUserRateLimit(userId: string) {
  const limiter = getRateLimiter(RateLimitType.GLOBAL);
  await limiter.reset(`user:${userId}`);
}
```

### 查询剩余额度

```typescript
import { getRateLimiter, RateLimitType } from '@/lib/rate-limit';
import { getIdentifier } from '@/lib/rate-limit/middleware';

// 查询当前用户的剩余额度
export const GET = async (request: NextRequest) => {
  const limiter = getRateLimiter(RateLimitType.GLOBAL);
  const identifier = getIdentifier(request);
  const status = await limiter.getStatus(identifier);

  return successResponse({
    limit: status.limit,
    remaining: status.remaining,
    resetAt: status.resetAt,
  });
};
```

## 监控与调试

### 查看速率限制统计

```typescript
import { getRateLimitStats } from '@/lib/rate-limit';

// 获取所有限制器的统计信息
const stats = getRateLimitStats();
console.log('速率限制统计:', stats);
```

### 临时禁用速率限制

在 `.env.local` 中设置：

```env
RATE_LIMIT_ENABLED=false
```

## 测试

运行测试脚本验证功能：

```bash
npx tsx scripts/test-rate-limit-standalone.ts
```

测试覆盖场景：

- 基本速率限制功能
- 多标识符独立性
- 滑动窗口算法
- 重置功能
- 状态查询
- 内存存储统计

## 注意事项

1. **生产环境使用 Redis**
   - 内存存储仅适合开发环境或单实例部署
   - 生产环境建议使用 Redis 确保分布式一致性

2. **标识符选择**
   - 已认证用户：使用 `user:${userId}`
   - 未认证用户：使用 `ip:${ipAddress}`
   - 自动从请求头提取（支持代理服务器）

3. **错误处理**
   - Redis 连接失败时自动降级到内存存储
   - 速率限制器发生错误时，为了可用性会允许请求通过

4. **性能考虑**
   - 滑动窗口算法使用 Redis ZSET，性能优秀
   - 自动清理过期数据，避免内存泄漏
   - 连接池复用 Redis 连接

## 文件结构

```
lib/rate-limit/
├── config.ts           # 速率限制配置
├── storage.ts          # 存储适配器（Redis + 内存）
├── rate-limiter.ts     # 核心限制器实现
├── middleware.ts       # 中间件包装器
└── index.ts            # 主入口

lib/api/middleware.ts   # 集成到 withAuth

scripts/
├── test-rate-limit.ts  # 完整测试（需要环境变量）
└── test-rate-limit-standalone.ts  # 独立测试
```

## 总结

API 速率限制系统已完全集成到项目中，具备以下能力：

- ✅ 防止 DDoS 攻击
- ✅ 防止暴力破解
- ✅ 防止 API 滥用
- ✅ 支持多种限制策略
- ✅ 自动降级保障可用性
- ✅ 标准 HTTP 响应格式
- ✅ 完整的测试覆盖

现在您的 API 已经受到全面保护！
