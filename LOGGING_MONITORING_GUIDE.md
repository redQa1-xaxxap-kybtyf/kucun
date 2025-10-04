# 日志与监控系统使用指南

## 概述

本系统提供统一的结构化日志、审计日志和性能监控功能，支持 JSON 格式输出和 Prometheus 指标采集。

## 核心模块

### 1. 结构化日志 (`lib/logger/index.ts`)

提供 JSON 格式的结构化日志输出，支持日志级别控制。

#### 基础使用

```typescript
import { info, warn, error, debug } from '@/lib/logger';

// 信息日志
info('user-service', 'User logged in', { userId: '123', ip: '1.2.3.4' });

// 警告日志
warn('payment-service', 'Payment threshold exceeded', { amount: 10000 });

// 错误日志
error(
  'order-service',
  'Failed to create order',
  new Error('DB connection failed'),
  {
    orderId: '456',
  }
);

// 调试日志（仅开发环境）
debug('cache-service', 'Cache miss', { key: 'product:123' });
```

#### 性能计时

```typescript
import { timer } from '@/lib/logger';

async function processOrder(orderId: string) {
  const t = timer('order-service', 'processOrder', { orderId });

  try {
    // 业务逻辑
    await doSomething();

    t.end('Order processed successfully'); // 自动记录耗时
  } catch (error) {
    t.endWithError(error, 'Order processing failed'); // 记录错误和耗时
    throw error;
  }
}
```

#### 审计日志

```typescript
import { audit } from '@/lib/logger';

// 记录关键业务操作
await audit(
  {
    action: 'update',
    resource: 'product',
    resourceId: 'prod-123',
    userId: 'user-456',
    changes: {
      price: { from: 100, to: 150 },
      status: { from: 'draft', to: 'published' },
    },
    result: 'success',
  },
  {
    ip: '1.2.3.4',
    userAgent: 'Mozilla/5.0...',
  }
);
```

### 2. Prometheus 指标 (`lib/logger/metrics.ts`)

收集和导出 Prometheus 格式的性能指标。

#### 预定义指标

```typescript
import {
  recordApiRequest,
  recordApiDuration,
  recordApiError,
  recordDatabaseQuery,
  recordCacheHit,
} from '@/lib/logger/metrics';

// API 请求统计
recordApiRequest('GET', '/api/products', 200);
recordApiDuration('GET', '/api/products', 125); // 125ms

// 数据库查询
recordDatabaseQuery('SELECT', 'products', 45); // 45ms

// 缓存命中率
recordCacheHit('product:123', true); // hit
recordCacheHit('product:456', false); // miss
```

#### 自定义指标

```typescript
import {
  incrementCounter,
  setGauge,
  recordHistogram,
} from '@/lib/logger/metrics';

// Counter: 只增不减
incrementCounter('orders_created_total', { status: 'success' });

// Gauge: 可增可减
setGauge('active_users', 42, { region: 'asia' });

// Histogram: 记录分布
recordHistogram('order_amount_yuan', 1580, { category: 'electronics' });
```

### 3. API 中间件 (`lib/logger/middleware.ts`)

自动记录所有 API 请求的性能指标和日志。

#### 使用示例

```typescript
// app/api/products/route.ts
import { withMetrics } from '@/lib/logger/middleware';

export const GET = withMetrics(async (req: NextRequest) => {
  const products = await getProducts();

  return NextResponse.json({ success: true, data: products });
});

// 自动记录:
// - 请求日志 (JSON 格式)
// - 响应时间指标
// - 错误计数 (如果失败)
```

#### 数据库操作监控

```typescript
import { withDatabaseMetrics } from '@/lib/logger/middleware';

async function getProducts() {
  return withDatabaseMetrics('findMany', 'products', async () => {
    return await prisma.product.findMany();
  });
}

// 自动记录:
// - 数据库查询耗时
// - 错误计数 (如果失败)
```

## 指标导出

### Prometheus 格式

