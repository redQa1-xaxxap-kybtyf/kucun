# 厂家发货确认失败问题修复总结

## 📋 问题描述

用户在厂家发货订单详情页面点击"确认发货"按钮后，填写集装箱号码并提交，但操作失败，没有明确的错误信息。

## 🔍 问题分析

通过代码审查，发现以下潜在问题：

### 1. 错误处理不够详细

- **客户端**: 错误信息只显示简单的错误消息
- **服务器端**: 没有详细的日志输出
- **API 层**: 错误响应格式不一致

### 2. 验证错误没有被正确捕获

- Zod 验证失败时，没有返回 422 状态码
- 验证错误信息没有被正确传递给客户端

### 3. 缺少调试信息

- 无法确定请求数据是否正确
- 无法确定服务器端验证是否通过
- 无法确定具体的失败原因

## ✅ 已应用的修复

### 修复 1: 添加详细的调试日志

#### 客户端（`components/factory-shipments/confirm-shipment-dialog.tsx`）

```typescript
const handleSubmit = form.handleSubmit(data => {
  console.log('[DEBUG] 确认发货 - 表单数据:', data);

  const payload = {
    idempotencyKey: crypto.randomUUID(),
    status: FACTORY_SHIPMENT_STATUS.SHIPPED,
    containerNumber: data.containerNumber,
    shippingCompany: data.shippingCompany,
    estimatedArrival: estimatedArrivalIso,
    shipmentDate: shipmentDateIso,
  };

  console.log('[DEBUG] 确认发货 - 发送到服务器的数据:', payload);

  confirmMutation.mutate(
    { id: orderId, data: payload },
    {
      onSuccess: handleSuccess,
      onError: error => {
        console.error('[DEBUG] 确认发货失败:', error);
        handleError(error);
      },
    }
  );
});
```

#### API 客户端（`lib/api/factory-shipments.ts`）

```typescript
export async function updateFactoryShipmentOrderStatus(
  id: string,
  data: UpdateFactoryShipmentOrderStatusData
): Promise<FactoryShipmentOrder> {
  console.log('[DEBUG] 更新订单状态 - 请求数据:', { id, data });

  const response = await fetch(`/api/factory-shipments/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('[DEBUG] 更新订单状态 - 服务器错误响应:', {
      status: response.status,
      statusText: response.statusText,
      error,
    });
    throw new Error(error.error || error.message || '更新厂家发货订单状态失败');
  }

  const result = await response.json();
  console.log('[DEBUG] 更新订单状态 - 成功响应:', result);
  return result;
}
```

#### 服务器端（`app/api/factory-shipments/[id]/status/route.ts`）

```typescript
async function parseAndValidateRequest(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[DEBUG] 接收到的请求数据:', JSON.stringify(body, null, 2));
    const validated = updateFactoryShipmentOrderStatusSchema.parse(body);
    console.log('[DEBUG] 验证通过的数据:', JSON.stringify(validated, null, 2));
    return validated;
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as {
        issues: Array<{ path: (string | number)[]; message: string }>;
      };
      console.error(
        '[DEBUG] Zod 验证失败:',
        JSON.stringify(zodError.issues, null, 2)
      );
      throw new Error(
        `数据验证失败: ${zodError.issues.map(i => i.message).join(', ')}`
      );
    }
    throw error;
  }
}
```

### 修复 2: 改进错误响应格式

**问题**: 服务器返回的错误格式不一致，有时返回 `{ error: ... }`，有时返回 `{ message: ... }`

**修复**: 统一返回 `{ error: ..., message: ... }`，确保客户端可以正确获取错误信息

```typescript
// 统一的错误响应格式
return NextResponse.json(
  {
    error: error.message,
    message: error.message,
  },
  { status: XXX }
);
```

### 修复 3: 添加 Zod 验证错误专门处理

**问题**: Zod 验证错误没有被正确捕获，导致返回 500 错误而不是 422 验证错误

**修复**:

- 在 `parseAndValidateRequest` 中捕获 Zod 验证错误
- 返回 422 状态码和详细的验证错误信息

```typescript
if (error.message.includes('数据验证失败')) {
  return NextResponse.json(
    {
      error: error.message,
      message: error.message,
    },
    { status: 422 }
  );
}
```

## 🧪 测试步骤

1. **启动开发服务器**: `npm run dev`
2. **打开浏览器控制台** (F12)
3. **导航到厂家发货订单详情页面**
4. **点击"确认发货"按钮**
5. **填写集装箱号码**（必填）
6. **点击"确认发货"提交**
7. **查看控制台和服务器日志**

## 📊 预期结果

### 成功情况

- 浏览器控制台显示调试日志
- 服务器终端显示请求和验证日志
- 订单状态成功更新为"已发货"
- 显示成功提示

### 失败情况

- 浏览器控制台显示详细的错误信息
- 服务器终端显示验证失败或其他错误详情
- 显示具体的错误提示（如"数据验证失败: ..."）

## 📝 后续操作

查看实际的日志输出后，请将具体的错误信息反馈，以便进一步定位和修复问题。

常见问题请参考 `DEBUG_FACTORY_SHIPMENT_CONFIRM.md` 文档。

## ⚠️ 注意事项

**生产环境部署前**，请移除所有 `[DEBUG]` 调试日志：

```bash
# 搜索所有调试日志
grep -r "\[DEBUG\]" --include="*.ts" --include="*.tsx" .

# 使用 ESLint 检查
npm run lint
```
