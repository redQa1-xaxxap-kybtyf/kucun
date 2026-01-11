# 📊 日志系统使用指南

> **版本：** 1.0.0
> **更新日期：** 2025-11-18
> **适用范围：** 全栈 Next.js 项目

---

## 📑 目录

- [1. 概述](#1-概述)
- [2. 快速开始](#2-快速开始)
  - [2.1 API Routes](#21-api-routes)
  - [2.2 Server Components](#22-server-components)
  - [2.3 Client Components](#23-client-components)
  - [2.4 命令行脚本](#24-命令行脚本)
- [3. 核心功能](#3-核心功能)
  - [3.1 日志级别](#31-日志级别)
  - [3.2 结构化上下文](#32-结构化上下文)
  - [3.3 性能计时器](#33-性能计时器)
  - [3.4 审计日志](#34-审计日志)
  - [3.5 数据库日志](#35-数据库日志)
- [4. 迁移指南](#4-迁移指南)
  - [4.1 对照表](#41-对照表)
  - [4.2 迁移示例](#42-迁移示例)
- [5. 最佳实践](#5-最佳实践)
  - [5.1 应用日志 vs 数据库日志](#51-应用日志-vs-数据库日志)
  - [5.2 关键业务操作](#52-关键业务操作)
  - [5.3 敏感信息处理](#53-敏感信息处理)
  - [5.4 性能监控](#54-性能监控)
  - [5.5 错误日志](#55-错误日志)
- [6. API 参考](#6-api-参考)
  - [6.1 核心日志函数](#61-核心日志函数)
  - [6.2 数据库日志函数](#62-数据库日志函数)
  - [6.3 客户端日志函数](#63-客户端日志函数)
  - [6.4 性能监控](#64-性能监控)
  - [6.5 Prometheus 指标](#65-prometheus-指标)
- [7. 常见问题](#7-常见问题)

---

## 1. 概述

本项目采用**企业级分层日志系统**，提供以下能力：

### 🎯 核心特性

| 特性            | 说明                                        |
| --------------- | ------------------------------------------- |
| **结构化日志**  | JSON 格式输出，便于日志分析和检索           |
| **多级别控制**  | debug、info、warn、error、critical 五个级别 |
| **双层架构**    | 应用日志（console）+ 审计日志（数据库）     |
| **性能监控**    | 内置 Timer 和 Prometheus 指标采集           |
| **客户端支持**  | 浏览器错误自动上报到服务端                  |
| **IP 地理位置** | 自动解析 IP 的国家、省份、城市              |
| **类型安全**    | 完整的 TypeScript 类型定义                  |

### 📦 模块结构

```
lib/
├── logger.ts                    # 高层封装：数据库日志 + 业务日志
└── logger/
    ├── index.ts                 # 核心日志系统（结构化日志）
    ├── client.ts                # 客户端日志工具
    ├── middleware.ts            # API 性能监控中间件
    └── metrics.ts               # Prometheus 指标采集系统
```

---

## 2. 快速开始

### 2.1 API Routes

#### 基础用法

```typescript
// app/api/users/route.ts
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  logger.info('api:users', 'Fetching users list', {
    method: req.method,
    path: '/api/users',
  });

  try {
    const users = await fetchUsers();

    logger.info('api:users', 'Users fetched successfully', {
      count: users.length,
    });

    return NextResponse.json({ users });
  } catch (error) {
    logger.error('api:users', 'Failed to fetch users', error, {
      method: req.method,
      path: '/api/users',
    });

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

#### 使用性能监控中间件（推荐）

```typescript
// app/api/users/route.ts
import { withMetrics } from '@/lib/logger/middleware';
import { NextRequest, NextResponse } from 'next/server';

export const GET = withMetrics(async (req: NextRequest) => {
  // withMetrics 自动记录：
  // - 请求时间
  // - 响应状态码
  // - 错误信息
  // - Prometheus 指标

  const users = await fetchUsers();
  return NextResponse.json({ users });
});
```

#### 使用数据库审计日志

```typescript
// app/api/users/[id]/route.ts
import { logUserAction, extractRequestInfo } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  const { ipAddress, userAgent } = extractRequestInfo(req);

  try {
    await deleteUser(params.id);

    // 记录到数据库（SystemLog 表）
    await logUserAction(
      'delete_user',
      `删除用户 ${params.id}`,
      session?.user?.id,
      ipAddress,
      userAgent,
      { deletedUserId: params.id }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
```

### 2.2 Server Components

```typescript
// app/products/page.tsx
import { logger } from '@/lib/logger';

export default async function ProductsPage() {
  logger.info('page:products', 'Rendering products page');

  try {
    const products = await fetchProducts();

    logger.info('page:products', 'Products loaded', {
      count: products.length,
    });

    return (
      <div>
        <h1>产品列表</h1>
        {/* ... */}
      </div>
    );
  } catch (error) {
    logger.error('page:products', 'Failed to load products', error);
    return <div>加载失败</div>;
  }
}
```

### 2.3 Client Components

```typescript
// components/ProductForm.tsx
'use client';

import { clientLogger, logClientError } from '@/lib/logger/client';
import { useState } from 'react';

export function ProductForm() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: ProductData) => {
    clientLogger.info('product-form', '提交产品表单', {
      productName: data.name,
    });

    try {
      setLoading(true);
      const response = await fetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('提交失败');
      }

      clientLogger.info('product-form', '产品创建成功');
    } catch (error) {
      // 错误会自动上报到服务端 /api/logs/report
      await logClientError(
        'product-form',
        '产品创建失败',
        error,
        { productName: data.name }
      );
    } finally {
      setLoading(false);
    }
  };

  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
}
```

### 2.4 命令行脚本

```typescript
// scripts/import-data.ts
import { logger } from '@/lib/logger';

async function main() {
  logger.info('script:import', '开始导入数据');

  const timer = logger.timer('script:import', 'data-import');

  try {
    const data = await loadDataFromFile();
    logger.info('script:import', '数据加载完成', {
      recordCount: data.length,
    });

    for (const record of data) {
      await importRecord(record);
    }

    const duration = timer.end('数据导入完成');
    logger.info('script:import', `导入成功，耗时 ${duration}ms`);
  } catch (error) {
    timer.endWithError(error, '数据导入失败');
    process.exit(1);
  }
}

main();
```

---

## 3. 核心功能

### 3.1 日志级别

项目支持 5 个日志级别，按严重程度递增：

| 级别         | 使用场景             | 示例                               |
| ------------ | -------------------- | ---------------------------------- |
| **debug**    | 调试信息，仅开发环境 | 变量值、函数调用、中间状态         |
| **info**     | 正常业务流程         | 用户登录、订单创建、数据查询       |
| **warn**     | 警告信息，不影响功能 | 参数缺失、降级处理、重试操作       |
| **error**    | 错误信息，功能受影响 | API 调用失败、数据库错误、验证失败 |
| **critical** | 严重错误，系统级问题 | 数据库连接断开、服务崩溃、数据损坏 |

#### 示例

```typescript
import { logger } from '@/lib/logger';

// debug - 调试信息
logger.debug('payment-service', '计算订单金额', {
  subtotal: 1000,
  tax: 100,
  total: 1100,
});

// info - 正常流程
logger.info('payment-service', '订单支付成功', {
  orderId: 'order_123',
  amount: 1100,
});

// warn - 警告信息
logger.warn('payment-service', '支付网关响应慢', {
  duration: 5000,
  gateway: 'alipay',
});

// error - 错误信息
logger.error('payment-service', '支付失败', error, {
  orderId: 'order_123',
  errorCode: 'INSUFFICIENT_BALANCE',
});

// critical - 严重错误
logger.error('payment-service', '数据库连接丢失', error, {
  database: 'postgresql',
  retryCount: 3,
});
```

#### 环境配置

通过环境变量控制日志级别：

```bash
# .env
LOG_LEVEL=info        # 只输出 info 及以上级别
LOG_FORMAT=json       # json 或 text
```

---

### 3.2 结构化上下文

使用 `LogContext` 提供结构化的上下文信息，便于日志检索和分析。

#### LogContext 类型定义

```typescript
interface LogContext {
  userId?: string; // 用户 ID
  requestId?: string; // 请求 ID（用于链路追踪）
  ip?: string; // IP 地址
  userAgent?: string; // User-Agent
  path?: string; // 请求路径
  method?: string; // HTTP 方法
  [key: string]: string | number | boolean | undefined | null;
}
```

#### 最佳实践

```typescript
import { logger } from '@/lib/logger';

// ✅ 好的做法：提供丰富的上下文
logger.info('order-service', '创建订单', {
  userId: 'user_123',
  orderId: 'order_456',
  totalAmount: 1500,
  itemCount: 3,
  paymentMethod: 'alipay',
});

// ❌ 不好的做法：缺少上下文
logger.info('order-service', '创建订单');

// ✅ 好的做法：错误日志包含完整上下文
logger.error('order-service', '订单创建失败', error, {
  userId: 'user_123',
  requestData: JSON.stringify(orderData),
  validationErrors: errors,
});

// ❌ 不好的做法：错误日志缺少上下文
logger.error('order-service', '订单创建失败', error);
```

---

### 3.3 性能计时器

使用 `Timer` 类自动记录操作耗时。

#### 基础用法

```typescript
import { logger } from '@/lib/logger';

async function processOrder(orderId: string) {
  // 创建计时器
  const timer = logger.timer('order-service', 'process-order', {
    orderId,
  });

  try {
    await validateOrder(orderId);
    await calculateTotal(orderId);
    await updateInventory(orderId);

    // 成功时停止计时
    const duration = timer.end('订单处理完成');
    logger.info('order-service', `订单处理耗时 ${duration}ms`);
  } catch (error) {
    // 失败时停止计时并记录错误
    timer.endWithError(error, '订单处理失败');
    throw error;
  }
}
```

#### 输出示例

```json
{
  "timestamp": "2025-11-18T11:09:02.576Z",
  "level": "info",
  "module": "order-service",
  "message": "订单处理完成",
  "context": {
    "orderId": "order_123"
  },
  "duration": 245
}
```

---

### 3.4 审计日志

使用 `audit()` 记录关键业务操作的审计追踪。

#### 使用场景

- 数据修改（创建、更新、删除）
- 权限变更
- 财务操作
- 敏感数据访问

#### 示例

```typescript
import { audit } from '@/lib/logger';

async function updateProduct(productId: string, changes: ProductUpdate) {
  const oldProduct = await getProduct(productId);

  try {
    const newProduct = await prisma.product.update({
      where: { id: productId },
      data: changes,
    });

    // 记录审计日志
    await audit(
      {
        action: 'update',
        resource: 'product',
        resourceId: productId,
        userId: session.user.id,
        changes: {
          old: { name: oldProduct.name, price: oldProduct.price },
          new: { name: newProduct.name, price: newProduct.price },
        },
        result: 'success',
      },
      {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
      }
    );

    return newProduct;
  } catch (error) {
    await audit(
      {
        action: 'update',
        resource: 'product',
        resourceId: productId,
        userId: session.user.id,
        result: 'failure',
        reason: error.message,
      },
      {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
      }
    );
    throw error;
  }
}
```

#### 审计日志存储

审计日志会：

1. 输出到应用日志（console）
2. 写入数据库（SystemLog 表）

---

### 3.5 数据库日志

数据库日志会持久化到 `SystemLog` 表，支持后续查询和分析。

#### 可用函数

| 函数                     | 用途     | 日志类型           |
| ------------------------ | -------- | ------------------ |
| `logUserAction()`        | 用户操作 | user_action        |
| `logBusinessOperation()` | 业务操作 | business_operation |
| `logSystemEventInfo()`   | 系统事件 | system_event       |
| `logError()`             | 错误记录 | error              |
| `logSecurityEvent()`     | 安全事件 | security           |

#### 示例：用户操作日志

```typescript
import { logUserAction, extractRequestInfo } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const session = await auth();
  const { ipAddress, userAgent } = extractRequestInfo(req);

  const data = await req.json();
  const order = await createOrder(data);

  // 记录用户操作
  await logUserAction(
    'create_order',
    `创建订单 ${order.orderNumber}`,
    session?.user?.id,
    ipAddress,
    userAgent,
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
    }
  );

  return NextResponse.json({ order });
}
```

#### 示例：安全事件日志

```typescript
import { logSecurityEvent } from '@/lib/logger';

async function handleLogin(credentials: Credentials, req: Request) {
  const { ipAddress, userAgent } = extractRequestInfo(req);

  try {
    const user = await authenticate(credentials);

    await logSecurityEvent(
      'login_success',
      `用户 ${user.email} 登录成功`,
      'info',
      user.id,
      ipAddress,
      userAgent
    );

    return user;
  } catch (error) {
    await logSecurityEvent(
      'login_failure',
      `登录失败：${credentials.email}`,
      'warning',
      null,
      ipAddress,
      userAgent,
      { email: credentials.email, reason: error.message }
    );
    throw error;
  }
}
```

---

## 4. 迁移指南

### 4.1 对照表

#### console.log → logger.info

| 旧代码                                   | 新代码                                                  |
| ---------------------------------------- | ------------------------------------------------------- |
| `console.log('User logged in')`          | `logger.info('auth', 'User logged in')`                 |
| `console.log('Order created:', orderId)` | `logger.info('order', 'Order created', { orderId })`    |
| `console.log('Processing...', data)`     | `logger.info('processor', 'Processing data', { data })` |

#### console.error → logger.error

| 旧代码                                            | 新代码                                              |
| ------------------------------------------------- | --------------------------------------------------- |
| `console.error('Error:', error)`                  | `logger.error('module', 'Error occurred', error)`   |
| `console.error('Failed to save:', error.message)` | `logger.error('database', 'Failed to save', error)` |
| `console.error('API call failed')`                | `logger.error('api', 'API call failed', error)`     |

#### console.warn → logger.warn

| 旧代码                                      | 新代码                                                     |
| ------------------------------------------- | ---------------------------------------------------------- |
| `console.warn('Deprecated API')`            | `logger.warn('api', 'Using deprecated API')`               |
| `console.warn('Missing parameter:', param)` | `logger.warn('validator', 'Missing parameter', { param })` |

#### console.debug → logger.debug

| 旧代码                               | 新代码                                           |
| ------------------------------------ | ------------------------------------------------ |
| `console.debug('Debug info:', data)` | `logger.debug('module', 'Debug info', { data })` |

---

### 4.2 迁移示例

#### 示例 1：简单日志迁移

**迁移前：**

```typescript
// scripts/import-products.ts
console.log('开始导入产品数据');
const products = await loadProducts();
console.log(`加载了 ${products.length} 个产品`);

try {
  await importProducts(products);
  console.log('导入成功');
} catch (error) {
  console.error('导入失败:', error);
  process.exit(1);
}
```

**迁移后：**

```typescript
// scripts/import-products.ts
import { logger } from '@/lib/logger';

logger.info('script:import-products', '开始导入产品数据');
const products = await loadProducts();
logger.info('script:import-products', '产品数据加载完成', {
  count: products.length,
});

try {
  await importProducts(products);
  logger.info('script:import-products', '产品导入成功', {
    count: products.length,
  });
} catch (error) {
  logger.error('script:import-products', '产品导入失败', error, {
    count: products.length,
  });
  process.exit(1);
}
```

---

#### 示例 2：API Route 迁移

**迁移前：**

```typescript
// app/api/products/route.ts
export async function GET(req: NextRequest) {
  console.log('Fetching products');

  try {
    const products = await prisma.product.findMany();
    console.log(`Found ${products.length} products`);
    return NextResponse.json({ products });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

**迁移后（方案 1：手动日志）：**

```typescript
// app/api/products/route.ts
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const timer = logger.timer('api:products', 'GET /api/products');

  try {
    const products = await prisma.product.findMany();

    timer.end();
    logger.info('api:products', '产品列表查询成功', {
      count: products.length,
    });

    return NextResponse.json({ products });
  } catch (error) {
    timer.endWithError(error);
    logger.error('api:products', '产品列表查询失败', error);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

**迁移后（方案 2：使用中间件，推荐）：**

```typescript
// app/api/products/route.ts
import { withMetrics } from '@/lib/logger/middleware';

export const GET = withMetrics(async (req: NextRequest) => {
  // withMetrics 自动处理日志和性能监控
  const products = await prisma.product.findMany();
  return NextResponse.json({ products });
});
```

---

#### 示例 3：错误处理迁移

**迁移前：**

```typescript
async function processPayment(orderId: string) {
  try {
    const order = await getOrder(orderId);
    console.log('Processing payment for order:', orderId);

    const result = await paymentGateway.charge(order.amount);
    console.log('Payment successful:', result.transactionId);

    return result;
  } catch (error) {
    console.error('Payment failed:', error);
    console.error('Order ID:', orderId);
    throw error;
  }
}
```

**迁移后：**

```typescript
import { logger } from '@/lib/logger';

async function processPayment(orderId: string) {
  const timer = logger.timer('payment-service', 'process-payment', {
    orderId,
  });

  try {
    const order = await getOrder(orderId);
    logger.info('payment-service', '开始处理支付', {
      orderId,
      amount: order.amount,
    });

    const result = await paymentGateway.charge(order.amount);

    timer.end();
    logger.info('payment-service', '支付成功', {
      orderId,
      transactionId: result.transactionId,
      amount: order.amount,
    });

    return result;
  } catch (error) {
    timer.endWithError(error);
    logger.error('payment-service', '支付失败', error, {
      orderId,
      errorCode: error.code,
    });
    throw error;
  }
}
```

---

#### 示例 4：数据库操作迁移

**迁移前：**

```typescript
async function createCustomer(data: CustomerData) {
  console.log('Creating customer:', data.name);

  try {
    const customer = await prisma.customer.create({
      data,
    });
    console.log('Customer created:', customer.id);
    return customer;
  } catch (error) {
    console.error('Failed to create customer:', error);
    throw error;
  }
}
```

**迁移后：**

```typescript
import { logger } from '@/lib/logger';
import { withDatabaseMetrics } from '@/lib/logger/middleware';

async function createCustomer(data: CustomerData) {
  logger.info('customer-service', '创建客户', {
    name: data.name,
    email: data.email,
  });

  try {
    const customer = await withDatabaseMetrics('create', 'customer', () =>
      prisma.customer.create({ data })
    );

    logger.info('customer-service', '客户创建成功', {
      customerId: customer.id,
      name: customer.name,
    });

    return customer;
  } catch (error) {
    logger.error('customer-service', '客户创建失败', error, {
      name: data.name,
      email: data.email,
    });
    throw error;
  }
}
```

---

## 5. 最佳实践

### 5.1 应用日志 vs 数据库日志

#### 何时使用应用日志（logger.info/error/warn）

✅ **适用场景：**

- 开发调试
- 性能监控
- 系统运行状态
- 临时信息
- 高频操作

```typescript
// ✅ 使用应用日志
logger.info('api:products', '查询产品列表', { count: 100 });
logger.debug('cache', '缓存命中', { key: 'products:all' });
logger.warn('api:orders', '响应时间过长', { duration: 3000 });
```

#### 何时使用数据库日志（logUserAction/logBusinessOperation）

✅ **适用场景：**

- 用户关键操作（登录、注册、修改密码）
- 业务操作（创建订单、修改价格、删除数据）
- 安全事件（登录失败、权限变更）
- 审计追踪（需要长期保存）
- 合规要求（法律法规要求）

```typescript
// ✅ 使用数据库日志
await logUserAction('delete_customer', '删除客户', userId, ip, userAgent, {
  customerId: customer.id,
  customerName: customer.name,
});

await logSecurityEvent('password_change', '用户修改密码', 'info', userId, ip);
```

#### 对比表

| 维度         | 应用日志             | 数据库日志       |
| ------------ | -------------------- | ---------------- |
| **存储位置** | Console / 日志文件   | SystemLog 表     |
| **性能影响** | 极小                 | 较小（异步写入） |
| **保留时间** | 短期（通常 7-30 天） | 长期（可配置）   |
| **查询能力** | 需要日志分析工具     | 可直接 SQL 查询  |
| **适用频率** | 高频                 | 低频             |
| **典型场景** | 调试、监控           | 审计、合规       |

---

### 5.2 关键业务操作

对于关键业务操作，建议**同时使用**应用日志和数据库日志。

```typescript
import { logger } from '@/lib/logger';
import { logBusinessOperation, extractRequestInfo } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const session = await auth();
  const { ipAddress, userAgent } = extractRequestInfo(req);
  const data = await req.json();

  // 应用日志：记录操作开始
  logger.info('api:orders', '开始创建订单', {
    userId: session.user.id,
    itemCount: data.items.length,
  });

  const timer = logger.timer('api:orders', 'create-order');

  try {
    const order = await createOrder(data);

    // 应用日志：记录性能
    const duration = timer.end();
    logger.info('api:orders', '订单创建成功', {
      orderId: order.id,
      duration,
    });

    // 数据库日志：记录业务操作（用于审计）
    await logBusinessOperation(
      'create_order',
      `创建订单 ${order.orderNumber}`,
      session.user.id,
      ipAddress,
      userAgent,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        itemCount: data.items.length,
      }
    );

    return NextResponse.json({ order });
  } catch (error) {
    timer.endWithError(error);
    logger.error('api:orders', '订单创建失败', error);
    throw error;
  }
}
```

---

### 5.3 敏感信息处理

⚠️ **永远不要记录敏感信息到日志！**

#### 敏感信息清单

- ❌ 密码（明文或加密）
- ❌ Token / API Key
- ❌ 信用卡号
- ❌ 身份证号
- ❌ 完整手机号（可记录脱敏后的）
- ❌ 完整邮箱（可记录脱敏后的）

#### 脱敏处理

```typescript
import { logger } from '@/lib/logger';

// ❌ 错误：记录敏感信息
logger.info('auth', '用户登录', {
  email: 'user@example.com',
  password: 'secret123', // 绝对不要这样做！
});

// ✅ 正确：脱敏处理
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

logger.info('auth', '用户登录', {
  email: maskEmail('user@example.com'), // us***@example.com
  phone: maskPhone('13812345678'), // 138****5678
});

// ✅ 正确：只记录非敏感信息
logger.info('auth', '用户登录成功', {
  userId: user.id,
  loginMethod: 'password',
  // 不记录密码、token 等
});
```

---

### 5.4 性能监控

#### 使用 Timer 监控关键操作

```typescript
import { logger } from '@/lib/logger';

async function complexOperation() {
  const timer = logger.timer('service', 'complex-operation');

  try {
    // 步骤 1
    const step1Timer = logger.timer('service', 'step-1');
    await step1();
    step1Timer.end('步骤 1 完成');

    // 步骤 2
    const step2Timer = logger.timer('service', 'step-2');
    await step2();
    step2Timer.end('步骤 2 完成');

    // 步骤 3
    const step3Timer = logger.timer('service', 'step-3');
    await step3();
    step3Timer.end('步骤 3 完成');

    timer.end('整体操作完成');
  } catch (error) {
    timer.endWithError(error);
    throw error;
  }
}
```

#### 使用 withMetrics 中间件

```typescript
import { withMetrics } from '@/lib/logger/middleware';

// 自动记录 API 性能指标
export const GET = withMetrics(async (req: NextRequest) => {
  // 业务逻辑
  return NextResponse.json({ data });
});
```

#### 使用 withDatabaseMetrics 监控数据库

```typescript
import { withDatabaseMetrics } from '@/lib/logger/middleware';

async function getCustomers() {
  return withDatabaseMetrics('findMany', 'customer', () =>
    prisma.customer.findMany()
  );
}
```

---

### 5.5 错误日志

#### 完整的错误上下文

```typescript
import { logger } from '@/lib/logger';

// ❌ 不好：缺少上下文
try {
  await processOrder(orderId);
} catch (error) {
  logger.error('order', '处理失败', error);
}

// ✅ 好：提供完整上下文
try {
  await processOrder(orderId);
} catch (error) {
  logger.error('order', '订单处理失败', error, {
    orderId,
    userId: session.user.id,
    step: 'payment',
    retryCount: 3,
    // 任何有助于调试的信息
  });
}
```

#### 错误分类

```typescript
import { logger } from '@/lib/logger';

try {
  await riskyOperation();
} catch (error) {
  if (error instanceof ValidationError) {
    // 验证错误：warn 级别
    logger.warn('service', '数据验证失败', {
      errors: error.errors,
    });
  } else if (error instanceof NetworkError) {
    // 网络错误：error 级别，可能需要重试
    logger.error('service', '网络请求失败', error, {
      url: error.url,
      retryable: true,
    });
  } else if (error instanceof DatabaseError) {
    // 数据库错误：critical 级别
    logger.error('service', '数据库错误', error, {
      query: error.query,
      critical: true,
    });
  } else {
    // 未知错误：error 级别
    logger.error('service', '未知错误', error);
  }
}
```

---

## 6. API 参考

### 6.1 核心日志函数

#### logger.debug()

调试级别日志，仅在开发环境输出。

```typescript
logger.debug(
  module: string,
  message: string,
  context?: LogContext,
  metadata?: Record<string, unknown>
): void
```

**示例：**

```typescript
logger.debug('payment-service', '计算订单金额', {
  subtotal: 1000,
  tax: 100,
  total: 1100,
});
```

---

#### logger.info()

信息级别日志，记录正常业务流程。

```typescript
logger.info(
  module: string,
  message: string,
  context?: LogContext,
  metadata?: Record<string, unknown>
): void
```

**示例：**

```typescript
logger.info('order-service', '订单创建成功', {
  orderId: 'order_123',
  userId: 'user_456',
  amount: 1500,
});
```

---

#### logger.warn()

警告级别日志，记录不影响功能的警告信息。

```typescript
logger.warn(
  module: string,
  message: string,
  context?: LogContext,
  metadata?: Record<string, unknown>
): void
```

**示例：**

```typescript
logger.warn('api:orders', '响应时间过长', {
  duration: 5000,
  threshold: 3000,
});
```

---

#### logger.error()

错误级别日志，记录影响功能的错误。

```typescript
logger.error(
  module: string,
  message: string,
  error?: Error | unknown,
  context?: LogContext,
  metadata?: Record<string, unknown>
): void
```

**示例：**

```typescript
logger.error('payment-service', '支付失败', error, {
  orderId: 'order_123',
  errorCode: 'INSUFFICIENT_BALANCE',
});
```

---

#### logger.timer()

创建性能计时器。

```typescript
logger.timer(
  module: string,
  operation: string,
  context?: LogContext
): Timer
```

**Timer 方法：**

```typescript
// 成功时停止计时
timer.end(message?: string): number

// 失败时停止计时
timer.endWithError(error: Error | unknown, message?: string): number
```

**示例：**

```typescript
const timer = logger.timer('order-service', 'process-order', {
  orderId: 'order_123',
});

try {
  await processOrder();
  const duration = timer.end('订单处理完成');
  console.log(`耗时：${duration}ms`);
} catch (error) {
  timer.endWithError(error, '订单处理失败');
}
```

---

### 6.2 数据库日志函数

#### logUserAction()

记录用户操作日志到数据库。

```typescript
async function logUserAction(
  action: string,
  description: string,
  userId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  metadata?: Record<string, unknown> | null
): Promise<void>;
```

**参数：**

- `action`: 操作类型（如 'create_order', 'delete_customer'）
- `description`: 操作描述
- `userId`: 用户 ID（可选）
- `ipAddress`: IP 地址（可选）
- `userAgent`: User-Agent（可选）
- `metadata`: 额外元数据（可选）

**示例：**

```typescript
await logUserAction(
  'create_order',
  '创建订单 ORD-2025-001',
  'user_123',
  '192.168.1.1',
  'Mozilla/5.0...',
  {
    orderId: 'order_456',
    orderNumber: 'ORD-2025-001',
    totalAmount: 1500,
  }
);
```

---

#### logBusinessOperation()

记录业务操作日志到数据库。

```typescript
async function logBusinessOperation(
  action: string,
  description: string,
  userId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  metadata?: Record<string, unknown> | null
): Promise<void>;
```

**示例：**

```typescript
await logBusinessOperation(
  'update_price',
  '修改产品价格',
  'user_123',
  '192.168.1.1',
  'Mozilla/5.0...',
  {
    productId: 'prod_789',
    oldPrice: 100,
    newPrice: 120,
  }
);
```

---

#### logError()

记录错误日志到数据库。

```typescript
async function logError(
  action: string,
  description: string,
  error?: Error | unknown,
  userId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<void>;
```

**示例：**

```typescript
await logError(
  'payment_failed',
  '支付处理失败',
  error,
  'user_123',
  '192.168.1.1',
  'Mozilla/5.0...'
);
```

---

#### logSecurityEvent()

记录安全事件日志到数据库。

```typescript
async function logSecurityEvent(
  action: string,
  description: string,
  level: 'warning' | 'error' | 'critical' = 'warning',
  userId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null,
  metadata?: Record<string, unknown> | null
): Promise<void>;
```

**示例：**

```typescript
await logSecurityEvent(
  'login_failure',
  '登录失败：密码错误',
  'warning',
  null,
  '192.168.1.1',
  'Mozilla/5.0...',
  { email: 'user@example.com', attemptCount: 3 }
);
```

---

#### extractRequestInfo()

从 Request 对象提取 IP 地址和 User-Agent。

```typescript
function extractRequestInfo(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
};
```

**示例：**

```typescript
export async function POST(req: NextRequest) {
  const { ipAddress, userAgent } = extractRequestInfo(req);

  await logUserAction(
    'create_order',
    '创建订单',
    session.user.id,
    ipAddress,
    userAgent
  );
}
```

---

### 6.3 客户端日志函数

#### clientLogger.info()

客户端信息日志（输出到浏览器 console）。

```typescript
clientLogger.info(
  module: string,
  message: string,
  metadata?: Record<string, unknown>
): void
```

**示例：**

```typescript
import { clientLogger } from '@/lib/logger/client';

clientLogger.info('product-form', '表单提交成功', {
  productId: 'prod_123',
});
```

---

#### clientLogger.error()

客户端错误日志（输出到浏览器 console）。

```typescript
clientLogger.error(
  module: string,
  message: string,
  errorObj?: Error | unknown,
  metadata?: Record<string, unknown>
): void
```

**示例：**

```typescript
import { clientLogger } from '@/lib/logger/client';

clientLogger.error('payment-form', '支付失败', error, {
  orderId: 'order_123',
});
```

---

#### logClientError()

客户端错误上报到服务端。

```typescript
async function logClientError(
  module: string,
  message: string,
  errorObj: unknown,
  metadata?: Record<string, unknown>
): Promise<void>;
```

**功能：**

1. 输出到浏览器 console
2. 发送到服务端 `/api/logs/report` 端点
3. 自动包含页面 URL

**示例：**

```typescript
import { logClientError } from '@/lib/logger/client';

try {
  await submitForm(data);
} catch (error) {
  // 错误会自动上报到服务端
  await logClientError('product-form', '表单提交失败', error, {
    formData: data,
  });
}
```

---

### 6.4 性能监控

#### withMetrics()

API Route 性能监控中间件。

```typescript
function withMetrics(handler: ApiHandler): ApiHandler;
```

**功能：**

- 自动记录请求时间
- 自动记录响应状态码
- 自动捕获错误
- 自动记录 Prometheus 指标

**示例：**

```typescript
import { withMetrics } from '@/lib/logger/middleware';

export const GET = withMetrics(async (req: NextRequest) => {
  const data = await fetchData();
  return NextResponse.json({ data });
});
```

---

#### withDatabaseMetrics()

数据库操作性能监控包装器。

```typescript
function withDatabaseMetrics<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T>;
```

**示例：**

```typescript
import { withDatabaseMetrics } from '@/lib/logger/middleware';

async function getCustomers() {
  return withDatabaseMetrics('findMany', 'customer', () =>
    prisma.customer.findMany()
  );
}
```

---

### 6.5 Prometheus 指标

#### recordApiRequest()

记录 API 请求计数。

```typescript
function recordApiRequest(
  method: string,
  path: string,
  statusCode: number
): void;
```

**示例：**

```typescript
import { promMetrics } from '@/lib/logger/metrics';

promMetrics.recordApiRequest('GET', '/api/products', 200);
```

---

#### recordApiDuration()

记录 API 响应时间。

```typescript
function recordApiDuration(
  method: string,
  path: string,
  duration: number
): void;
```

**示例：**

```typescript
promMetrics.recordApiDuration('GET', '/api/products', 250);
```

---

#### exportPrometheusMetrics()

导出 Prometheus 格式的指标。

```typescript
function exportPrometheusMetrics(): string;
```

**示例：**

```typescript
// app/api/metrics/route.ts
import { promMetrics } from '@/lib/logger/metrics';

export async function GET() {
  const metrics = promMetrics.exportPrometheusMetrics();
  return new Response(metrics, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
```

---

## 7. 常见问题

### Q1: 何时使用应用日志，何时使用数据库日志？

**A:**

- **应用日志**：用于调试、性能监控、系统运行状态（高频、临时）
- **数据库日志**：用于审计、合规、关键业务操作（低频、长期保存）

详见 [5.1 应用日志 vs 数据库日志](#51-应用日志-vs-数据库日志)

---

### Q2: 如何在客户端组件中使用日志？

**A:** 使用 `@/lib/logger/client` 模块：

```typescript
import { clientLogger, logClientError } from '@/lib/logger/client';

// 普通日志
clientLogger.info('component', '操作成功');

// 错误上报到服务端
await logClientError('component', '操作失败', error);
```

---

### Q3: 如何监控 API 性能？

**A:** 使用 `withMetrics` 中间件：

```typescript
import { withMetrics } from '@/lib/logger/middleware';

export const GET = withMetrics(async req => {
  // 自动记录性能指标
  return NextResponse.json({ data });
});
```

---

### Q4: 如何避免记录敏感信息？

**A:**

1. 永远不要记录密码、Token、API Key
2. 对邮箱、手机号进行脱敏处理
3. 只记录必要的业务信息

详见 [5.3 敏感信息处理](#53-敏感信息处理)

---

### Q5: 日志级别如何选择？

**A:**

- `debug`: 调试信息（开发环境）
- `info`: 正常业务流程
- `warn`: 警告信息（不影响功能）
- `error`: 错误信息（功能受影响）
- `critical`: 严重错误（系统级问题）

详见 [3.1 日志级别](#31-日志级别)

---

### Q6: 如何查看 Prometheus 指标？

**A:** 访问 `/api/metrics` 端点（需要先实现该端点）：

```typescript
// app/api/metrics/route.ts
import { promMetrics } from '@/lib/logger/metrics';

export async function GET() {
  const metrics = promMetrics.exportPrometheusMetrics();
  return new Response(metrics, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
```

---

### Q7: 如何从 console.log 迁移？

**A:** 参考 [4. 迁移指南](#4-迁移指南)，基本规则：

```typescript
// 旧代码
console.log('User logged in');
console.error('Error:', error);

// 新代码
logger.info('auth', 'User logged in');
logger.error('auth', 'Login failed', error);
```

---

### Q8: Timer 是否会影响性能？

**A:** 不会。Timer 使用 `performance.now()`，性能开销极小（微秒级）。

---

### Q9: 数据库日志写入失败会影响业务吗？

**A:** 不会。数据库日志写入是异步的，失败时只会输出错误日志，不会影响主要业务流程。

---

### Q10: 如何在脚本中使用日志？

**A:** 直接导入 logger：

```typescript
import { logger } from '@/lib/logger';

async function main() {
  logger.info('script', '脚本开始执行');

  const timer = logger.timer('script', 'main-operation');

  try {
    await doWork();
    timer.end('脚本执行完成');
  } catch (error) {
    timer.endWithError(error, '脚本执行失败');
    process.exit(1);
  }
}

main();
```

---

## 📚 相关资源

- **源代码：** `lib/logger/` 目录
- **类型定义：** `lib/types/settings.ts`
- **数据库表：** `SystemLog` 表（Prisma Schema）
- **环境变量：** `LOG_LEVEL`, `LOG_FORMAT`

---

## 🎯 下一步

1. **阅读本文档**：了解日志系统的使用方法
2. **查看示例代码**：参考迁移示例
3. **开始迁移**：从新代码开始使用 logger
4. **逐步替换**：渐进式替换旧代码中的 console.\*
5. **添加监控**：使用 withMetrics 中间件监控 API 性能

---

**文档版本：** 1.0.0
**最后更新：** 2025-11-18
**维护者：** 开发团队
