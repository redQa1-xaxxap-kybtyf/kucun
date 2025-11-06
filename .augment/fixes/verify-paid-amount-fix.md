# 销售订单详情"已收款金额"修复验证指南

## 修复总结

### 修复的文件

1. **`app/api/sales-orders/[id]/route.ts`** (第112-128行)
   - ✅ 在 `payments` 查询中添加了 `actualPaymentAmount` 字段
   - ✅ 在 `payments` 查询中添加了 `roundingAmount` 字段

2. **`app/(dashboard)/sales-orders/[id]/page.tsx`** (第46-57行)
   - ✅ 在 `PaymentRecord` 接口中添加了 `actualPaymentAmount` 字段
   - ✅ 在 `PaymentRecord` 接口中添加了 `roundingAmount` 字段

### 修复前后对比

#### API 层面

**修复前**:

```typescript
payments: {
  select: {
    id: true,
    paymentNumber: true,
    paymentAmount: true,
    // ❌ 缺少 actualPaymentAmount
    // ❌ 缺少 roundingAmount
    paymentMethod: true,
    paymentDate: true,
    status: true,
    remarks: true,
    createdAt: true,
  },
}
```

**修复后**:

```typescript
payments: {
  select: {
    id: true,
    paymentNumber: true,
    paymentAmount: true,
    actualPaymentAmount: true, // ✅ 新增
    roundingAmount: true, // ✅ 新增
    paymentMethod: true,
    paymentDate: true,
    status: true,
    remarks: true,
    createdAt: true,
  },
}
```

#### 前端类型定义

**修复前**:

```typescript
interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  // ❌ 缺少 actualPaymentAmount
  // ❌ 缺少 roundingAmount
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  createdAt: string;
}
```

**修复后**:

```typescript
interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number; // ✅ 新增
  roundingAmount: number; // ✅ 新增
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  createdAt: string;
}
```

## 验证步骤

### 1. 编译检查

```bash
# 检查 TypeScript 类型错误
npm run type-check

# 检查 ESLint 错误
npm run lint

# 格式化代码
npm run format
```

### 2. API 测试

#### 2.1 创建测试订单和收款记录

```bash
# 1. 创建一个测试销售订单
curl -X POST http://localhost:3000/api/sales-orders \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "customerId": "test-customer-id",
    "items": [
      {
        "productId": "test-product-id",
        "quantity": 10,
        "unitPrice": 100
      }
    ]
  }'

# 记录返回的订单ID: order-id-xxx

# 2. 创建一条收款记录(带抹零)
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "salesOrderId": "order-id-xxx",
    "customerId": "test-customer-id",
    "paymentAmount": 1000,
    "actualPaymentAmount": 998,
    "roundingAmount": 2,
    "paymentMethod": "cash",
    "paymentDate": "2024-01-15T10:00:00Z",
    "status": "confirmed"
  }'
```

#### 2.2 验证 API 返回数据

```bash
# 获取订单详情
curl -X GET http://localhost:3000/api/sales-orders/order-id-xxx \
  -H "Cookie: your-session-cookie" | jq

# 验证返回数据包含以下字段:
# {
#   "success": true,
#   "data": {
#     "paymentRecords": [
#       {
#         "id": "...",
#         "paymentAmount": 1000,
#         "actualPaymentAmount": 998,  // ✅ 应该存在
#         "roundingAmount": 2,         // ✅ 应该存在
#         ...
#       }
#     ],
#     "actualPaidAmount": 998,  // ✅ 实际到账金额汇总
#     "paymentRounding": 2,     // ✅ 收款抹零金额汇总
#     "paidAmount": 1000,       // ✅ 等效已收款
#     "remainingAmount": 0      // ✅ 待收金额
#   }
# }
```

### 3. 前端页面测试

#### 3.1 访问订单详情页面

```
http://localhost:3000/sales-orders/order-id-xxx
```

#### 3.2 检查顶部统计卡片

验证以下卡片是否正确显示:

1. **订单总金额卡片**
   - 显示: `¥1,000.00`

2. **已收金额卡片** (重点验证)
   - 显示: `¥998.00` (实际到账金额)
   - 副标题: "实际到账 1 笔"

3. **待收金额卡片**
   - 显示: `¥0.00`
   - 副标题: "已全部收款"

#### 3.3 检查收款记录区域

验证收款记录列表中:

1. **订单金额总览**
   - 订单总金额: `¥1,000.00`
   - 实际应收: `¥1,000.00`

