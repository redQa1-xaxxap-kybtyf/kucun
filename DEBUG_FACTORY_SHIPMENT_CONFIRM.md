# 厂家发货确认失败诊断

## 问题描述

厂家发货确认时失败，需要排查原因。

## 可能的原因

### 1. 集装箱号验证问题

**位置**: `components/factory-shipments/confirm-shipment-dialog.tsx`

**问题**: 客户端 schema 和服务器 schema 不一致

客户端验证（第 36-40 行）:

```typescript
containerNumber: z
  .string()
  .min(1, '确认发货时必须填写集装箱号码')
  .max(50, '集装箱号码不能超过50个字符'),
```

服务器验证（`lib/validations/factory-shipment/schemas.ts` 第 200-204 行）:

```typescript
containerNumber: z
  .string()
  .max(50, '集装箱号码不能超过50个字符')
  .optional()
  .or(z.literal('')),
```

**不一致点**:

- 客户端要求 `.min(1)` (必填)
- 服务器允许 `.optional().or(z.literal(''))` (可选)

### 2. 船运公司字段问题

**位置**: `components/factory-shipments/confirm-shipment-dialog.tsx`

客户端验证（第 41-45 行）:

```typescript
shippingCompany: z
  .string()
  .max(100, '船运公司名称不能超过100个字符')
  .optional()
  .or(z.literal('')),
```

服务器验证（`lib/validations/factory-shipment/schemas.ts` 第 205-209 行）:

```typescript
shippingCompany: z
  .string()
  .max(100, '船运公司名称不能超过100个字符')
  .optional()
  .or(z.literal('')),
```

**一致** ✅

### 3. 日期字段处理问题

**位置**: `components/factory-shipments/confirm-shipment-dialog.tsx` 第 137-162 行

```typescript
const handleSubmit = form.handleSubmit(data => {
  const estimatedArrivalIso = data.estimatedArrival
    ? data.estimatedArrival.toISOString()
    : undefined;
  const shipmentDateIso = data.shipmentDate
    ? data.shipmentDate.toISOString()
    : new Date().toISOString(); // ⚠️ 总是有值

  confirmMutation.mutate(
    {
      id: orderId,
      data: {
        idempotencyKey: crypto.randomUUID(),
        status: FACTORY_SHIPMENT_STATUS.SHIPPED,
        containerNumber: data.containerNumber,
        shippingCompany: data.shippingCompany,
        estimatedArrival: estimatedArrivalIso,
        shipmentDate: shipmentDateIso, // ⚠️ 永远不会是 undefined
      },
    }
    // ...
  );
});
```

**问题**: `shipmentDate` 永远不会是 `undefined`，因为有回退值 `new Date().toISOString()`

### 4. 服务器端验证逻辑

**位置**: `app/api/factory-shipments/[id]/status/route.ts`

服务器期望的数据格式（第 96-98 行）:

```typescript
async function parseAndValidateRequest(request: NextRequest) {
  const body = await request.json();
  return updateFactoryShipmentOrderStatusSchema.parse(body); // ⚠️ 使用 .parse() 会在验证失败时抛出错误
}
```

**问题**: 如果验证失败，`.parse()` 会抛出 ZodError，但错误处理不够详细

## 诊断步骤

### 步骤 1: 添加详细日志

在 `components/factory-shipments/confirm-shipment-dialog.tsx` 的 `handleSubmit` 函数中添加：

```typescript
const handleSubmit = form.handleSubmit(data => {
  console.log('=== 确认发货数据 ===', data);

  const estimatedArrivalIso = data.estimatedArrival
    ? data.estimatedArrival.toISOString()
    : undefined;
  const shipmentDateIso = data.shipmentDate
    ? data.shipmentDate.toISOString()
    : new Date().toISOString();

  const payload = {
    idempotencyKey: crypto.randomUUID(),
    status: FACTORY_SHIPMENT_STATUS.SHIPPED,
    containerNumber: data.containerNumber,
    shippingCompany: data.shippingCompany,
    estimatedArrival: estimatedArrivalIso,
    shipmentDate: shipmentDateIso,
  };

  console.log('=== 发送到服务器的数据 ===', payload);

  confirmMutation.mutate(
    { id: orderId, data: payload },
    {
      onSuccess: handleSuccess,
      onError: error => {
        console.error('=== 确认发货失败 ===', error);
        handleError(error);
      },
    }
  );
});
```

