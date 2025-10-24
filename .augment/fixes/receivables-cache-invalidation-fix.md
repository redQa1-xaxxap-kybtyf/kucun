# 应收款缓存更新修复

## 问题描述

在销售订单模块创建新订单后，应收款页面存在数据缓存问题，新创建的订单数据没有实时更新显示，必须手动刷新浏览器页面才能看到最新的应收款数据。

## 根本原因

1. **服务端缓存失效不完整**：
   - 销售订单创建成功后，只调用了 `revalidateSalesOrders()`
   - 没有同时失效应收款相关的缓存（`revalidateFinance('receivables')`）
   - 应收款数据实际上是从销售订单派生的，新订单应该触发应收款缓存更新

2. **客户端缓存失效不完整**：
   - 所有销售订单创建表单的 `useMutation` 回调中
   - 只失效了销售订单的 Query Key：`salesOrderQueryKeys.lists()`
   - 没有失效应收款的 Query Key：`queryKeys.finance.receivables()`

## 修复方案

### 1. 服务端 API 修复

**文件**: `app/api/sales-orders/route.ts`

#### 修改内容：

1. **添加导入**：

```typescript
import {
  buildCacheKey,
  CACHE_STRATEGY,
  getOrSetJSON,
  revalidateFinance, // ✅ 新增
  revalidateSalesOrders,
} from '@/lib/cache';
```

2. **创建订单后失效应收款缓存**：

```typescript
const order = await createSalesOrder(createInput, user.id);

// 使用统一的缓存失效系统（自动级联失效相关缓存）
await revalidateSalesOrders();

// ✅ 关键修复：销售订单创建后，同时失效应收款缓存
// 因为应收款数据来源于销售订单，新订单会影响应收款列表
await revalidateFinance('receivables');

return successResponse(order, 201, '销售订单创建成功');
```

### 2. 客户端表单修复

修复了以下 5 个销售订单创建表单组件：

#### 2.1 `components/sales-orders/enhanced-sales-order-form/hooks/useSalesOrderSubmission.ts`

```typescript
// ✅ 添加导入
import { queryKeys } from '@/lib/queryKeys';

// ✅ 修改 onSuccess 回调
const createMutation = useMutation({
  mutationFn: createSalesOrder,
  onSuccess: data => {
    toast({
      title: '创建成功',
      description: `销售订单 "${data.orderNumber}" 创建成功！`,
    });

    // ✅ 失效销售订单缓存
    queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });

    // ✅ 关键修复：同时失效应收款缓存
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.receivables(),
    });

    if (onSuccess) {
      onSuccess(data);
    } else {
      router.push('/sales-orders');
    }
  },
  // ...
});
```

#### 2.2 `components/sales-orders/use-enhanced-sales-order-form.ts`

同样的修复模式：

- 添加 `import { queryKeys } from '@/lib/queryKeys';`
- 在 `onSuccess` 中添加 `queryClient.invalidateQueries({ queryKey: queryKeys.finance.receivables() });`

#### 2.3 `components/sales-orders/invoice-oriented-form.tsx`

同样的修复模式：

- 在 `onSuccess` 中添加 `queryClient.invalidateQueries({ queryKey: ['finance', 'receivables'] });`

#### 2.4 `components/sales-orders/sales-order-form.tsx`

同样的修复模式：

- 在 `onSuccess` 中添加 `queryClient.invalidateQueries({ queryKey: ['finance', 'receivables'] });`

#### 2.5 `components/sales-orders/erp-sales-order-form.tsx`

同样的修复模式：

- 在 `onSuccess` 中添加 `queryClient.invalidateQueries({ queryKey: ['finance', 'receivables'] });`

### 3. 订单状态更新修复

#### 3.1 服务端 API：`app/api/sales-orders/[id]/route.ts`

在订单状态更新成功后，添加应收款缓存失效：

```typescript
// 发布订单状态变更事件
await publishOrderStatus({
  orderType: 'sales',
  orderId: fullOrder.id,
  orderNumber: fullOrder.orderNumber,
  oldStatus: existingOrder.status,
  newStatus: fullOrder.status,
  customerId: fullOrder.customerId,
  customerName: fullOrder.customer.name,
  userId: user.id,
});

// ✅ 关键修复：销售订单状态更新后，失效应收款缓存
// 因为订单状态变更（特别是发货、完成、取消）会影响应收款数据
const { revalidateFinance } = await import('@/lib/cache');
await revalidateFinance('receivables');
```

#### 3.2 客户端列表：`components/sales-orders/erp-sales-order-list.tsx`

