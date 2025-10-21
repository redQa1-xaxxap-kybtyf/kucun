# 入库422验证错误调试指南

## 已添加的调试代码

### 前端调试 (hooks/use-inbound-form-submit.ts)

```typescript
// 1. 幂等性键生成调试
console.log('🔑 [前端] 生成幂等性键:', {
  idempotencyKey,
  type: typeof idempotencyKey,
  length: idempotencyKey.length,
  isUUID:
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idempotencyKey
    ),
});

// 2. 最终请求数据调试
console.log('📤 [前端] 发送入库请求:', {
  timestamp: new Date().toISOString(),
  requestData,
  dataKeys: Object.keys(requestData),
  dataTypes: Object.entries(requestData).map(([key, value]) => ({
    key,
    type: typeof value,
    value: value,
  })),
});
```

### 后端调试 (app/api/inventory/inbound/route.ts)

```typescript
// 1. 原始请求数据
console.log('📥 [入库API] 收到请求:', {
  timestamp: new Date().toISOString(),
  body: JSON.stringify(body, null, 2),
});

// 2. 验证成功
console.log('✅ [入库API] 数据验证通过:', {
  idempotencyKey,
  productId,
  quantity: validatedData.quantity,
  piecesPerUnit,
  weight,
});

// 3. 验证失败
console.error('❌ [入库API] 数据验证失败:', {
  error: validationError,
  body,
});
```

### 验证错误详情 (lib/api/errors.ts)

```typescript
console.error('❌ [后端] Zod验证错误详情:', {
  timestamp: new Date().toISOString(),
  issues: error.issues,
  details,
  fullError: JSON.stringify(error, null, 2),
});
```

## 如何使用调试代码

### 步骤1: 重启开发服务器

```bash
# 停止当前服务器 (Ctrl+C)
# 重新启动
npm run dev
```

### 步骤2: 在浏览器中测试入库

1. 打开浏览器开发者工具 (F12)
2. 切换到 **Console** 标签
3. 执行入库操作
4. 观察控制台输出

### 步骤3: 查看日志输出

#### 前端日志 (浏览器控制台)

预期看到:

```
🔑 [前端] 生成幂等性键: {
  idempotencyKey: "...",
  type: "string",
  length: 36,
  isUUID: true/false
}

📤 [前端] 发送入库请求: {
  timestamp: "2025-10-21T...",
  requestData: {...},
  dataKeys: [...],
  dataTypes: [...]
}
```

#### 后端日志 (终端/命令行)

预期看到:

```
📥 [入库API] 收到请求: {
  timestamp: "2025-10-21T...",
  body: "{...}"
}
```

**如果验证失败**:

```
❌ [入库API] 数据验证失败: {
  error: {...},
  body: {...}
}

❌ [后端] Zod验证错误详情: {
  issues: [
    {
      code: "...",
      path: ["fieldName"],
      message: "错误消息"
    }
  ],
  details: [...]
}
```

## 预期的问题分析

### 可能的验证错误

根据 `lib/validations/inbound.ts` 的验证规则:

1. **idempotencyKey** ✅ 已修复
   - ~~之前: 必须是UUID格式~~
   - 现在: 任意字符串 (1-100字符)

2. **piecesPerUnit** (可选)
   - 类型: number
   - 范围: 1-10000
   - 必须是整数

3. **weight** (可选)
   - 类型: number
   - 范围: 0.01-10000

4. **quantity**
   - 类型: number
   - 范围: 1-999999
   - 必须是整数

### 常见错误场景

#### 场景1: piecesPerUnit 或 weight 类型错误

```javascript
// ❌ 错误: 字符串类型
{
  piecesPerUnit: "50",  // 应该是 50
  weight: "25.5"        // 应该是 25.5
}

// ✅ 正确: 数字类型
{
  piecesPerUnit: 50,
  weight: 25.5
}
```

#### 场景2: 缺少必填字段

```javascript
// ❌ 错误: 缺少 quantity
{
  idempotencyKey: "...",
  productId: "...",
  inputQuantity: 100,
  inputUnit: "pieces",
  // quantity 缺失
}

// ✅ 正确
{
  idempotencyKey: "...",
  productId: "...",
  inputQuantity: 100,
  inputUnit: "pieces",
  quantity: 100,  // 必填
}
```

#### 场景3: 数值范围错误

```javascript
// ❌ 错误: weight 太小
{
  weight: 0; // 必须 >= 0.01
}

// ❌ 错误: piecesPerUnit 为 0
{
  piecesPerUnit: 0; // 必须 >= 1
}
```

## 下一步行动

1. **重启开发服务器** 加载调试代码
2. **在浏览器中测试入库**
3. **复制控制台的完整日志** 发送给我
4. **截图浏览器Console和终端输出**

这样我就能准确知道是哪个字段验证失败了！

## 修改的文件列表

- ✅ `hooks/use-inbound-form-submit.ts` - 前端调试日志
- ✅ `app/api/inventory/inbound/route.ts` - 后端调试日志
- ✅ `lib/api/errors.ts` - Zod错误详情
- ✅ `lib/validations/inbound.ts` - 放宽idempotencyKey验证
