# P1 问题修复总结：厂家发货模块缓存管理优化

> 统一 Query Keys 并添加跨模块缓存刷新，提升代码质量和数据一致性

**修复时间**: 2025-01-14
**优先级**: P1（重要 - 影响代码质量和数据一致性）
**修复人**: Augment Agent

---

## 📋 问题描述

根据缓存管理检查报告（`.augment/analysis/factory-shipment-inbound-cache-check.md`），厂家发货模块存在以下 P1 问题：

### P1-1: 重复定义 Query Keys

**问题**:

- `lib/api/factory-shipments.ts` 第 85-92 行重复定义了 `factoryShipmentQueryKeys`
- `lib/queryKeys.ts` 中已有 `factoryShipmentKeys` 定义
- 违反 DRY 原则，增加维护成本

**影响**:

- ❌ 代码重复，维护困难
- ❌ 可能导致 Query Keys 不一致
- ❌ 违反项目统一约定规范

### P1-2: 缺少跨模块缓存刷新

**问题**:

- 厂家发货订单的创建/更新/状态变更操作后，只刷新了厂家发货相关的缓存
- 缺少库存缓存刷新（厂家发货会影响库存）
- 缺少仪表盘缓存刷新

**影响**:

- ❌ 厂家发货确认后，库存数据可能不会立即更新
- ❌ 仪表盘数据可能不准确
- ❌ 用户需要手动刷新页面才能看到最新数据

---

## ✅ 修复内容

### 1. 统一 Query Keys 定义

#### 1.1 添加 queryKeys 导入

**文件**: `lib/api/factory-shipments.ts` (第 6-9 行)

**修改前**:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';
```

**修改后**:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';
```

#### 1.2 删除重复的 Query Keys 定义

**文件**: `lib/api/factory-shipments.ts` (第 85-92 行)

**删除的代码**:

```typescript
// Query Keys
export const factoryShipmentQueryKeys = {
  all: ['factory-shipments'] as const,
  lists: () => [...factoryShipmentQueryKeys.all, 'list'] as const,
  list: (params: FactoryShipmentOrderListParams) =>
    [...factoryShipmentQueryKeys.lists(), params] as const,
  details: () => [...factoryShipmentQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...factoryShipmentQueryKeys.details(), id] as const,
};
```

#### 1.3 替换所有 Query Keys 引用

**文件**: `lib/api/factory-shipments.ts`

**修改位置**:

- 第 279 行: `useFactoryShipmentOrders` hook
- 第 290 行: `useFactoryShipmentOrder` hook
- 第 337 行: `useUpdateFactoryShipmentOrder` hook
- 第 379 行: `useUpdateFactoryShipmentOrderStatus` hook
- 第 442 行: `useUpdateFactoryShipmentOrderContainerNumber` hook
- 第 526 行: `useUpdateFactoryShipmentOrderShippingCompany` hook
- 第 571 行: `useCancelFactoryShipmentOrder` hook

**替换规则**:

```typescript
// 修改前
factoryShipmentQueryKeys.list(params);
factoryShipmentQueryKeys.detail(id);
factoryShipmentQueryKeys.lists();

// 修改后
queryKeys.factoryShipments.list(params);
queryKeys.factoryShipments.detail(id);
queryKeys.factoryShipments.lists();
```

#### 1.4 更新组件导入

**文件**: `components/factory-shipments/confirm-shipment-dialog.tsx` (第 30-33 行)

**修改前**:

```typescript
import { useToast } from '@/components/ui/use-toast';
import {
  factoryShipmentQueryKeys,
  useUpdateFactoryShipmentOrderStatus,
} from '@/lib/api/factory-shipments';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';
```

**修改后**:

```typescript
import { useToast } from '@/components/ui/use-toast';
import { useUpdateFactoryShipmentOrderStatus } from '@/lib/api/factory-shipments';
import { queryKeys } from '@/lib/queryKeys';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';
```

**替换组件中的引用** (第 119-122 行):

```typescript
// 修改前
queryClient.invalidateQueries({
  queryKey: factoryShipmentQueryKeys.detail(orderId),
});
queryClient.invalidateQueries({
  queryKey: factoryShipmentQueryKeys.lists(),
});

// 修改后
queryClient.invalidateQueries({
  queryKey: queryKeys.factoryShipments.detail(orderId),
});
queryClient.invalidateQueries({
  queryKey: queryKeys.factoryShipments.lists(),
});
```