2. **收款进度条**
   - 进度: 100%
   - 已收款: `¥1,000.00`
   - 待收款: `¥0.00`

3. **收款记录卡片**
   - 收款金额: `¥1,000.00`
   - 状态: "✓ 已确认"

### 4. 数据一致性验证

#### 4.1 验证计算公式

```typescript
// 在浏览器控制台执行
const order = /* 从页面获取订单数据 */;

// 验证公式1: 等效已收款 = 实际到账 + 收款抹零
console.assert(
  order.paidAmount === order.actualPaidAmount + order.paymentRounding,
  '等效已收款计算错误'
);

// 验证公式2: 待收金额 = 实际应收 - 等效已收款
const actualTotal = order.totalAmount + (order.roundingAdjustment || 0);
console.assert(
  order.remainingAmount === actualTotal - order.paidAmount,
  '待收金额计算错误'
);

// 验证公式3: 收款记录金额 = 实际到账 + 抹零
order.paymentRecords.forEach(record => {
  console.assert(
    record.paymentAmount === record.actualPaymentAmount + record.roundingAmount,
    `收款记录 ${record.paymentNumber} 金额计算错误`
  );
});
```

#### 4.2 验证多笔收款场景

```bash
# 创建第二笔收款记录
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "salesOrderId": "order-id-xxx",
    "customerId": "test-customer-id",
    "paymentAmount": 500,
    "actualPaymentAmount": 495,
    "roundingAmount": 5,
    "paymentMethod": "bank_transfer",
    "paymentDate": "2024-01-16T10:00:00Z",
    "status": "confirmed"
  }'

# 再次获取订单详情,验证:
# - actualPaidAmount = 998 + 495 = 1493
# - paymentRounding = 2 + 5 = 7
# - paidAmount = 1493 + 7 = 1500
```

### 5. 边界情况测试

#### 5.1 无收款记录

```bash
# 创建一个没有收款记录的订单
# 验证:
# - actualPaidAmount = 0
# - paymentRounding = 0
# - paidAmount = 0
# - remainingAmount = totalAmount
```

#### 5.2 待确认收款

```bash
# 创建一笔待确认的收款记录 (status: 'pending')
# 验证:
# - 待确认的收款不计入 actualPaidAmount
# - 待确认的收款不计入 paymentRounding
# - 待确认的收款不计入 paidAmount
```

#### 5.3 负数抹零

```bash
# 创建一笔负数抹零的收款记录
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "paymentAmount": 1000,
    "actualPaymentAmount": 1002,
    "roundingAmount": -2,  // 负数抹零(客户多付)
    ...
  }'

# 验证:
# - paymentAmount = actualPaymentAmount + roundingAmount
# - 1000 = 1002 + (-2) ✓
```

## 常见问题排查

### 问题1: 已收金额显示为 0

**可能原因**:

- API 未返回 `actualPaymentAmount` 字段
- 收款记录状态不是 'confirmed'
- 前端类型定义缺少字段

**排查步骤**:

1. 检查 API 返回数据: `curl http://localhost:3000/api/sales-orders/{id}`
2. 检查收款记录状态: `record.status === 'confirmed'`
3. 检查浏览器控制台是否有类型错误

### 问题2: 金额计算不正确

**可能原因**:

- 浮点数精度问题
- 字段类型转换错误
- 计算公式错误

**排查步骤**:

1. 检查 `Number()` 转换是否正确
2. 检查是否使用了 `|| 0` 处理空值
3. 验证计算公式是否符合业务逻辑

### 问题3: TypeScript 类型错误

**可能原因**:

- 接口定义不完整
- 字段名拼写错误
- 类型不匹配

**排查步骤**:

1. 运行 `npm run type-check`
2. 检查接口定义是否包含所有字段
3. 检查字段类型是否正确 (number vs string)

## 回归测试清单

- [ ] 订单详情页面正常加载
- [ ] 顶部统计卡片正确显示
- [ ] 收款记录列表正确显示
- [ ] 金额计算准确无误
- [ ] 多笔收款场景正常
- [ ] 无收款记录场景正常
- [ ] 待确认收款不计入已收款
- [ ] 负数抹零场景正常
- [ ] TypeScript 编译通过
- [ ] ESLint 检查通过
- [ ] 页面性能正常

## 相关文档

- [修复详情文档](.augment/fixes/sales-order-detail-paid-amount-fix.md)
- [收款抹零功能](.augment/fixes/payment-rounding-display-fix.md)
- [订单抹零功能](.augment/fixes/sales-order-detail-rounding-display-fix.md)
