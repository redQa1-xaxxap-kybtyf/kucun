# API 速率限制 - 快速开始

## 一分钟上手

### 1. 环境配置

复制以下配置到 `.env.local`：

```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_GLOBAL=100
RATE_LIMIT_AUTH=5
RATE_LIMIT_READ=60
RATE_LIMIT_WRITE=30
RATE_LIMIT_LOGIN=5
RATE_LIMIT_CAPTCHA=10
```

### 2. 在 API 中使用

#### 方式A: 认证 API（最常用）

```typescript
import { withAuth } from '@/lib/api/middleware';
import { RateLimitType } from '@/lib/rate-limit';

export const GET = withAuth(
  async (request, context, session) => {
    // 你的业务逻辑
    return successResponse(data);
  },
  { rateLimit: RateLimitType.READ } // 添加这一行即可
);
```

#### 方式B: 公开 API

```typescript
import { withRateLimit, RateLimitType } from '@/lib/rate-limit';

export const POST = withRateLimit(RateLimitType.CAPTCHA)(
  async (request) => {
    // 你的业务逻辑
    return successResponse(data);
  }
);
```

## 速率限制类型速查

| 导入名称 | 限制值 | 使用场景 |
|---------|--------|----------|
| `RateLimitType.GLOBAL` | 100/分钟 | 默认全局限制 |
| `RateLimitType.AUTH` | 5/分钟 | 认证相关 API |
| `RateLimitType.READ` | 60/分钟 | GET 请求 |
| `RateLimitType.WRITE` | 30/分钟 | POST/PUT/DELETE |
| `RateLimitType.LOGIN` | 5/分钟 | 登录接口 |
| `RateLimitType.CAPTCHA` | 10/分钟 | 验证码接口 |

## 常见场景示例

### 场景1: 保护登录接口

```typescript
// app/api/auth/signin/route.ts
import { withRateLimit, RateLimitType } from '@/lib/rate-limit';

export const POST = withRateLimit(RateLimitType.LOGIN)(
  async (request) => {
    const { username, password } = await request.json();
    // ... 登录逻辑
  }
);
```

### 场景2: 保护产品列表

```typescript
// app/api/products/route.ts
import { withAuth } from '@/lib/api/middleware';
import { RateLimitType } from '@/lib/rate-limit';

export const GET = withAuth(
  async (request, context, session) => {
    const products = await getProducts();
    return successResponse(products);
  },
  { rateLimit: RateLimitType.READ }
);
```

### 场景3: 保护创建操作

```typescript
// app/api/products/route.ts
import { withAuth } from '@/lib/api/middleware';
import { RateLimitType } from '@/lib/rate-limit';

export const POST = withAuth(
  async (request, context, session) => {
    const data = await request.json();
    const product = await createProduct(data);
    return successResponse(product);
  },
  { rateLimit: RateLimitType.WRITE }
);
```

## 客户端处理 429 错误

### React 示例

```typescript
async function fetchData() {
  try {
    const response = await fetch('/api/products');

    if (response.status === 429) {
      const error = await response.json();
      const retryAfter = response.headers.get('Retry-After');

      toast.error(`请求过于频繁，请 ${retryAfter} 秒后重试`);
      return;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('请求失败:', error);
  }
}
```

### Axios 拦截器

```typescript
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      toast.error(`请求过于频繁，请 ${retryAfter} 秒后重试`);
    }
    return Promise.reject(error);
  }
);
```

## 测试

```bash
# 运行测试
npx tsx scripts/test-rate-limit-standalone.ts
```

## 临时禁用（开发环境）

在 `.env.local` 中设置：

```env
RATE_LIMIT_ENABLED=false
```

## 故障排查

### 问题1: Redis 连接失败

**现象**: 日志显示 "Redis 不可用，使用内存存储"

**解决**:
- 检查 `REDIS_URL` 配置是否正确
- 确认 Redis 服务是否运行
- 开发环境可忽略，会自动降级到内存存储

### 问题2: 限制太严格

**现象**: 正常使用时频繁触发 429

**解决**: 调整环境变量中的限制值

```env
# 例如：将读取限制从 60 提高到 120
RATE_LIMIT_READ=120
```

### 问题3: 限制太宽松

**现象**: 担心被攻击

**解决**: 降低限制值，特别是认证相关 API

```env
# 更严格的登录限制
RATE_LIMIT_LOGIN=3
RATE_LIMIT_AUTH=3
```

## 监控建议

### 查看被限制的请求

在 API 代码中添加日志：

```typescript
export const POST = withRateLimit(RateLimitType.LOGIN)(
  async (request) => {
    // 如果走到这里，说明通过了速率限制
    console.log('请求通过速率限制检查');
    // ...
  }
);
```

被限制的请求会直接返回 429，不会进入处理函数。

### 检查限制状态

```typescript
import { getRateLimiter, RateLimitType } from '@/lib/rate-limit';

// 查询某个用户的剩余额度
const limiter = getRateLimiter(RateLimitType.READ);
const status = await limiter.getStatus('user:123');

console.log(`剩余: ${status.remaining}/${status.limit}`);
```

## 完整文档

详细文档请参考：
- **使用指南**: `lib/rate-limit/README.md`
- **实现总结**: `RATE_LIMIT_IMPLEMENTATION.md`

---

**提示**: 生产环境部署时，确保 Redis 正常运行以获得最佳性能和分布式支持。