---

### 2. 添加跨模块缓存刷新

#### 2.1 优化 `useUpdateFactoryShipmentOrder`

**文件**: `lib/api/factory-shipments.ts` (第 333-357 行)

**添加的缓存刷新**:

```typescript
onSuccess: (_, { id }) => {
  // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新发货单后立即看到变化
  // 刷新详情页
  queryClient.refetchQueries({
    queryKey: queryKeys.factoryShipments.detail(id),
    type: 'active',
  });
  // 刷新所有列表查询（使用 predicate 匹配所有列表查询）
  queryClient.refetchQueries({
    predicate: query =>
      query.queryKey[0] === 'factory-shipments' &&
      query.queryKey[1] === 'list',
    type: 'active',
  });

  // ✅ 刷新库存缓存（厂家发货会影响库存）
  queryClient.invalidateQueries({
    queryKey: queryKeys.inventory.all,
  });

  // ✅ 刷新仪表盘缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.all,
  });
},
```

#### 2.2 优化 `useUpdateFactoryShipmentOrderStatus`

**文件**: `lib/api/factory-shipments.ts` (第 375-399 行)

**添加的缓存刷新**:

```typescript
onSuccess: (_, { id }) => {
  // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新状态后立即看到变化
  // 刷新详情页
  queryClient.refetchQueries({
    queryKey: queryKeys.factoryShipments.detail(id),
    type: 'active',
  });
  // 刷新所有列表查询（使用 predicate 匹配所有列表查询）
  queryClient.refetchQueries({
    predicate: query =>
      query.queryKey[0] === 'factory-shipments' &&
      query.queryKey[1] === 'list',
    type: 'active',
  });

  // ✅ 刷新库存缓存（厂家发货会影响库存）
  queryClient.invalidateQueries({
    queryKey: queryKeys.inventory.all,
  });

  // ✅ 刷新仪表盘缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.all,
  });
},
```

---

## 📊 修复统计

### 修改文件

| 文件                                                       | 修改行数 | 修改类型                               |
| ---------------------------------------------------------- | -------- | -------------------------------------- |
| `lib/api/factory-shipments.ts`                             | 约 50 行 | 删除重复定义 + 替换引用 + 添加缓存刷新 |
| `components/factory-shipments/confirm-shipment-dialog.tsx` | 约 10 行 | 更新导入 + 替换引用                    |

### Query Keys 统一情况

| 操作                                 | 修改前                                | 修改后                                  |
| ------------------------------------ | ------------------------------------- | --------------------------------------- |
| **获取厂家发货订单列表**             | `factoryShipmentQueryKeys.list()`     | `queryKeys.factoryShipments.list()`     |
| **获取厂家发货订单详情**             | `factoryShipmentQueryKeys.detail(id)` | `queryKeys.factoryShipments.detail(id)` |
| **获取厂家发货订单列表（复数形式）** | `factoryShipmentQueryKeys.lists()`    | `queryKeys.factoryShipments.lists()`    |

### 缓存刷新策略对比

| 操作                     | 修改前                | 修改后                                           |
| ------------------------ | --------------------- | ------------------------------------------------ |
| **更新厂家发货订单**     | 刷新详情页 + 刷新列表 | ✅ 刷新详情页 + 刷新列表 + 刷新库存 + 刷新仪表盘 |
| **更新厂家发货订单状态** | 刷新详情页 + 刷新列表 | ✅ 刷新详情页 + 刷新列表 + 刷新库存 + 刷新仪表盘 |
| **更新集装箱号**         | 刷新详情页 + 刷新列表 | 刷新详情页 + 刷新列表（无需刷新库存和仪表盘）    |
| **更新船公司名称**       | 刷新详情页 + 刷新列表 | 刷新详情页 + 刷新列表（无需刷新库存和仪表盘）    |
| **取消订单**             | 刷新详情页 + 刷新列表 | 刷新详情页 + 刷新列表（无需刷新库存和仪表盘）    |

### 代码质量

- ✅ 所有代码通过 ESLint 检查
- ✅ 所有代码通过 TypeScript 检查
- ✅ 无新增错误或警告
- ✅ 符合项目代码规范

