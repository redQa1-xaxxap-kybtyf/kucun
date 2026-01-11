# 📊 日志系统使用指南 - 快速参考

> 完整文档请查看：[LOGGING_GUIDE.md](./LOGGING_GUIDE.md)

---

## [object Object] 分钟快速上手

### 1. API Routes（推荐使用中间件）

```typescript
import { withMetrics } from '@/lib/logger/middleware';

export const GET = withMetrics(async (req: NextRequest) => {
  // 自动记录性能、状态码、错误
  const data = await fetchData();
  return NextResponse.json({ data });
});
```

### 2. Server Components

```typescript
import { logger } from '@/lib/logger';

export default async function Page() {
  logger.info('page:products', 'Rendering products page');

  try {
    const products = await fetchProducts();
    logger.info('page:products', 'Products loaded', { count: products.length });
    return <ProductList products={products} />;
  } catch (error) {
    logger.error('page:products', 'Failed to load products', error);
    return <ErrorPage />;
  }
}
```

### 3. Client Components

```typescript
import { clientLogger, logClientError } from '@/lib/logger/client';

export function ProductForm() {
  const handleSubmit = async (data: FormData) => {
    try {
      await submitForm(data);
      clientLogger.info('product-form', '表单提交成功');
    } catch (error) {
      // 自动上报到服务端
      await logClientError('product-form', '表单提交失败', error);
    }
  };
}
```

### 4. 命令行脚本

```typescript
import { logger } from '@/lib/logger';

async function main() {
  const timer = logger.timer('script', 'import-data');

  try {
    await importData();
    timer.end('数据导入完成');
  } catch (error) {
    timer.endWithError(error, '数据导入失败');
    process.exit(1);
  }
}
```

---

## 📋 快速迁移对照表

| 旧代码                           | 新代码                                           |
| -------------------------------- | ------------------------------------------------ |
| `console.log('User logged in')`  | `logger.info('auth', 'User logged in')`          |
| `console.error('Error:', error)` | `logger.error('auth', 'Login failed', error)`    |
| `console.warn('Deprecated')`     | `logger.warn('api', 'Using deprecated API')`     |
| `console.debug('Debug:', data)`  | `logger.debug('module', 'Debug info', { data })` |

---

## 🎯 核心概念

### 应用日志 vs 数据库日志

| 维度     | 应用日志（logger.\*） | 数据库日志（logUserAction 等） |
| -------- | --------------------- | ------------------------------ |
| **用途** | 调试、监控、性能      | 审计、合规、关键操作           |
| **存储** | Console / 日志文件    | SystemLog 表                   |
| **频率** | 高频                  | 低频                           |
| **示例** | API 请求、查询操作    | 用户登录、删除数据、修改价格   |

---

## ⚡ 常用函数速查

### 核心日志

```typescript
import { logger } from '@/lib/logger';

logger.debug('module', 'message', context, metadata);
logger.info('module', 'message', context, metadata);
logger.warn('module', 'message', context, metadata);
logger.error('module', 'message', error, context, metadata);
```

### 性能计时

```typescript
const timer = logger.timer('module', 'operation', context);
// ... 执行操作 ...
timer.end('操作完成'); // 或 timer.endWithError(error)
```

### 数据库日志

```typescript
import { logUserAction, extractRequestInfo } from '@/lib/logger';

const { ipAddress, userAgent } = extractRequestInfo(req);

await logUserAction('create_order', '创建订单', userId, ipAddress, userAgent, {
  orderId,
  amount,
});
```

### 客户端日志

```typescript
import { clientLogger, logClientError } from '@/lib/logger/client';

clientLogger.info('component', 'message', metadata);
await logClientError('component', 'error message', error, metadata);
```

---

## ⚠️ 重要提醒

### ❌ 永远不要记录

- 密码（明文或加密）
- Token / API Key
- 信用卡号
- 身份证号
- 完整手机号/邮箱（需脱敏）

### ✅ 应该记录

- 用户 ID
- 操作类型
- 业务数据（非敏感）
- 错误信息和堆栈
- 性能指标

---

## 📚 更多信息

- **完整文档：** [LOGGING_GUIDE.md](./LOGGING_GUIDE.md)
- **源代码：** `lib/logger/` 目录
- **类型定义：** `lib/types/settings.ts`
- **数据库表：** `SystemLog` 表

---

**版本：** 1.0.0  
**更新日期：** 2025-11-18