### 步骤 2: 改进服务器错误处理

在 `app/api/factory-shipments/[id]/status/route.ts` 添加详细的验证错误处理：

```typescript
async function parseAndValidateRequest(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('=== 接收到的请求数据 ===', body);
    const validated = updateFactoryShipmentOrderStatusSchema.parse(body);
    console.log('=== 验证通过的数据 ===', validated);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('=== Zod 验证失败 ===', error.issues);
      throw new Error(
        `数据验证失败: ${error.issues.map(i => i.message).join(', ')}`
      );
    }
    throw error;
  }
}
```

## 推荐修复方案

### 修复 1: 统一客户端和服务器端的 containerNumber 验证

**不要修改服务器端 schema**（保持向后兼容），而是确保客户端在确认发货时强制要求填写：

在 `components/factory-shipments/confirm-shipment-dialog.tsx`:

```typescript
// 保持现有的客户端验证（已经是正确的）
const confirmShipmentSchema = z.object({
  containerNumber: z
    .string()
    .min(1, '确认发货时必须填写集装箱号码') // ✅ 正确
    .max(50, '集装箱号码不能超过50个字符'),
  // ...
});
```

### 修复 2: 改进错误提示

在 `lib/api/factory-shipments.ts` 的 `updateFactoryShipmentOrderStatus` 函数:

```typescript
if (!response.ok) {
  const error = await response.json();
  console.error('=== API 错误响应 ===', error);
  throw new Error(error.error || error.message || '更新厂家发货订单状态失败');
}
```

### 修复 3: 添加更详细的错误处理

在 `app/api/factory-shipments/[id]/status/route.ts`:

```typescript
} catch (error) {
  logger.error('factory-shipments', '更新厂家发货订单状态失败', error, {
    orderId: id,
  });

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: '数据验证失败',
        message: error.issues.map(i => i.message).join(', '),
        details: error.issues
      },
      { status: 422 }
    );
  }

  // ... 其他错误处理
}
```

## 已应用的修复

### 修复 1: 添加详细的调试日志

已在以下文件中添加调试日志：

1. **客户端 - 确认发货对话框**
   - 文件: `components/factory-shipments/confirm-shipment-dialog.tsx`
   - 添加位置: `handleSubmit` 函数（第 138-171 行）
   - 日志内容:
     - 表单数据
     - 发送到服务器的 payload
     - 错误详情

2. **API 客户端**
   - 文件: `lib/api/factory-shipments.ts`
   - 添加位置: `updateFactoryShipmentOrderStatus` 函数（第 207-229 行）
   - 日志内容:
     - 请求数据
     - 服务器错误响应
     - 成功响应

3. **服务器端 - API 路由**
   - 文件: `app/api/factory-shipments/[id]/status/route.ts`
   - 添加位置:
     - `parseAndValidateRequest` 函数（第 96-118 行）
     - 错误处理（第 70-132 行）
   - 日志内容:
     - 接收到的请求数据
     - 验证通过的数据
     - Zod 验证失败详情
     - 错误详情和堆栈

### 修复 2: 改进错误响应格式

**问题**: 服务器返回的错误格式不一致，有时返回 `{ error: ... }`，有时返回 `{ message: ... }`

**修复**: 统一返回 `{ error: ..., message: ... }`，确保客户端可以正确获取错误信息

### 修复 3: 添加 Zod 验证错误专门处理

**问题**: Zod 验证错误没有被正确捕获，导致返回 500 错误而不是 422 验证错误

**修复**:

- 在 `parseAndValidateRequest` 中捕获 Zod 验证错误
- 返回 422 状态码和详细的验证错误信息

## 测试步骤

### 步骤 1: 启动开发服务器

```bash
npm run dev
```

### 步骤 2: 打开浏览器控制台

1. 按 F12 打开开发者工具
2. 切换到 Console 标签