---

## 🎯 技术实现

### 1. 统一 Query Keys 的好处

**遵循 DRY 原则**:

- ✅ 单一数据源，避免重复定义
- ✅ 修改 Query Keys 时只需修改一处
- ✅ 降低维护成本

**符合项目规范**:

- ✅ 所有 Query Keys 集中在 `lib/queryKeys.ts`
- ✅ 使用统一的命名规范 `queryKeys.entity.method()`
- ✅ 便于团队协作和代码审查

### 2. 跨模块缓存刷新策略

**立即刷新** (`refetchQueries`):

- 用于厂家发货订单详情和列表
- 立即重新获取数据
- 用户可以立即看到最新数据

**延迟刷新** (`invalidateQueries`):

- 用于库存和仪表盘
- 标记数据为过期，下次访问时重新获取
- 避免不必要的网络请求

### 3. 选择性刷新

**需要刷新库存和仪表盘的操作**:

- ✅ 更新厂家发货订单（可能修改数量）
- ✅ 更新厂家发货订单状态（确认发货会影响库存）

**不需要刷新库存和仪表盘的操作**:

- ✅ 更新集装箱号（只是元数据修改）
- ✅ 更新船公司名称（只是元数据修改）
- ✅ 取消订单（已在其他地方处理）

---

## ✅ 验证结果

### 代码检查

```bash
# ESLint 检查
npm run lint -- lib/api/factory-shipments.ts components/factory-shipments/confirm-shipment-dialog.tsx
# ✅ 通过

# TypeScript 检查
npm run type-check
# ✅ 无错误
```

### 功能验证

**测试场景**:

1. ✅ 更新厂家发货订单后，详情页立即更新
2. ✅ 更新厂家发货订单后，列表页立即更新
3. ✅ 更新厂家发货订单后，库存数据自动更新
4. ✅ 更新厂家发货订单后，仪表盘数据自动更新
5. ✅ 确认发货后，库存数据自动更新
6. ✅ 确认发货后，仪表盘数据自动更新

---

## 📈 改进效果

### 代码质量

- ✅ **消除重复代码**: 删除了重复的 Query Keys 定义
- ✅ **统一命名规范**: 所有 Query Keys 使用 `queryKeys.entity.method()` 格式
- ✅ **符合 DRY 原则**: 单一数据源，易于维护

### 数据一致性

- ✅ **厂家发货订单**: 立即刷新，用户可以立即看到最新数据
- ✅ **库存数据**: 自动刷新，确保库存数据准确
- ✅ **仪表盘**: 自动刷新，确保统计数据准确

### 用户体验

- ✅ 无需手动刷新页面
- ✅ 数据实时更新
- ✅ 跨模块数据一致

---

## 🎉 总结

### 主要成果

1. ✅ **修复了 P1-1 问题**: 统一了厂家发货模块的 Query Keys 定义
2. ✅ **修复了 P1-2 问题**: 添加了跨模块缓存刷新（库存、仪表盘）
3. ✅ **提升了代码质量**: 消除重复代码，符合 DRY 原则
4. ✅ **改善了数据一致性**: 确保厂家发货操作后相关模块数据自动更新

### 技术亮点

- ✅ 使用统一的 Query Keys 定义（`lib/queryKeys.ts`）
- ✅ 使用 `refetchQueries` 进行立即刷新
- ✅ 使用 `invalidateQueries` 进行延迟刷新
- ✅ 选择性刷新，避免不必要的网络请求

### 下一步建议

1. **推广最佳实践**: 将统一 Query Keys 和跨模块缓存刷新的模式推广到其他模块
2. **定期检查**: 定期检查是否有重复定义的 Query Keys
3. **文档更新**: 更新项目文档，说明 Query Keys 的使用规范

---

**报告生成时间**: 2025-01-14
**报告作者**: Augment Agent
**相关文档**:

- `.augment/analysis/factory-shipment-inbound-cache-check.md` - 缓存管理检查报告
- `.augment/analysis/p0-inbound-cache-fix-summary.md` - P0 问题修复总结
- `lib/api/factory-shipments.ts` - 修改的文件
- `components/factory-shipments/confirm-shipment-dialog.tsx` - 修改的文件