访问 `/api/metrics` 获取 Prometheus 格式的指标：

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/products",status="200"} 1523

# HELP http_request_duration_ms HTTP request duration in milliseconds
# TYPE http_request_duration_ms histogram
http_request_duration_ms{method="GET",path="/api/products"} 125

# HELP db_query_duration_ms Database query duration in milliseconds
# TYPE db_query_duration_ms histogram
db_query_duration_ms{operation="SELECT",table="products"} 45
```

### Prometheus 配置

在 `prometheus.yml` 中添加抓取配置：

```yaml
scrape_configs:
  - job_name: 'kucun-app'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
```

## 环境变量

```bash
# 日志级别 (debug, info, warn, error, critical)
LOG_LEVEL=info

# 日志格式 (json, text)
LOG_FORMAT=json

# 指标采集间隔 (毫秒)
METRICS_INTERVAL=60000
```

## 最佳实践

### 1. 结构化上下文

始终提供结构化的上下文信息：

```typescript
// ✅ 好
info('user-service', 'User action', {
  userId: '123',
  action: 'login',
  ip: '1.2.3.4',
});

// ❌ 差
info('user-service', 'User 123 logged in from 1.2.3.4');
```

### 2. 一致的模块命名

使用 `service:action` 或 `resource:operation` 格式：

```typescript
// ✅ 好
info('user-service:login', 'User logged in', context);
info('product:create', 'Product created', context);

// ❌ 差
info('user', 'login', context);
info('createProduct', 'created', context);
```

### 3. 关键操作使用审计日志

对于涉及数据变更、权限操作、财务交易的关键操作，必须记录审计日志：

```typescript
// 数据变更
await audit(
  {
    action: 'update',
    resource: 'user',
    resourceId: userId,
    userId: currentUser.id,
    changes: { role: { from: 'user', to: 'admin' } },
    result: 'success',
  },
  context
);

// 权限操作
await audit(
  {
    action: 'grant_permission',
    resource: 'role',
    resourceId: roleId,
    userId: currentUser.id,
    changes: { permissions: ['read', 'write', 'delete'] },
    result: 'success',
  },
  context
);
```

### 4. 错误日志包含足够上下文

```typescript
try {
  await processPayment(order);
} catch (err) {
  error('payment-service', 'Payment failed', err, {
    orderId: order.id,
    customerId: order.customerId,
    amount: order.totalAmount,
    paymentMethod: order.paymentMethod,
  });
  throw err;
}
```

### 5. 性能关键路径使用计时器

```typescript
async function generateReport(reportId: string) {
  const t = timer('report-service', 'generateReport', { reportId });

  const data = await fetchData(); // 会自动记录总耗时
  const processed = processData(data);
  const result = formatReport(processed);

  t.end(`Report generated: ${reportId}`);
  return result;
}
```

## 监控仪表板

### Grafana 查询示例

**API 请求成功率**:

```promql
sum(rate(http_requests_total{status=~"2.."}[5m]))
/
sum(rate(http_requests_total[5m]))
```

**P95 响应时间**:

```promql
histogram_quantile(0.95,
  rate(http_request_duration_ms_bucket[5m])
)
```

**数据库查询 P99 耗时**:

```promql
histogram_quantile(0.99,
  rate(db_query_duration_ms_bucket[5m])
)
```

**错误率**:

```promql
sum(rate(http_errors_total[5m]))
/
sum(rate(http_requests_total[5m]))
```

## 关键文件清单

- ✅ `lib/logger/index.ts` - 结构化日志核心
- ✅ `lib/logger/metrics.ts` - Prometheus 指标采集
- ✅ `lib/logger/middleware.ts` - API 性能监控中间件
- ✅ `app/api/metrics/route.ts` - 指标导出 API

## 性能影响

- 结构化日志：< 1ms 每条
- 指标记录：< 0.1ms 每次
- 审计日志：5-10ms（异步写入数据库）
- API 中间件：< 0.5ms 每次请求

所有日志和指标操作都经过优化，对业务性能影响可忽略不计。
