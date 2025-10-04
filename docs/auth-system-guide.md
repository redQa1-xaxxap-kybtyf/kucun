# 认证授权系统使用指南

本文档说明如何使用项目的统一认证授权系统。

## 📚 架构概览

### 核心模块

```
lib/auth/
├── context.ts         # 认证上下文封装
├── permissions.ts     # 声明式权限系统
└── api-helpers.ts     # API 认证辅助函数
```

### 数据流

```
1. 用户登录 → Next-Auth Session
2. Middleware → 注入 x-user-* 头到请求
3. API 路由 → 读取请求头获取用户信息
4. 权限检查 → can('resource:action')
5. 业务逻辑 → 执行
```

## 🔐 API 路由认证

### 方式一：使用 `withAuth` 包装器（推荐）

最简洁的方式，自动处理认证、权限和错误：

```typescript
import { type NextRequest } from 'next/server';
import { withAuth, successResponse } from '@/lib/auth/api-helpers';

// 基础认证
export const GET = withAuth(async (request, { user }) => {
  // user 已通过认证，可直接使用
  return successResponse({ userId: user.id });
});

// 需要特定权限
export const POST = withAuth(
  async (request, { user }) => {
    const body = await request.json();
    // 业务逻辑...
    return successResponse({ created: true });
  },
  { permissions: ['finance:manage'] }
);

// 需要管理员权限
export const DELETE = withAuth(
  async (request, { user }) => {
    // 业务逻辑...
    return successResponse({ deleted: true });
  },
  { requireAdmin: true }
);

// 需要任一权限
export const GET = withAuth(
  async (request, { user }) => {
    return successResponse({ data: [] });
  },
  { anyPermissions: ['finance:view', 'finance:manage'] }
);
```

### 方式二：手动认证（更灵活）

适合需要复杂权限逻辑的场景：

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAuthWithPermission, requireAdmin } from '@/lib/auth/api-helpers';
import { can } from '@/lib/auth/permissions';

export async function GET(request: NextRequest) {
  // 基础认证
  const user = requireAuth(request);

  // 或：认证 + 权限检查
  const user = requireAuthWithPermission(request, 'finance:view');

  // 或：要求管理员
  const admin = requireAdmin(request);

  // 或：自定义权限逻辑
  const user = requireAuth(request);
  if (!can(user, 'finance:manage') && user.id !== targetUserId) {
    return NextResponse.json(
      { error: '权限不足' },
      { status: 403 }
    );
  }

  // 业务逻辑...
  return NextResponse.json({ data: [] });
}
```

## 🎯 权限系统

### 权限定义

权限格式：`resource:action`

```typescript
// 财务权限
'finance:view'        // 查看财务数据
'finance:manage'      // 管理财务数据
'finance:export'      // 导出财务报表
'finance:approve'     // 审批财务单据

// 客户权限
'customers:view'      // 查看客户
'customers:create'    // 创建客户
'customers:edit'      // 编辑客户
'customers:delete'    // 删除客户

// 产品权限
'products:view'
'products:create'
'products:edit'
'products:delete'
'products:manage_price'

// 库存权限
'inventory:view'
'inventory:adjust'
'inventory:inbound'
'inventory:outbound'

// ... 更多权限见 lib/auth/permissions.ts
```

### 角色配置

当前支持的角色：

- **admin**: 拥有所有权限
- **sales**: 销售人员，核心业务权限
- **warehouse**: 仓库管理员，库存和发货权限
- **finance**: 财务人员，财务相关权限

### 权限检查

```typescript
import { can, canAny, canAll, requirePermission } from '@/lib/auth/permissions';

// 检查单个权限
if (can(user, 'finance:view')) {
  // 用户有查看财务权限
}

// 检查任一权限
if (canAny(user, ['finance:view', 'finance:manage'])) {
  // 用户有查看或管理财务权限之一
}

// 检查所有权限
if (canAll(user, ['finance:view', 'finance:export'])) {
  // 用户同时拥有查看和导出权限
}

// 要求权限（抛出错误）
requirePermission(user, 'finance:manage');
```

## 🖥️ 服务器组件认证

```typescript
import { getServerAuthContext, requireServerAuth } from '@/lib/auth/context';
import { redirect } from 'next/navigation';

export default async function Page() {
  // 方式1: 获取认证上下文
  const auth = await getServerAuthContext();
  if (!auth.isAuthenticated) {
    redirect('/auth/signin');
  }

  // 方式2: 要求认证（更简洁）
  const user = await requireServerAuth();

  return <div>Welcome {user.name}</div>;
}
```

## 💻 客户端组件认证

```typescript
'use client';

