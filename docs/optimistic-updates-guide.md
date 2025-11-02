# Optimistic Updates 实施指南

> 提升用户体验的关键技术 - 让操作响应时间从 1-2 秒降至 <100ms

## 📋 目录

- [什么是 Optimistic Updates](#什么是-optimistic-updates)
- [何时使用](#何时使用)
- [实施方案](#实施方案)
- [代码模板](#代码模板)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

---

## 什么是 Optimistic Updates

**Optimistic Updates（乐观更新）** 是一种前端优化技术，在用户执行操作时：

1. **立即更新 UI**（假设操作会成功）
2. **异步调用 API**（在后台执行）
3. **成功时保持 UI**（无需额外操作）
4. **失败时回滚 UI**（恢复到操作前的状态）

### 用户体验对比

| 场景         | 传统方式                        | Optimistic Updates        |
| ------------ | ------------------------------- | ------------------------- |
| **创建订单** | 点击 → 等待 1-2 秒 → 看到新订单 | 点击 → **立即**看到新订单 |
| **更新状态** | 点击 → 等待 → 状态变化          | 点击 → **立即**状态变化   |
| **删除记录** | 点击 → 等待 → 记录消失          | 点击 → **立即**记录消失   |

**响应时间提升**：1-2 秒 → <100ms（**提升 90%+**）

---

## 何时使用

### ✅ 适合使用的场景

- ✅ **用户操作频繁**（如状态切换、快速编辑）
- ✅ **操作成功率高**（>95%，如创建、更新、删除）
- ✅ **操作结果可预测**（客户端可以准确预测服务端响应）
- ✅ **用户体验优先**（需要即时反馈的场景）

### ❌ 不适合使用的场景

- ❌ **复杂的服务端验证**（如库存检查、权限验证）
- ❌ **依赖外部系统响应**（如支付、第三方 API）
- ❌ **操作失败率高**（>5%）
- ❌ **操作结果不可预测**（如复杂计算、AI 生成）

---

## 实施方案

### 方案 A：TanStack Query `onMutate`（推荐）

**适用场景**：列表数据的增删改

**优点**：

- ✅ 完全控制缓存更新
- ✅ 自动回滚机制
- ✅ 与现有代码兼容
- ✅ 类型安全

**缺点**：

- ⚠️ 需要手动管理缓存结构
- ⚠️ 代码量较大

---

### 方案 B：React 19 `useOptimistic`（简化版）

**适用场景**：单个字段的更新

**优点**：

- ✅ 代码简洁
- ✅ 自动回滚
- ✅ React 19 原生支持

**缺点**：

- ⚠️ 仅适用于简单场景
- ⚠️ 需要 React 19

---

## 代码模板

### 模板 1：创建列表项（使用工具函数）

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOptimisticListMutation } from '@/lib/utils/optimistic-updates';
import { queryKeys } from '@/lib/queryKeys';

export function useCreateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSalesOrder,

    // ✅ 使用工具函数简化代码
    ...createOptimisticListMutation({
      queryKey: queryKeys.salesOrders.lists(),
      generateTempItem: data => ({
        ...data,
        id: `temp-${Date.now()}`, // 临时 ID
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      position: 'start', // 插入到列表开头
    }),

    // ✅ 成功后失效相关缓存
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.receivables(),
      });
    },
  });
}
```

---

### 模板 2：更新列表项（使用工具函数）

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOptimisticUpdateMutation } from '@/lib/utils/optimistic-updates';
import { queryKeys } from '@/lib/queryKeys';

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOrderStatus,

    // ✅ 使用工具函数简化代码
    ...createOptimisticUpdateMutation({
      queryKey: queryKeys.salesOrders.lists(),
      getItemId: vars => vars.orderId,
      updateItem: (item, vars) => ({
        ...item,
        status: vars.status,
        updatedAt: new Date().toISOString(),
      }),
    }),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.all,
      });
    },
  });
}
```

---

### 模板 3：删除列表项（使用工具函数）

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOptimisticDeleteMutation } from '@/lib/utils/optimistic-updates';
import { queryKeys } from '@/lib/queryKeys';

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteOrder,

    // ✅ 使用工具函数简化代码
    ...createOptimisticDeleteMutation({
      queryKey: queryKeys.salesOrders.lists(),
      getItemId: vars => vars.orderId,
    }),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.all,
      });
    },
  });
}
```

---

### 模板 4：React 19 `useOptimistic`（简单场景）

```typescript
'use client';

