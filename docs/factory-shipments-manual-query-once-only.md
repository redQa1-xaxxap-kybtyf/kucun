# 厂家发货手动查询按钮 - 一次性查询限制

> 实现手动查询按钮在查询后永久隐藏，确保一个订单只能手动查询一次

## 📋 需求说明

**用户需求：**

- 厂家发货订单的手动查询按钮，查询完成后需要隐藏
- 一个订单只允许手动查询一次
- 无论查询成功还是失败，按钮都应该永久隐藏

**业务背景：**

- 手动查询会调用第三方物流 API，有成本和频率限制
- 避免用户反复点击查询按钮，造成不必要的 API 调用
- 查询失败可能是因为物流信息尚未更新，反复查询也无意义

## ✅ 实现方案

### 修改前的逻辑

```typescript
// ❌ 旧逻辑：只要没有 estimatedArrival，按钮就会显示
const showManualQueryButton =
  !order.estimatedArrival && hasShippingCompany && isShipped;
```

**问题：**

- 如果查询失败（没有返回 `estimatedArrival`），按钮会继续显示
- 用户可以反复点击查询，造成不必要的 API 调用
- 没有真正实现"只允许查询一次"的需求

### 修改后的逻辑

```typescript
// ✅ 新逻辑：只有从未查询过的订单才显示按钮
const hasNeverBeenManuallyQueried = !order.lastShippingQueryAt;
const showManualQueryButton =
  !order.estimatedArrival &&
  hasShippingCompany &&
  isShipped &&
  hasNeverBeenManuallyQueried;
```

**改进：**

- 使用 `lastShippingQueryAt` 字段判断是否已经查询过
- 一旦查询过一次（`lastShippingQueryAt` 有值），按钮永久隐藏
- 无论查询成功还是失败，都不会再显示按钮

## 🎯 按钮显示条件

手动查询按钮的显示需要同时满足以下 4 个条件：

1. **订单状态为已发货** (`isShipped`)
   - `order.status === FACTORY_SHIPMENT_STATUS.SHIPPED`
   - 只有已发货的订单才需要查询物流信息

2. **有物流公司** (`hasShippingCompany`)
   - `Boolean(order.shippingCompany?.trim())`
   - 没有物流公司无法查询

3. **没有预计到达时间** (`!order.estimatedArrival`)
   - 如果已经有预计到达时间，说明查询成功过
   - 不需要再次查询

4. **从未手动查询过** (`hasNeverBeenManuallyQueried`) ⭐ **新增**
   - `!order.lastShippingQueryAt`
   - 确保每个订单只能手动查询一次

## 📊 查询流程

### 1. 初始状态

```typescript
{
  status: 'shipped',
  shippingCompany: '顺丰速运',
  estimatedArrival: null,
  lastShippingQueryAt: null  // 从未查询过
}
```

**按钮状态：** ✅ 显示"手动查询"按钮

### 2. 用户点击查询

```typescript
// 调用 API: POST /api/factory-shipments/{id}/shipping-query
// API 会更新 lastShippingQueryAt 字段
```

### 3. 查询成功

```typescript
{
  status: 'shipped',
  shippingCompany: '顺丰速运',
  estimatedArrival: '2025-11-15T10:00:00Z',  // 查询成功，有预计到达时间
  lastShippingQueryAt: '2025-11-10T14:30:00Z'  // 记录查询时间
}
```

**按钮状态：** ❌ 隐藏（因为 `estimatedArrival` 有值）

### 4. 查询失败

```typescript
{
  status: 'shipped',
  shippingCompany: '顺丰速运',
  estimatedArrival: null,  // 查询失败，没有预计到达时间
  lastShippingQueryAt: '2025-11-10T14:30:00Z',  // 但已经查询过
  shippingQueryStatus: 'manual_failed',
  shippingQueryError: '物流信息暂未更新'
}
```

**按钮状态：** ❌ 隐藏（因为 `lastShippingQueryAt` 有值）

## 🔄 与自动查询的关系

**自动查询调度器：**

- 系统会定期自动查询已发货订单的物流信息
- 自动查询也会更新 `lastShippingQueryAt` 字段
- 如果自动查询成功，手动查询按钮也会隐藏

**手动查询的作用：**

- 用户可以主动触发查询，不用等待自动调度
- 适用于紧急情况或自动查询失败的场景
- 但每个订单只能手动查询一次，避免滥用

## 📝 代码修改详情

**文件：** `components/factory-shipments/factory-shipment-order-list-view.tsx`

**修改位置：** 第 306-317 行

**修改内容：**

