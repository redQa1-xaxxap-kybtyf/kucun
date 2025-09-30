# 价格历史功能验证文档

## 问题分析

### 发现的问题
在销售订单表单中，调货销售（TRANSFER）的价格类型设置为 `undefined`，导致无法正确复用历史价格。

**原代码（错误）**:
```typescript
const priceType: PriceType | undefined =
  orderType === 'NORMAL' ? 'SALES' : undefined; // 调货销售不限制
```

**问题**:
- 当 `priceType` 为 `undefined` 时，API 会返回该客户的所有价格类型（SALES 和 FACTORY 混在一起）
- 无法区分普通销售和调货销售的价格
- 可能导致价格填充错误

### 修复方案

**修复后的代码**:
```typescript
const priceType: PriceType = orderType === 'NORMAL' ? 'SALES' : 'FACTORY';
```

**修复说明**:
- 普通销售（NORMAL）→ 使用 `SALES` 价格类型
- 调货销售（TRANSFER）→ 使用 `FACTORY` 价格类型
- 确保价格类型始终明确，不会混淆

---

## 完整的价格复用逻辑

### 1. 销售订单 - 普通销售（NORMAL）

#### 前端表单逻辑
**文件**: `components/sales-orders/erp-sales-order-form.tsx`

```typescript
// 1. 监听订单类型
const orderType = form.watch('orderType'); // 'NORMAL'

// 2. 确定价格类型
const priceType: PriceType = orderType === 'NORMAL' ? 'SALES' : 'FACTORY';
// 结果: priceType = 'SALES'

// 3. 查询客户价格历史
const { data: priceHistoryData } = useCustomerPriceHistory({
  customerId: selectedCustomerId,
  priceType: 'SALES', // 只查询SALES类型的价格
});

// 4. 产品选择后自动填充价格
onProductChange={product => {
  const latestPrice = getLatestPrice(
    priceHistoryData.data,
    product.id,
    'SALES' // 获取SALES类型的最新价格
  );
  if (latestPrice !== undefined) {
    form.setValue(`items.${index}.unitPrice`, latestPrice);
  }
}}
```

#### 后端记录逻辑
**文件**: `lib/api/handlers/sales-orders.ts`

```typescript
// 订单创建成功后记录价格
const priceType = validatedData.orderType === 'NORMAL' ? 'SALES' : 'FACTORY';
// 结果: priceType = 'SALES'

await tx.customerProductPrice.create({
  data: {
    customerId: validatedData.customerId,
    productId: item.productId,
    priceType: 'SALES', // 记录为SALES类型
    unitPrice: item.unitPrice,
    orderId: salesOrder.id,
    orderType: 'SALES_ORDER',
  },
});
```

#### 数据流
```
用户操作: 创建普通销售订单
   ↓
前端: 查询SALES价格历史
   ↓
前端: 自动填充SALES价格
   ↓
用户: 确认或修改价格
   ↓
后端: 创建订单
   ↓
后端: 记录SALES价格到历史表
   ↓
下次: 可以复用这个SALES价格
```

---

### 2. 销售订单 - 调货销售（TRANSFER）

#### 前端表单逻辑
**文件**: `components/sales-orders/erp-sales-order-form.tsx`

```typescript
// 1. 监听订单类型
const orderType = form.watch('orderType'); // 'TRANSFER'

// 2. 确定价格类型
const priceType: PriceType = orderType === 'NORMAL' ? 'SALES' : 'FACTORY';
// 结果: priceType = 'FACTORY'

// 3. 查询客户价格历史
const { data: priceHistoryData } = useCustomerPriceHistory({
  customerId: selectedCustomerId,
  priceType: 'FACTORY', // 只查询FACTORY类型的价格
});

// 4. 产品选择后自动填充价格
onProductChange={product => {
  const latestPrice = getLatestPrice(
    priceHistoryData.data,
    product.id,
    'FACTORY' // 获取FACTORY类型的最新价格
  );
  if (latestPrice !== undefined) {
    form.setValue(`items.${index}.unitPrice`, latestPrice);
  }
}}
```

#### 后端记录逻辑
**文件**: `lib/api/handlers/sales-orders.ts`

```typescript
// 订单创建成功后记录价格
const priceType = validatedData.orderType === 'NORMAL' ? 'SALES' : 'FACTORY';
// 结果: priceType = 'FACTORY'

await tx.customerProductPrice.create({
  data: {
    customerId: validatedData.customerId,
    productId: item.productId,
    priceType: 'FACTORY', // 记录为FACTORY类型
    unitPrice: item.unitPrice,
    orderId: salesOrder.id,
    orderType: 'SALES_ORDER',
  },
});
```

#### 数据流
```
用户操作: 创建调货销售订单
   ↓
前端: 查询FACTORY价格历史
   ↓
前端: 自动填充FACTORY价格
   ↓
用户: 确认或修改价格
   ↓
后端: 创建订单
   ↓
后端: 记录FACTORY价格到历史表
   ↓
下次: 可以复用这个FACTORY价格
```