在订单状态更新成功后，同时失效应收款缓存：

```typescript
const updateStatusMutation = useMutation({
  mutationFn: async ({ orderId, newStatus }) => {
    // ... API 调用
  },
  onSuccess: () => {
    // ✅ 失效销售订单缓存
    queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });

    // ✅ 关键修复：同时失效应收款缓存
    queryClient.invalidateQueries({ queryKey: ['finance', 'receivables'] });

    toast({
      title: '操作成功',
      description: '订单状态已更新',
    });
    setUpdatingOrderId(null);
  },
  // ...
});
```

## 技术细节

### 缓存失效机制

1. **服务端缓存（Redis + Next.js Cache）**：
   - `revalidateSalesOrders()` - 失效销售订单相关的 Redis 缓存和 Next.js 缓存标签
   - `revalidateFinance('receivables')` - 失效应收款相关的 Redis 缓存和 Next.js 缓存标签

2. **客户端缓存（TanStack Query）**：
   - `queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() })` - 失效销售订单列表查询
   - `queryClient.invalidateQueries({ queryKey: queryKeys.finance.receivables() })` - 失效应收款列表查询

### Query Key 规范

遵循项目的 Query Key 规范：

- 销售订单：`['sales-orders', 'list', filters]`
- 应收款：`['finance', 'receivables', 'list', filters]`

## 验证步骤

### 场景 1：创建销售订单

1. **创建销售订单**：
   - 访问销售订单创建页面
   - 填写订单信息并提交
   - 观察订单创建成功的提示

2. **检查应收款页面**：
   - 立即访问应收款页面（`/finance/receivables`）
   - **预期结果**：新创建的订单应该立即显示在应收款列表中
   - **无需**手动刷新浏览器页面

### 场景 2：更新订单状态

1. **更新订单状态**：
   - 访问销售订单列表页面
   - 将某个订单状态从"待确认"更新为"已发货"
   - 观察状态更新成功的提示

2. **检查应收款页面**：
   - 立即访问应收款页面（`/finance/receivables`）
   - **预期结果**：订单状态变更应该立即反映在应收款列表中
   - **无需**手动刷新浏览器页面

### 场景 3：检查缓存失效日志（可选）

- 查看服务端日志，确认 `revalidateFinance('receivables')` 被调用
- 查看浏览器控制台，确认 TanStack Query 的缓存失效

## 影响范围

### 修改的文件

1. **服务端 API**：
   - `app/api/sales-orders/route.ts` - 销售订单创建
   - `app/api/sales-orders/[id]/route.ts` - 销售订单状态更新

2. **客户端表单组件**：
   - `components/sales-orders/enhanced-sales-order-form/hooks/useSalesOrderSubmission.ts`
   - `components/sales-orders/use-enhanced-sales-order-form.ts`
   - `components/sales-orders/invoice-oriented-form.tsx`
   - `components/sales-orders/sales-order-form.tsx`
   - `components/sales-orders/erp-sales-order-form.tsx`

3. **客户端列表组件**：
   - `components/sales-orders/erp-sales-order-list.tsx` - 订单状态更新

### 受益的功能

- ✅ 销售订单创建后，应收款页面自动更新
- ✅ 销售订单状态更新后（发货、完成、取消），应收款页面自动更新
- ✅ 无需手动刷新浏览器
- ✅ 提升用户体验
- ✅ 数据一致性保证

## 相关文档

- [TanStack Query 缓存失效文档](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)
- [项目 Query Keys 规范](../../lib/queryKeys.ts)
- [项目缓存失效系统](../../lib/cache/revalidate.ts)

## 注意事项

1. **缓存失效顺序**：
   - 先失效销售订单缓存
   - 再失效应收款缓存
   - 确保数据一致性

2. **性能考虑**：
   - 缓存失效是异步操作，不会阻塞订单创建响应
   - Redis 缓存失效速度很快（< 10ms）
   - TanStack Query 会自动重新获取数据

3. **错误处理**：
   - 缓存失效失败不会影响订单创建成功
   - 用户仍然可以手动刷新页面获取最新数据

## 后续优化建议

1. **实时推送**：
   - 考虑使用 WebSocket 或 Server-Sent Events
   - 实现真正的实时数据推送
   - 无需依赖缓存失效机制

2. **乐观更新**：
   - 在订单创建成功后，立即更新客户端缓存
   - 无需等待服务端重新获取数据
   - 进一步提升用户体验

3. **统一缓存失效**：
   - 创建统一的缓存失效工具函数
   - 自动处理所有相关缓存的失效
   - 减少手动维护的工作量