import { useSession } from 'next-auth/react';

export function ClientComponent() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'unauthenticated') return <div>Not logged in</div>;

  return <div>Welcome {session?.user.name}</div>;
}
```

## 📝 迁移现有 API 路由

### 旧代码

```typescript
import { verifyApiAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const auth = verifyApiAuth(request);
    if (!auth.success) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    // 业务逻辑...
    return NextResponse.json({ success: true, data: [] });
  } catch (error) {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
```

### 新代码

```typescript
import { withAuth, successResponse } from '@/lib/auth/api-helpers';

export const GET = withAuth(
  async (request, { user }) => {
    // 业务逻辑...
    return successResponse([]);
  },
  { permissions: ['finance:view'] } // 添加权限要求
);
```

### 迁移步骤

1. 将 `import` 从 `@/lib/api-helpers` 改为 `@/lib/auth/api-helpers`
2. 使用 `withAuth` 包装处理函数
3. 移除手动的认证检查代码
4. 移除 `try-catch` 块（`withAuth` 会自动处理）
5. 添加权限配置到 `withAuth` 选项

## 🔧 中间件配置

中间件自动注入用户信息到请求头：

```typescript
// lib/auth-middleware.ts
requestHeaders.set('x-user-id', token.sub || '');
requestHeaders.set('x-user-name', token.username || '');
requestHeaders.set('x-user-role', token.role || 'user');
```

API 路由通过这些头获取用户信息：

```typescript
// lib/auth/context.ts
export function getApiAuthContext(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const username = request.headers.get('x-user-name');
  const userRole = request.headers.get('x-user-role');
  // ...
}
```

## 🎨 最佳实践

### 1. API 路由始终使用 `withAuth`

```typescript
// ✅ 推荐
export const GET = withAuth(
  async (request, { user }) => {
    return successResponse({ data: [] });
  },
  { permissions: ['resource:view'] }
);

// ❌ 不推荐（除非有特殊需求）
export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  // ...
}
```

### 2. 权限检查尽早进行

```typescript
// ✅ 在 withAuth 配置中声明
export const POST = withAuth(
  async (request, { user }) => {
    // 业务逻辑...
  },
  { permissions: ['finance:manage'] }
);

// ❌ 在业务逻辑中检查
export const POST = withAuth(async (request, { user }) => {
  if (!can(user, 'finance:manage')) {
    return forbiddenResponse();
  }
  // 业务逻辑...
});
```

### 3. 使用类型安全的权限字符串

```typescript
import type { Permission } from '@/lib/auth/permissions';

// ✅ 类型安全
const permission: Permission = 'finance:view';

// ❌ 字符串字面量（可能拼写错误）
const permission = 'finanse:view';
```

### 4. 统一使用响应辅助函数

```typescript
import { successResponse, errorResponse } from '@/lib/auth/api-helpers';

// ✅ 推荐
return successResponse({ data: [] });
return errorResponse('参数错误', 400);

// ❌ 不推荐
return NextResponse.json({ success: true, data: [] });
return NextResponse.json({ error: '参数错误' }, { status: 400 });
```

## 🚀 完整示例

```typescript
// app/api/finance/receivables/route.ts
import { type NextRequest } from 'next/server';
import { withAuth, successResponse } from '@/lib/auth/api-helpers';
import { getReceivables } from '@/lib/services/receivables-service';
import { receivablesQuerySchema } from '@/lib/validations/finance';

/**
 * GET /api/finance/receivables
 * 权限：需要 finance:view 权限
 */
export const GET = withAuth(
  async (request, { user }) => {
    // 1. 参数验证
    const searchParams = new URL(request.url).searchParams;
    const params = receivablesQuerySchema.safeParse({
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
      search: searchParams.get('search') || undefined,
    });

    if (!params.success) {
      return successResponse(null, '参数验证失败');
    }

    // 2. 调用服务层
    const result = await getReceivables(params.data);

    // 3. 返回响应
    return successResponse(result);
  },
  { permissions: ['finance:view'] }
);

/**
 * POST /api/finance/receivables/export
 * 权限：需要 finance:export 权限
 */
export const POST = withAuth(
  async (request, { user }) => {
    const body = await request.json();
    // 导出逻辑...
    return successResponse({ exported: true }, '导出成功');
  },
  { permissions: ['finance:export'] }
);
```

## 📖 参考

- `lib/auth/context.ts` - 认证上下文 API
- `lib/auth/permissions.ts` - 权限定义和检查
- `lib/auth/api-helpers.ts` - API 辅助函数
- `lib/auth-middleware.ts` - 中间件实现
