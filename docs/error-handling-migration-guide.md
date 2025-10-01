# 统一错误处理中间件迁移指南

> 如何将现有 API 路由迁移到新的统一错误处理系统

## 📋 目录

1. [快速开始](#快速开始)
2. [迁移步骤](#迁移步骤)
3. [代码示例](#代码示例)
4. [常见问题](#常见问题)
5. [最佳实践](#最佳实践)

---

## 🚀 快速开始

### 新的错误处理系统包含

1. **统一错误类型** (`lib/api/errors.ts`)
   - `ApiError` - 自定义错误类
   - `ApiErrorType` - 错误类型枚举
   - 错误处理工具函数

2. **统一错误处理中间件** (`lib/api/middleware.ts`)
   - `withErrorHandling` - 自动捕获和处理错误
   - 自动错误分类和日志
   - 标准化错误响应格式

3. **标准化错误响应格式**
   ```typescript
   {
     success: false,
     error: {
       type: 'VALIDATION_ERROR',
       message: '数据验证失败',
       details: [...],  // 仅开发环境
       errorId: 'err_abc123',
       timestamp: '2025-10-01T12:00:00.000Z'
     }
   }
   ```

---

## 📝 迁移步骤

### 步骤 1: 移除 try-catch 块

**迁移前**:

```typescript
export async function GET(request: NextRequest) {
  try {
    // 验证权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 业务逻辑
    const data = await fetchData();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}
```

**迁移后**:

```typescript
import { withErrorHandling } from '@/lib/api/middleware';
import { ApiError } from '@/lib/api/errors';
import { successResponse } from '@/lib/api/response';

export const GET = withErrorHandling(async (request, context) => {
  // 验证权限
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw ApiError.unauthorized();
  }

  // 业务逻辑
  const data = await fetchData();

  return successResponse(data);
});
```

---

### 步骤 2: 使用 ApiError 抛出业务错误

**迁移前**:

```typescript
if (!product) {
  return NextResponse.json(
    { success: false, error: '产品不存在' },
    { status: 404 }
  );
}

if (quantity < 1) {
  return NextResponse.json(
    { success: false, error: '数量必须大于0' },
    { status: 400 }
  );
}
```

**迁移后**:

```typescript
if (!product) {
  throw ApiError.notFound('产品');
}

if (quantity < 1) {
  throw ApiError.badRequest('数量必须大于0');
}
```

---

### 步骤 3: 移除手动验证错误处理

**迁移前**:

```typescript
const validationResult = schema.safeParse(data);
if (!validationResult.success) {
  return NextResponse.json(
    {
      success: false,
      error: '数据验证失败',
      details: validationResult.error.errors,
    },
    { status: 400 }
  );
}
```

**迁移后**:

```typescript
// 直接使用 parse，错误会被自动捕获和处理
const validatedData = schema.parse(data);
```

---

## 💡 代码示例

### 示例 1: 简单的 GET 请求

```typescript
import { NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    throw ApiError.badRequest('缺少产品ID');
  }

  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    throw ApiError.notFound('产品');
  }

  return successResponse(product);
});
```

---

### 示例 2: POST 请求with验证

```typescript
import { NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db';
import { productCreateSchema } from '@/lib/validations/product';

export const POST = withErrorHandling(async (request: NextRequest) => {
  // 1. 解析请求体
  const body = await request.json();

  // 2. 验证数据（错误会自动处理）
  const validatedData = productCreateSchema.parse(body);

  // 3. 检查业务规则
  const existingProduct = await prisma.product.findFirst({
    where: { sku: validatedData.sku },
  });

  if (existingProduct) {
    throw ApiError.badRequest('SKU已存在');
  }

  // 4. 创建产品
  const product = await prisma.product.create({
    data: validatedData,
  });

  return successResponse(product, 201);
});
```

---

### 示例 3: 带权限验证的 DELETE 请求

```typescript
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { ApiError } from '@/lib/api/errors';
import { authOptions } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db';

export const DELETE = withErrorHandling(
  async (request: NextRequest, context) => {
    // 1. 验证权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw ApiError.unauthorized();
    }

    // 2. 获取参数
    const id = context.params?.id;
    if (!id) {
      throw ApiError.badRequest('缺少产品ID');
    }

    // 3. 检查产品是否存在
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw ApiError.notFound('产品');
    }

    // 4. 检查是否可以删除
    const hasOrders = await prisma.salesOrder.count({
      where: { items: { some: { productId: id } } },
    });

    if (hasOrders > 0) {
      throw ApiError.badRequest('产品已被订单使用，无法删除');
    }

    // 5. 删除产品
    await prisma.product.delete({
      where: { id },
    });

    return successResponse({ message: '删除成功' });
  }
);
```

---

### 示例 4: 批量操作with事务

```typescript
import { NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const { productIds } = body;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    throw ApiError.badRequest('产品ID列表不能为空');
  }

  // 使用事务批量删除
  const result = await prisma.$transaction(async tx => {
    // 检查所有产品是否存在
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      throw ApiError.notFound('部分产品不存在');
    }

    // 批量删除
    const deleteResult = await tx.product.deleteMany({
      where: { id: { in: productIds } },
    });

    return deleteResult;
  });

  return successResponse({
    message: '批量删除成功',
    count: result.count,
  });
});
```

---

## ❓ 常见问题

### Q1: 如何抛出自定义错误？

**A**: 使用 `ApiError` 类的静态方法：

```typescript
// 400 错误
throw ApiError.badRequest('错误消息');

// 401 错误
throw ApiError.unauthorized();

// 403 错误
throw ApiError.forbidden();

// 404 错误
throw ApiError.notFound('资源名称');

// 422 验证错误
throw ApiError.validationError('验证失败', details);

// 500 内部错误
throw ApiError.internalError('内部错误', details);
```

---

### Q2: 如何处理 Zod 验证错误？

**A**: 直接使用 `parse()`，错误会自动处理：

```typescript
// ✅ 推荐：直接使用 parse
const validatedData = schema.parse(data);

// ❌ 不推荐：手动处理 safeParse
const result = schema.safeParse(data);
if (!result.success) {
  // 手动处理错误...
}
```

---

### Q3: 如何在错误响应中包含详细信息？

**A**: 使用 `details` 参数：

```typescript
throw ApiError.badRequest('操作失败', {
  field: 'email',
  reason: '邮箱格式不正确',
  value: 'invalid-email',
});
```

**注意**: `details` 仅在开发环境显示，生产环境会被隐藏。

---

### Q4: 如何追踪错误？

**A**: 每个错误响应都包含 `errorId`：

```typescript
{
  success: false,
  error: {
    type: 'INTERNAL_ERROR',
    message: '服务器内部错误',
    errorId: 'err_abc123',  // 用于追踪
    timestamp: '2025-10-01T12:00:00.000Z'
  }
}
```

在日志中搜索 `errorId` 可以找到完整的错误信息。

---

## ✅ 最佳实践

### 1. 使用语义化的错误类型

```typescript
// ✅ 好
throw ApiError.notFound('产品');
throw ApiError.badRequest('数量必须大于0');

// ❌ 不好
throw new Error('产品不存在');
throw new Error('数量错误');
```

---

### 2. 提供清晰的错误消息

```typescript
// ✅ 好
throw ApiError.badRequest('SKU已存在，请使用其他SKU');

// ❌ 不好
throw ApiError.badRequest('错误');
```

---

### 3. 在开发环境提供详细信息

```typescript
// ✅ 好
throw ApiError.badRequest('数据验证失败', {
  field: 'email',
  value: userInput,
  expected: 'valid email format',
});

// ❌ 不好
throw ApiError.badRequest('数据验证失败');
```

---

### 4. 使用事务处理复杂操作

```typescript
// ✅ 好
await prisma.$transaction(async tx => {
  // 多个数据库操作
  // 任何错误都会回滚
});

// ❌ 不好
await prisma.operation1();
await prisma.operation2(); // 如果失败，operation1不会回滚
```

---

### 5. 避免在循环中抛出错误

```typescript
// ✅ 好
const invalidIds = ids.filter(id => !isValid(id));
if (invalidIds.length > 0) {
  throw ApiError.badRequest('存在无效ID', { invalidIds });
}

// ❌ 不好
for (const id of ids) {
  if (!isValid(id)) {
    throw ApiError.badRequest(`ID ${id} 无效`);
  }
}
```

---

## 📊 迁移进度追踪

### 优先级

- **P0 (立即)**: 高频 API（产品、库存、订单）
- **P1 (本周)**: 中频 API（客户、供应商、财务）
- **P2 (下周)**: 低频 API（设置、日志）

### 迁移清单

- [ ] 产品管理 API (10个路由)
- [ ] 库存管理 API (8个路由)
- [ ] 订单管理 API (12个路由)
- [ ] 客户管理 API (6个路由)
- [ ] 供应商管理 API (6个路由)
- [ ] 财务管理 API (14个路由)
- [ ] 系统设置 API (8个路由)

---

**文档版本**: v1.0  
**最后更新**: 2025-10-01  
**维护者**: 开发团队
