# 厂家发货、客户直发、仓库进货模块缓存管理检查报告

> 全面检查三个模块的缓存使用情况，确保数据一致性和实时性

**检查时间**: 2025-01-14
**检查范围**: 厂家发货、客户直发、仓库进货模块
**检查人**: Augment Agent

---

## 📋 目录

- [检查概况](#检查概况)
- [发现的问题](#发现的问题)
- [详细分析](#详细分析)
- [修复建议](#修复建议)
- [统计数据](#统计数据)

---

## 检查概况

### 检查范围

| 模块 | 检查文件数 | 发现问题数 | 优先级分布 |
|------|-----------|-----------|-----------|
| **厂家发货模块** | 15+ | 2 | P1: 2 |
| **客户直发模块** | 5+ | 0 | - |
| **仓库进货模块** | 8+ | 1 | P0: 1 |

### 总体评估

- ✅ **客户直发模块**: 缓存管理完善，已使用统一的缓存刷新工具函数
- ⚠️ **厂家发货模块**: 存在 P1 问题（重复定义 Query Keys）
- ❌ **仓库进货模块**: 存在 P0 问题（未使用 TanStack Query）

---

## 发现的问题

### P0 问题（严重 - 影响数据一致性）

#### P0-1: 仓库进货模块未使用 TanStack Query

**问题类型**: 缺少 TanStack Query 实现
**模块**: 仓库进货
**影响范围**: 整个仓库进货模块的数据获取和缓存管理

**问题描述**:
- 仓库进货模块（`app/(dashboard)/inventory/inbound/`）未使用 TanStack Query
- 相关组件（`components/inventory/erp-inbound-form.tsx`、`components/inventory/erp-inbound-records.tsx`）中没有找到 `useQuery`、`useMutation`、`queryClient` 等 TanStack Query 相关代码
- 可能仍在使用 Server Actions 或其他方式获取数据

**影响**:
- ❌ 无法利用 TanStack Query 的缓存机制
- ❌ 数据刷新不及时，可能导致数据不一致
- ❌ 无法与其他模块的缓存管理统一
- ❌ 仓库进货确认后，库存缓存可能不会自动刷新

**建议修复**:
1. 在 `lib/api/` 下创建 `inbound.ts` 文件
2. 定义入库相关的 API 函数和 mutation hooks
3. 使用 `lib/queryKeys.ts` 中已定义的 `inventoryKeys.inbounds()` 等 Query Keys
4. 在入库确认后刷新库存缓存和采购订单缓存
5. 更新相关组件使用 TanStack Query

**预估工作量**: 3-4 小时

---

### P1 问题（中等 - 代码质量）

#### P1-1: 厂家发货模块重复定义 Query Keys

**问题类型**: 重复定义 Query Keys
**模块**: 厂家发货
**文件**: `lib/api/factory-shipments.ts`
**行号**: 85-92

**问题描述**:
```typescript
// ❌ 错误：在 lib/api/factory-shipments.ts 中重复定义 Query Keys
export const factoryShipmentQueryKeys = {
  all: ['factory-shipments'] as const,
  lists: () => [...factoryShipmentQueryKeys.all, 'list'] as const,
  list: (params: FactoryShipmentOrderListParams) =>
    [...factoryShipmentQueryKeys.lists(), params] as const,
  details: () => [...factoryShipmentQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...factoryShipmentQueryKeys.details(), id] as const,
};
```

**已存在的定义**:
```typescript
// ✅ 正确：lib/queryKeys.ts 中已有定义
export const factoryShipmentKeys = {
  all: ['factory-shipments'] as const,
  lists: () => [...factoryShipmentKeys.all, 'list'] as const,
  list: (filters?: BaseFilters & { status?: string }) =>
    [...factoryShipmentKeys.lists(), filters] as const,
  details: () => [...factoryShipmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...factoryShipmentKeys.details(), id] as const,
  // ... 更多方法
};
```

**影响**:
- ⚠️ 代码重复，增加维护成本
- ⚠️ 两处定义可能不一致
- ⚠️ 违反 DRY 原则

**引用位置**:
1. `lib/api/factory-shipments.ts` - 所有 mutation hooks 中使用
2. `components/factory-shipments/confirm-shipment-dialog.tsx` - 第 32 行导入
3. `components/factory-shipments/factory-shipment-order-form.tsx` - 可能使用

**建议修复**:
1. 删除 `lib/api/factory-shipments.ts` 中的 `factoryShipmentQueryKeys` 定义
2. 添加 `import { queryKeys } from '@/lib/queryKeys'`
3. 替换所有引用：`factoryShipmentQueryKeys.*` → `queryKeys.factoryShipments.*`
4. 更新所有导入该 Query Keys 的组件

**预估工作量**: 1-2 小时

---

#### P1-2: 厂家发货模块缺少跨模块缓存刷新

**问题类型**: 缓存刷新遗漏
**模块**: 厂家发货
**文件**: `lib/api/factory-shipments.ts`
**行号**: 310-326, 331-358, 363-390

**问题描述**:
厂家发货订单的创建/更新/状态变更操作后，只刷新了厂家发货相关的缓存，但没有刷新关联模块的缓存：

```typescript
// ❌ 问题：只刷新了厂家发货缓存
export function useCreateFactoryShipmentOrder() {
  return useMutation({
    mutationFn: createFactoryShipmentOrder,
    onSuccess: () => {
      // ✅ 刷新厂家发货列表
      queryClient.refetchQueries({
        predicate: query =>
          query.queryKey[0] === 'factory-shipments' &&
          query.queryKey[1] === 'list',
        type: 'active',
      });
      
      // ❌ 缺少：刷新库存缓存（厂家发货会影响库存）
      // ❌ 缺少：刷新采购订单缓存（厂家发货可能关联采购订单）
      // ❌ 缺少：刷新仪表盘缓存
    },
  });
}
```

**影响**:
- ⚠️ 厂家发货确认后，库存数据可能不会立即更新
- ⚠️ 仪表盘数据可能不准确
- ⚠️ 用户需要手动刷新页面才能看到最新数据

**建议修复**:
在 `onSuccess` 回调中添加以下缓存刷新：

```typescript
export function useCreateFactoryShipmentOrder() {
  return useMutation({
    mutationFn: createFactoryShipmentOrder,
    onSuccess: () => {
      // ✅ 刷新厂家发货列表
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
  });
}
```

**预估工作量**: 30分钟

---

## 详细分析

### 1. 厂家发货模块

#### 1.1 Query Keys 定义检查

**当前状态**:
- ❌ 在 `lib/api/factory-shipments.ts` 中重复定义了 `factoryShipmentQueryKeys`
- ✅ `lib/queryKeys.ts` 中已有 `factoryShipmentKeys` 定义

**问题**:
- 两处定义不完全一致
- `lib/queryKeys.ts` 中的定义更完整（包含 `orders` 相关方法）
- 违反了"单一数据源"原则

#### 1.2 缓存刷新逻辑检查

**创建厂家发货订单** (`useCreateFactoryShipmentOrder`):
- ✅ 刷新厂家发货列表
- ❌ 缺少库存缓存刷新
- ❌ 缺少仪表盘缓存刷新

**更新厂家发货订单** (`useUpdateFactoryShipmentOrder`):
- ✅ 刷新厂家发货详情
- ✅ 刷新厂家发货列表
- ❌ 缺少库存缓存刷新
- ❌ 缺少仪表盘缓存刷新

**更新厂家发货订单状态** (`useUpdateFactoryShipmentOrderStatus`):
- ✅ 刷新厂家发货详情
- ✅ 刷新厂家发货列表
- ❌ 缺少库存缓存刷新（特别是确认发货后）
- ❌ 缺少仪表盘缓存刷新

**删除厂家发货订单** (`useDeleteFactoryShipmentOrder`):
- ✅ 刷新厂家发货列表
- ✅ 适当（删除操作通常不影响库存）

#### 1.3 TanStack Query 使用检查

- ✅ 所有数据获取都使用了 TanStack Query
- ✅ 使用了 `useQuery` 和 `useMutation` hooks
- ✅ 正确设置了 `staleTime`（5分钟）
- ✅ 使用了 `refetchQueries` 进行立即刷新

---

### 2. 客户直发模块

#### 2.1 Query Keys 定义检查

- ✅ 使用 `lib/queryKeys.ts` 中的统一定义
- ✅ 无重复定义

#### 2.2 缓存刷新逻辑检查

**创建客户直发订单** (在 `components/sales-orders/erp-sales-order-form.tsx` 中):
```typescript
const createMutation = useMutation({
  mutationFn: createSalesOrder,
  onSuccess: (data, variables) => {
    // ✅ 使用统一的缓存刷新工具函数
    if (
      variables.orderType === 'TRANSFER' &&
      variables.transferMode === 'SUPPLIER_ONLY'
    ) {
      // ✅ 客户直发订单：刷新销售订单、采购订单、应收款、应付款、仪表盘
      invalidateCustomerDirectShipmentCaches(queryClient);
    } else {
      // ✅ 普通订单：刷新销售订单、应收款、仪表盘
      invalidateSalesOrderCaches(queryClient);
    }
    
    // ✅ 同时失效财务概览
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.overview(),
    });
  },
});
```

**评估**:
- ✅ 正确识别客户直发订单类型
- ✅ 使用了专门的缓存刷新工具函数 `invalidateCustomerDirectShipmentCaches`
- ✅ 刷新了所有相关模块的缓存（销售订单、采购订单、应收款、应付款、仪表盘）
- ✅ 额外刷新了财务概览缓存
- ✅ 代码质量高，符合最佳实践

#### 2.3 TanStack Query 使用检查

- ✅ 使用了 TanStack Query
- ✅ 正确使用了 `useMutation` hook
- ✅ 缓存刷新逻辑完善

---

### 3. 仓库进货模块

#### 3.1 Query Keys 定义检查

- ✅ `lib/queryKeys.ts` 中已定义 `inventoryKeys.inbounds()` 等方法
- ❌ 但未在实际代码中使用

#### 3.2 缓存刷新逻辑检查

- ❌ 未找到相关的缓存刷新逻辑
- ❌ 未使用 TanStack Query

#### 3.3 TanStack Query 使用检查

**检查的文件**:
1. `components/inventory/erp-inbound-form.tsx` - ❌ 未使用 TanStack Query
2. `components/inventory/erp-inbound-records.tsx` - ❌ 未使用 TanStack Query
3. `app/(dashboard)/inventory/inbound/page-client.tsx` - ❌ 未使用 TanStack Query

**问题**:
- ❌ 整个仓库进货模块未使用 TanStack Query
- ❌ 可能仍在使用 Server Actions 或其他方式
- ❌ 无法利用缓存机制
- ❌ 数据刷新不及时

---

## 修复建议

### 优先级 P0: 仓库进货模块迁移到 TanStack Query

**步骤**:

1. **创建 API 客户端** (`lib/api/inbound.ts`):
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

// 获取入库记录列表
export async function getInboundRecords(params: InboundQueryParams) {
  // ... API 调用
}

// 创建入库记录
export async function createInboundRecord(data: CreateInboundData) {
  // ... API 调用
}

// 确认入库
export async function confirmInboundRecord(id: string) {
  // ... API 调用
}

// React Query Hooks
export function useInboundRecords(params: InboundQueryParams) {
  return useQuery({
    queryKey: queryKeys.inventory.inboundsList(params),
    queryFn: () => getInboundRecords(params),
  });
}

export function useCreateInboundRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createInboundRecord,
    onSuccess: () => {
      // 刷新入库记录列表
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.inbounds(),
        type: 'active',
      });
    },
  });
}