import { useOptimistic } from 'react';
import { useMutation } from '@tanstack/react-query';

export function OrderStatusButton({ order }) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    order.status,
    (_currentStatus, newStatus: string) => newStatus
  );

  const updateMutation = useMutation({
    mutationFn: updateOrderStatus,
  });

  async function handleStatusChange(newStatus: string) {
    // ✅ 立即更新 UI
    setOptimisticStatus(newStatus);

    try {
      // ✅ 调用 API
      await updateMutation.mutateAsync({
        orderId: order.id,
        status: newStatus,
      });
    } catch (error) {
      // ✅ 失败时自动回滚（React 自动处理）
      console.error('更新失败:', error);
    }
  }

  return (
    <Select value={optimisticStatus} onChange={handleStatusChange}>
      <option value="draft">草稿</option>
      <option value="confirmed">已确认</option>
      <option value="shipped">已发货</option>
    </Select>
  );
}
```

---

## 最佳实践

### 1. 始终提供回滚机制

```typescript
// ✅ 正确：保存回滚上下文
onMutate: async (variables) => {
  const previousData = queryClient.getQueryData(queryKey);
  // ... 更新缓存
  return { previousData }; // ✅ 返回回滚上下文
},

onError: (_err, _variables, context) => {
  if (context?.previousData) {
    queryClient.setQueryData(queryKey, context.previousData); // ✅ 回滚
  }
},
```

---

### 2. 使用临时 ID

```typescript
// ✅ 正确：使用可识别的临时 ID
generateTempItem: (data) => ({
  ...data,
  id: `temp-${Date.now()}`, // ✅ 临时 ID，易于识别
  // ...
}),

// ❌ 错误：使用随机 ID
id: Math.random().toString(), // ❌ 难以调试
```

---

### 3. 失效相关缓存

```typescript
// ✅ 正确：失效所有相关缓存
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.finance.receivables() });
  queryClient.invalidateQueries({ queryKey: queryKeys.finance.stats() });
},

// ❌ 错误：只失效部分缓存
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
  // ❌ 忘记失效应收款和统计数据
},
```

---

### 4. 添加加载状态

```typescript
// ✅ 正确：显示加载状态
const mutation = useMutation({ /* ... */ });

return (
  <Button
    onClick={() => mutation.mutate(data)}
    disabled={mutation.isPending}
  >
    {mutation.isPending ? '提交中...' : '提交'}
  </Button>
);
```

---

## 常见问题

### Q1: 如何处理复杂的缓存结构？

**A**: 使用工具函数 `createOptimisticListMutation` 等，它们已经处理了分页、总数等复杂逻辑。

---

### Q2: 如何测试 Optimistic Updates？

**A**: 测试以下场景：

1. **成功场景**：操作成功，UI 保持更新
2. **失败场景**：操作失败，UI 自动回滚
3. **网络延迟场景**：慢速网络下的表现

```typescript
// 测试失败场景
test('should rollback on error', async () => {
  const { result } = renderHook(() => useCreateOrder());

  // 模拟失败
  server.use(
    http.post('/api/orders', () => {
      return HttpResponse.error();
    })
  );

  await result.current.mutateAsync(orderData);

  // 验证回滚
  expect(queryClient.getQueryData(queryKey)).toEqual(previousData);
});
```

---

### Q3: 如何处理多个缓存同时更新？

**A**: 在 `onMutate` 中保存所有相关缓存，在 `onError` 中全部回滚：

```typescript
onMutate: async (variables) => {
  const previousOrders = queryClient.getQueryData(ordersKey);
  const previousReceivables = queryClient.getQueryData(receivablesKey);

  // 更新所有缓存
  queryClient.setQueryData(ordersKey, /* ... */);
  queryClient.setQueryData(receivablesKey, /* ... */);

  return { previousOrders, previousReceivables };
},

onError: (_err, _variables, context) => {
  // 回滚所有缓存
  if (context?.previousOrders) {
    queryClient.setQueryData(ordersKey, context.previousOrders);
  }
  if (context?.previousReceivables) {
    queryClient.setQueryData(receivablesKey, context.previousReceivables);
  }
},
```

---

## 参考资源

- [TanStack Query - Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [React 19 - useOptimistic](https://react.dev/reference/react/useOptimistic)
- [项目技术栈审查报告](../claudedocs/tech-stack-audit-2025-01-02.md)

---

**最后更新**：2025-01-02  
**维护者**：开发团队