---

### 3. 厂家发货订单

#### 前端表单逻辑
**文件**: `components/factory-shipments/factory-shipment-order-form.tsx`

```typescript
// 1. 查询客户价格历史（固定为FACTORY类型）
const { data: customerPriceHistoryData } = useCustomerPriceHistory({
  customerId: selectedCustomerId,
  priceType: 'FACTORY', // 厂家发货固定使用FACTORY价格
});

// 2. 产品选择后自动填充客户价格
onProductChange={product => {
  const customerPrice = getLatestPrice(
    customerPriceHistoryData?.data,
    product.id,
    'FACTORY'
  );
  if (customerPrice !== undefined) {
    form.setValue(`items.${index}.unitPrice`, customerPrice);
  }
}}

// 3. 供应商选择后自动填充供应商价格
// 使用独立的 SupplierPriceSelector 组件
<SupplierPriceSelector
  form={form}
  index={index}
  value={field.value}
  onChange={field.onChange}
/>
```

#### 后端记录逻辑
**文件**: `app/api/factory-shipments/route.ts`

```typescript
// 记录客户产品价格历史（固定为FACTORY类型）
await tx.customerProductPrice.create({
  data: {
    customerId,
    productId: item.productId,
    priceType: 'FACTORY', // 固定为FACTORY类型
    unitPrice: item.unitPrice,
    orderId: newOrder.id,
    orderType: 'FACTORY_SHIPMENT',
  },
});

// 记录供应商产品价格历史
await tx.supplierProductPrice.create({
  data: {
    supplierId: item.supplierId,
    productId: item.productId,
    unitPrice: item.unitPrice,
    orderId: newOrder.id,
  },
});
```

---

## 价格类型总结

| 订单类型 | 价格类型 | 查询时使用 | 记录时使用 | 说明 |
|---------|---------|-----------|-----------|------|
| 销售订单 - 普通销售 | SALES | ✅ | ✅ | 客户通过销售发货购买 |
| 销售订单 - 调货销售 | FACTORY | ✅ | ✅ | 客户通过调货方式购买 |
| 厂家发货订单 | FACTORY | ✅ | ✅ | 客户通过厂家直接发货 |
| 供应商价格 | - | ✅ | ✅ | 供应商对产品的报价 |

---

## 验证测试用例

### 测试用例 1: 普通销售价格复用
```
1. 创建普通销售订单
   - 客户: 客户A
   - 产品: 产品X
   - 单价: ¥100
   - 订单类型: NORMAL

2. 提交订单
   - 后端记录: priceType = 'SALES'

3. 再次创建普通销售订单
   - 客户: 客户A
   - 产品: 产品X
   - 订单类型: NORMAL
   - 预期: 自动填充 ¥100（SALES价格）
```

### 测试用例 2: 调货销售价格复用
```
1. 创建调货销售订单
   - 客户: 客户A
   - 产品: 产品X
   - 单价: ¥90
   - 订单类型: TRANSFER

2. 提交订单
   - 后端记录: priceType = 'FACTORY'

3. 再次创建调货销售订单
   - 客户: 客户A
   - 产品: 产品X
   - 订单类型: TRANSFER
   - 预期: 自动填充 ¥90（FACTORY价格）
```

### 测试用例 3: 价格类型隔离
```
前提:
- 客户A的产品X有两个价格:
  - SALES价格: ¥100
  - FACTORY价格: ¥90

测试:
1. 创建普通销售订单
   - 预期: 自动填充 ¥100（SALES价格）

2. 创建调货销售订单
   - 预期: 自动填充 ¥90（FACTORY价格）

3. 创建厂家发货订单
   - 预期: 自动填充 ¥90（FACTORY价格）
```

---

## 修复前后对比

### 修复前
```typescript
// ❌ 错误: 调货销售的priceType为undefined
const priceType: PriceType | undefined =
  orderType === 'NORMAL' ? 'SALES' : undefined;

// 问题: 查询时会返回所有价格类型，无法区分
```

### 修复后
```typescript
// ✅ 正确: 调货销售的priceType为FACTORY
const priceType: PriceType =
  orderType === 'NORMAL' ? 'SALES' : 'FACTORY';

// 优点: 查询时只返回对应类型的价格，逻辑清晰
```

---

## 结论

✅ **修复完成**: 销售订单中的普通销售和调货销售现在都能正确复用各自的历史价格

✅ **价格隔离**: SALES 和 FACTORY 价格完全隔离，互不干扰

✅ **逻辑一致**: 前端查询和后端记录使用相同的价格类型判断逻辑

✅ **功能完整**: 支持三种订单类型的价格复用：
- 销售订单 - 普通销售（SALES）
- 销售订单 - 调货销售（FACTORY）
- 厂家发货订单（FACTORY + 供应商价格）