### 步骤 3: 打开终端查看服务器日志

在另一个终端窗口中，查看服务器输出

### 步骤 4: 尝试确认发货

1. 导航到厂家发货订单详情页面
2. 点击"确认发货"按钮
3. 填写集装箱号码（必填）
4. 可选填写船运公司
5. 点击"确认发货"

### 步骤 5: 查看日志输出

**浏览器控制台应该显示**:

```
[DEBUG] 确认发货 - 表单数据: {
  containerNumber: "...",
  shippingCompany: "...",
  estimatedArrival: ...,
  shipmentDate: ...
}

[DEBUG] 确认发货 - 发送到服务器的数据: {
  idempotencyKey: "...",
  status: "shipped",
  containerNumber: "...",
  shippingCompany: "...",
  estimatedArrival: "...",
  shipmentDate: "..."
}

[DEBUG] 更新订单状态 - 请求数据: {
  id: "...",
  data: { ... }
}
```

**如果成功**:

```
[DEBUG] 更新订单状态 - 成功响应: { ... }
```

**如果失败**:

```
[DEBUG] 更新订单状态 - 服务器错误响应: {
  status: 422,
  statusText: "Unprocessable Entity",
  error: { error: "...", message: "..." }
}

[DEBUG] 确认发货失败: Error: ...
```

**服务器终端应该显示**:

```
[DEBUG] 接收到的请求数据: {
  "idempotencyKey": "...",
  "status": "shipped",
  "containerNumber": "...",
  "shippingCompany": "...",
  "estimatedArrival": "...",
  "shipmentDate": "..."
}
```

**如果验证失败**:

```
[DEBUG] Zod 验证失败: [
  {
    "path": ["containerNumber"],
    "message": "集装箱号码不能超过50个字符"
  }
]
```

**如果其他错误**:

```
[DEBUG] 错误详情: 状态流转失败: 订单状态不能从 draft 变更为 shipped
    at updateFactoryShipmentStatus (...)
    at ...
```

## 常见错误和解决方案

### 错误 1: "数据验证失败: Invalid datetime string! Must be UTC."

**原因**: `shipmentDate` 或 `estimatedArrival` 不是有效的 ISO 8601 日期时间字符串

**解决方案**: 确保日期字段使用 `.toISOString()` 转换

**检查代码**: `components/factory-shipments/confirm-shipment-dialog.tsx` 第 140-145 行

### 错误 2: "数据验证失败: 集装箱号码不能超过50个字符"

**原因**: 用户输入的集装箱号码超过 50 个字符

**解决方案**: 在客户端添加长度限制或提示用户

### 错误 3: "必须填写集装箱号才能标记为已发货"

**原因**: `containerNumber` 为空字符串或 undefined

**解决方案**:

- 检查客户端验证是否正确
- 确保 `data.containerNumber` 有值

**检查代码**: `components/factory-shipments/confirm-shipment-dialog.tsx` 第 36-40 行

### 错误 4: "状态流转失败: 订单状态不能从 X 变更为 shipped"

**原因**: 订单当前状态不允许直接流转到"已发货"状态

**解决方案**:

- 启用智能状态流转（已启用）
- 检查 `enableSmartTransition` 参数

**检查代码**:

- `app/api/factory-shipments/[id]/status/route.ts` 第 50-51 行
- `lib/api/handlers/factory-shipment-status.ts` 第 149-184 行

## 清理调试日志

**生产环境部署前**，请移除所有 `console.log` 和 `console.error` 调试日志：

1. 搜索所有 `[DEBUG]` 标记的日志
2. 使用 ESLint 规则 `no-console` 检查
3. 可以考虑使用日志库（如 `pino`）替代 `console.log`

```bash
# 搜索所有调试日志
grep -r "\[DEBUG\]" --include="*.ts" --include="*.tsx" .

# 使用 ESLint 检查
npm run lint
```

## 下一步操作

1. ✅ 添加日志查看实际失败原因
2. ⏳ 检查浏览器控制台和服务器日志
3. ⏳ 根据日志输出确定具体问题
4. ⏳ 应用对应的修复方案
5. ⏳ 移除调试日志（生产环境部署前）
