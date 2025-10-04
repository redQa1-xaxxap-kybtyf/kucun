# API Auth Migration Script - Batch Processing

## 修改进度追踪

### 已完成的文件 (13个)

1. ✅ app/api/products/route.ts - POST method
2. ✅ app/api/suppliers/route.ts - GET & POST
3. ✅ app/api/suppliers/[id]/route.ts - GET, PUT, DELETE
4. ✅ app/api/suppliers/batch/status/route.ts
5. ✅ app/api/suppliers/batch/route.ts
6. ✅ app/api/settings/basic/route.ts - GET & PUT
7. ✅ app/api/refunds/route.ts - GET & POST
8. ✅ app/api/products/search/route.ts
9. ✅ app/api/product-variants/route.ts - GET & POST

### 需要跳过的文件 (1个)

- ❌ app/api/auth/update-password/route.ts - 认证相关，需保留 getServerSession

### 待处理的文件 (36个)

需要统一替换模式的文件列表：

```
app/api/products/[id]/route.ts
app/api/product-variants/generate-sku/route.ts
app/api/product-variants/batch/route.ts
app/api/product-variants/check-sku/route.ts
app/api/product-variants/[id]/inventory-summary/route.ts
app/api/product-variants/[id]/route.ts
app/api/payments/route.ts
app/api/payments/[id]/route.ts
app/api/inventory/route.ts
app/api/finance/payments-out/route.ts
app/api/finance/payments-out/[id]/route.ts
app/api/finance/payables/[id]/route.ts
app/api/dashboard/todos/route.ts
app/api/factory-shipments/route.ts
app/api/dashboard/overview/route.ts
app/api/categories/batch/route.ts
app/api/settings/users/route.ts
app/api/settings/users/reset-password/route.ts
app/api/settings/storage/test/route.ts
app/api/settings/storage/route.ts
app/api/products/batch/route.ts
app/api/price-history/supplier/route.ts
app/api/price-history/customer/route.ts
app/api/inventory/outbound/route.ts
app/api/inventory/inbound/[id]/route.ts
app/api/inventory/adjustments/[id]/route.ts
app/api/inventory/adjust/route.ts
app/api/finance/route.ts
app/api/finance/refunds/[id]/route.ts
app/api/finance/refunds/[id]/process/route.ts
app/api/finance/refunds/statistics/route.ts
app/api/finance/receivables/statistics/route.ts
app/api/finance/payables/statistics/route.ts
app/api/factory-shipments/[id]/status/route.ts
app/api/factory-shipments/[id]/route.ts
app/api/dashboard/quick-actions/route.ts
app/api/dashboard/alerts/route.ts
```

## 统一替换模式

### 模式 1: 删除导入语句

**查找：**

```typescript
import { getServerSession } from 'next-auth';
```

**替换为：**

```typescript
// 删除此行
```

### 模式 2: 删除 authOptions 导入

**查找：**

```typescript
import { authOptions } from '@/lib/auth';
```

**替换为：**

```typescript
// 删除此行
```

### 模式 3: 添加新的导入

在文件开头添加（如果没有的话）：

```typescript
import { verifyApiAuth, errorResponse } from '@/lib/api-helpers';
```

### 模式 4: 替换认证逻辑 - 基础版本

**查找：**

```typescript
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json(
    { success: false, error: '未授权访问' },
    { status: 401 }
  );
}
```

**替换为：**

```typescript
const auth = verifyApiAuth(request);
if (!auth.success) {
  return errorResponse(auth.error || '未授权访问', 401);
}
```

### 模式 5: 替换认证逻辑 - 带用户ID检查版本

**查找：**

```typescript
const session = await getServerSession(authOptions);
if (!session?.user?.id) {
  return NextResponse.json(
    { success: false, error: '未授权访问' },
    { status: 401 }
  );
}
```

**替换为：**

```typescript
const auth = verifyApiAuth(request);
if (!auth.success) {
  return errorResponse(auth.error || '未授权访问', 401);
}
```

### 模式 6: 替换用户ID引用

**查找：**

```typescript
session.user.id;
```

**替换为：**

```typescript
auth.userId;
```

或者如果需要非空断言：

```typescript
auth.userId!;
```

### 模式 7: 开发模式下的特殊处理（需要删除）

**查找：**

```typescript
if (env.NODE_ENV !== 'development') {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw ApiError.unauthorized();
  }
}
```

**替换为：**

```typescript
const auth = verifyApiAuth(request);
if (!auth.success) {
  throw ApiError.unauthorized();
}
```

## 下一步操作建议

由于文件数量较多（36个待处理），建议使用以下方法：

### 选项1：逐个手动修改（更安全）

按照上述模式，逐个文件手动替换，确保每个文件的上下文正确。

### 选项2：使用批量替换工具

可以使用 VS Code 的全局搜索替换功能：

1. 按 Ctrl+Shift+H 打开全局替换
2. 启用正则表达式模式
3. 设置文件过滤：`app/api/**/*.ts` 但排除 `app/api/auth/**`
4. 按照上述模式逐个替换

### 选项3：使用自动化脚本

创建一个 Node.js 脚本来批量处理文件（需要仔细测试）

## 重要注意事项

1. **保留auth路由**：`app/api/auth/*` 下的文件需要保留 getServerSession
2. **验证userId使用**：确保所有使用 `session.user.id` 的地方改为 `auth.userId!`
3. **角色权限检查**：如果有角色检查（如 admin），可能需要额外查询数据库获取用户角色
4. **测试**：修改后务必测试所有受影响的 API 端点

## 修改统计

- 已修改文件：13个
- 待修改文件：36个
- 跳过文件：1个 (auth/update-password)
- 总计：50个文件

## 参考实现

参考 `app/api/finance/receivables/route.ts` (已正确实现) 的第 173-179 行：

```typescript
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const auth = verifyApiAuth(request);
    if (!auth.success) {
      return errorResponse(auth.error || '未授权访问', 401);
    }
    // ... rest of the code
  }
}
```
