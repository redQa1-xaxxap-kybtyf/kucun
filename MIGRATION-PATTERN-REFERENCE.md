# API 认证系统迁移模式参考

## 快速迁移指南

### 第 1 步: 更新导入语句

**之前:**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, verifyApiAuth } from '@/lib/api-helpers';
```

**之后:**

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { successResponse, withAuth } from '@/lib/auth/api-helpers';
```

### 第 2 步: 转换函数签名

#### GET 路由示例

**之前:**

```typescript
export async function GET(request: NextRequest) {
  try {
    const auth = verifyApiAuth(request);
    if (!auth.success) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    // 业务逻辑
    const data = await fetchData();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

**之后:**

```typescript
export const GET = withAuth(
  async (request: NextRequest, { user }) => {
    // 业务逻辑 (user.id 可直接使用)
    const data = await fetchData();

    return successResponse(data);
  },
  { permissions: ['resource:view'] }
);
```

### 第 3 步: 配置权限

根据资源类型和操作选择合适的权限：

#### 产品权限

- GET: `{ permissions: ['products:view'] }`
- POST: `{ permissions: ['products:create'] }`
- PUT/PATCH: `{ permissions: ['products:edit'] }`
- DELETE: `{ permissions: ['products:delete'] }`

#### 库存权限

- GET (查询): `{ permissions: ['inventory:view'] }`
- POST (入库): `{ permissions: ['inventory:inbound'] }`
- POST (出库): `{ permissions: ['inventory:outbound'] }`
- POST (调整): `{ permissions: ['inventory:adjust'] }`

#### 财务权限

- GET: `{ permissions: ['finance:view'] }`
- POST: `{ permissions: ['finance:manage'] }`

### 第 4 步: 处理用户 ID

**之前:**

```typescript
const auth = verifyApiAuth(request);
const userId = auth.userId;
```

**之后:**

```typescript
async (request: NextRequest, { user }) => {
  const userId = user.id;
};
```

### 第 5 步: 移除不必要的代码

**删除:**

1. try-catch 块（withAuth 自动处理）
2. 认证检查代码
3. verifyApiAuth 调用
4. errorResponse 错误处理
5. 手动的权限检查逻辑

**保留:**

1. 所有业务逻辑
2. 数据验证
3. 数据库事务
4. 缓存策略
5. WebSocket 推送
6. 幂等性处理

## 检查清单

迁移完成后，检查以下项目：

- [ ] 所有导入都使用 `@/lib/auth/api-helpers`
- [ ] 所有路由都使用 `withAuth` 包装
- [ ] 所有路由都配置了适当的权限
- [ ] 用户 ID 使用 `user.id` 获取
- [ ] 移除了所有 `verifyApiAuth` 调用
- [ ] 移除了所有 `errorResponse` 调用
- [ ] 移除了不必要的 `try-catch` 块
- [ ] 保留了所有业务逻辑
- [ ] TypeScript 编译通过
- [ ] 测试通过

## 验证命令

```bash
# 检查是否还有旧的认证模式
grep -r "verifyApiAuth" app/api/your-module/

# 检查是否使用了新的认证模式
grep -r "withAuth" app/api/your-module/

# 检查权限配置
grep -r "permissions:" app/api/your-module/
```

## 参考链接

- 已迁移示例: `app/api/finance/receivables/route.ts`
- 认证辅助函数: `lib/auth/api-helpers.ts`
- 权限定义: `lib/auth/permissions.ts`
- 迁移总结: `PRODUCT-INVENTORY-API-MIGRATION-SUMMARY.md`