```diff
  const hasShippingCompany = Boolean(order.shippingCompany?.trim());
  const isShipped = order.status === FACTORY_SHIPMENT_STATUS.SHIPPED;
+
+ // 手动查询按钮显示逻辑：
+ // 1. 必须是已发货状态
+ // 2. 必须有物流公司
+ // 3. 没有预计到达时间（查询成功后会有）
+ // 4. 从未手动查询过（lastShippingQueryAt 为空）
+ // 一旦手动查询过一次，无论成功失败，按钮永久隐藏
+ const hasNeverBeenManuallyQueried = !order.lastShippingQueryAt;
  const showManualQueryButton =
-   !order.estimatedArrival && hasShippingCompany && isShipped;
+   !order.estimatedArrival &&
+   hasShippingCompany &&
+   isShipped &&
+   hasNeverBeenManuallyQueried;
  const canTriggerManualQuery =
    showManualQueryButton && !isCoolingDown && !manualQueryMutation.isPending;
```

## 🧪 测试场景

### 场景 1：从未查询过的订单

**初始数据：**

```json
{
  "status": "shipped",
  "shippingCompany": "顺丰速运",
  "estimatedArrival": null,
  "lastShippingQueryAt": null
}
```

**预期结果：**

- ✅ 显示"手动查询"按钮
- ✅ 按钮可点击

### 场景 2：查询成功的订单

**初始数据：**

```json
{
  "status": "shipped",
  "shippingCompany": "顺丰速运",
  "estimatedArrival": "2025-11-15T10:00:00Z",
  "lastShippingQueryAt": "2025-11-10T14:30:00Z"
}
```

**预期结果：**

- ❌ 不显示"手动查询"按钮（因为 `estimatedArrival` 有值）

### 场景 3：查询失败的订单

**初始数据：**

```json
{
  "status": "shipped",
  "shippingCompany": "顺丰速运",
  "estimatedArrival": null,
  "lastShippingQueryAt": "2025-11-10T14:30:00Z",
  "shippingQueryStatus": "manual_failed"
}
```

**预期结果：**

- ❌ 不显示"手动查询"按钮（因为 `lastShippingQueryAt` 有值）
- ⭐ **这是关键改进：即使查询失败，也不再显示按钮**

### 场景 4：自动查询过的订单

**初始数据：**

```json
{
  "status": "shipped",
  "shippingCompany": "顺丰速运",
  "estimatedArrival": null,
  "lastShippingQueryAt": "2025-11-10T08:00:00Z",
  "shippingQueryStatus": "auto_pending"
}
```

**预期结果：**

- ❌ 不显示"手动查询"按钮（因为 `lastShippingQueryAt` 有值）
- 自动查询也会更新 `lastShippingQueryAt`，所以手动查询按钮会隐藏

## 🔍 数据库字段说明

### lastShippingQueryAt

**类型：** `DateTime?`  
**用途：** 记录最后一次查询时间（手动或自动）  
**更新时机：**

- 用户点击"手动查询"按钮时
- 自动查询调度器执行查询时

**判断逻辑：**

```typescript
const hasNeverBeenManuallyQueried = !order.lastShippingQueryAt;
```

### estimatedArrival

**类型：** `DateTime?`  
**用途：** 预计到达时间  
**更新时机：**

- 查询成功时，从物流 API 获取

**判断逻辑：**

```typescript
const hasEstimatedArrival = Boolean(order.estimatedArrival);
```

## 📚 相关文件

- **前端组件：** `components/factory-shipments/factory-shipment-order-list-view.tsx`
- **API 路由：** `app/api/factory-shipments/[id]/shipping-query/route.ts`
- **数据库模型：** `prisma/schema.prisma` - `FactoryShipmentOrder` 模型
- **类型定义：** `lib/types/factory-shipment.ts`

## 🎯 预期效果

**修改前：**

- ❌ 查询失败后，按钮仍然显示
- ❌ 用户可以反复点击查询
- ❌ 造成不必要的 API 调用

**修改后：**

- ✅ 查询后（无论成功失败），按钮永久隐藏
- ✅ 每个订单只能手动查询一次
- ✅ 避免不必要的 API 调用
- ✅ 符合业务需求

## 🚀 后续优化建议

1. **添加查询历史记录**
   - 记录每次查询的时间、结果、错误信息
   - 方便排查问题和统计查询成功率

2. **管理员重置功能**
   - 允许管理员重置 `lastShippingQueryAt` 字段
   - 在特殊情况下允许再次手动查询

3. **查询失败提示优化**
   - 如果查询失败，显示更友好的错误提示
   - 告知用户可以等待自动查询或联系客服

---

**修改时间：** 2025-11-10  
**修改负责人：** Augment Agent  
**验证状态：** ✅ ESLint 通过（3 个警告，0 个错误）