export function useConfirmInboundRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: confirmInboundRecord,
    onSuccess: () => {
      // 刷新入库记录列表
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.inbounds(),
        type: 'active',
      });
      
      // ✅ 刷新库存缓存（入库会影响库存）
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      
      // ✅ 刷新采购订单缓存（入库可能关联采购订单）
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.all,
      });
      
      // ✅ 刷新仪表盘缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
    },
  });
}
```

2. **更新组件使用 TanStack Query**:
   - 更新 `components/inventory/erp-inbound-form.tsx`
   - 更新 `components/inventory/erp-inbound-records.tsx`
   - 使用 `useInboundRecords`、`useCreateInboundRecord`、`useConfirmInboundRecord` hooks

3. **测试**:
   - 测试入库记录列表加载
   - 测试创建入库记录
   - 测试确认入库后库存是否更新
   - 测试缓存刷新是否正常

**预估工作量**: 3-4 小时

---

### 优先级 P1: 统一厂家发货模块 Query Keys

**步骤**:

1. **删除重复定义**:
   - 删除 `lib/api/factory-shipments.ts` 第 85-92 行的 `factoryShipmentQueryKeys` 定义

2. **添加导入**:
```typescript
import { queryKeys } from '@/lib/queryKeys';
```

3. **替换所有引用**:
   - `factoryShipmentQueryKeys.all` → `queryKeys.factoryShipments.all`
   - `factoryShipmentQueryKeys.lists()` → `queryKeys.factoryShipments.lists()`
   - `factoryShipmentQueryKeys.list(params)` → `queryKeys.factoryShipments.list(params)`
   - `factoryShipmentQueryKeys.details()` → `queryKeys.factoryShipments.details()`
   - `factoryShipmentQueryKeys.detail(id)` → `queryKeys.factoryShipments.detail(id)`

4. **更新组件导入**:
   - `components/factory-shipments/confirm-shipment-dialog.tsx`
   - `components/factory-shipments/factory-shipment-order-form.tsx`
   - 其他使用 `factoryShipmentQueryKeys` 的组件

**预估工作量**: 1-2 小时

---

### 优先级 P1: 添加厂家发货模块跨模块缓存刷新

**步骤**:

在 `lib/api/factory-shipments.ts` 的以下 hooks 中添加缓存刷新：

1. **`useCreateFactoryShipmentOrder`**:
```typescript
onSuccess: () => {
  // 现有代码...
  
  // ✅ 添加：刷新库存缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.inventory.all,
  });
  
  // ✅ 添加：刷新仪表盘缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.all,
  });
}
```

2. **`useUpdateFactoryShipmentOrder`**:
```typescript
onSuccess: (_, { id }) => {
  // 现有代码...
  
  // ✅ 添加：刷新库存缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.inventory.all,
  });
  
  // ✅ 添加：刷新仪表盘缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.all,
  });
}
```

3. **`useUpdateFactoryShipmentOrderStatus`**:
```typescript
onSuccess: (_, { id }) => {
  // 现有代码...
  
  // ✅ 添加：刷新库存缓存（特别是确认发货后）
  queryClient.invalidateQueries({
    queryKey: queryKeys.inventory.all,
  });
  
  // ✅ 添加：刷新仪表盘缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.all,
  });
}
```

**预估工作量**: 30分钟

---

## 统计数据

### 检查文件统计

| 模块 | 检查文件数 | 组件文件 | API文件 | 页面文件 |
|------|-----------|---------|---------|---------|
| **厂家发货** | 15+ | 10+ | 1 | 4+ |
| **客户直发** | 5+ | 3+ | 1 | 1+ |
| **仓库进货** | 8+ | 6+ | 0 | 2+ |
| **总计** | 28+ | 19+ | 2 | 7+ |

### 问题统计

| 优先级 | 问题数量 | 预估修复时间 |
|--------|---------|-------------|
| **P0（严重）** | 1 | 3-4 小时 |
| **P1（中等）** | 2 | 1.5-2.5 小时 |
| **P2（轻微）** | 0 | - |
| **总计** | 3 | 4.5-6.5 小时 |

### 模块评分

| 模块 | Query Keys | 缓存刷新 | TanStack Query | 总分 |
|------|-----------|---------|---------------|------|
| **厂家发货** | ⚠️ 60/100 | ⚠️ 70/100 | ✅ 100/100 | ⚠️ 77/100 |
| **客户直发** | ✅ 100/100 | ✅ 100/100 | ✅ 100/100 | ✅ 100/100 |
| **仓库进货** | ✅ 100/100 | ❌ 0/100 | ❌ 0/100 | ❌ 33/100 |

---

## 总结

### 主要发现

1. **客户直发模块** ✅
   - 缓存管理完善
   - 正确使用了统一的缓存刷新工具函数
   - 代码质量高，符合最佳实践

2. **厂家发货模块** ⚠️
   - 存在重复定义 Query Keys 的问题
   - 缺少跨模块缓存刷新
   - 但已使用 TanStack Query，基础架构良好

3. **仓库进货模块** ❌
   - 未使用 TanStack Query
   - 缺少缓存管理
   - 需要完整重构

### 下一步行动

**立即执行**（P0 问题）:
1. 仓库进货模块迁移到 TanStack Query（3-4 小时）

**尽快执行**（P1 问题）:
1. 统一厂家发货模块 Query Keys（1-2 小时）
2. 添加厂家发货模块跨模块缓存刷新（30分钟）

**总预估工作量**: 4.5-6.5 小时

---

**报告生成时间**: 2025-01-14
**报告作者**: Augment Agent
**版本**: 1.0.0

