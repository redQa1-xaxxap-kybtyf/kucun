# 核心业务模块缓存管理检查报告

## 📋 检查概况

**检查时间**: 2025-01-14
**检查范围**: 5 个核心业务模块
**检查标准**: 参考退货订单、厂家发货、仓库进货模块的最佳实践
**完成状态**: ✅ 已完成

---

## 🎯 检查范围

### 优先级 1（核心业务模块）

1. **销售订单模块** (`lib/api/sales-orders.ts`)
2. **采购订单模块** (`lib/api/purchase-orders.ts`)
3. **库存调整模块** (`lib/api/inventory.ts`)
4. **客户管理模块** (`lib/api/customers.ts`)
5. **供应商管理模块** (`lib/api/suppliers.ts`)

---

## 🔍 检查结果

### 一、销售订单模块

**文件**: `lib/api/sales-orders.ts`

#### 架构分析

- ✅ **Query Keys 定义**: 使用 `salesOrderQueryKeys` 定义查询键
- ❌ **TanStack Query Mutation Hooks**: **不存在**
- ❌ **缓存管理**: **不适用**（未使用 TanStack Query 进行状态管理）

#### 代码结构

```typescript
// lib/api/sales-orders.ts
export const salesOrderQueryKeys = {
  all: ['sales-orders'] as const,
  lists: () => [...salesOrderQueryKeys.all, 'list'] as const,
  list: (params: SalesOrderQueryParams) =>
    [...salesOrderQueryKeys.lists(), params] as const,
  details: () => [...salesOrderQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...salesOrderQueryKeys.details(), id] as const,
  statistics: () => [...salesOrderQueryKeys.all, 'statistics'] as const,
  customer: (customerId: string) =>
    [...salesOrderQueryKeys.all, 'customer', customerId] as const,
};

// 只有基础 API 函数，没有 Mutation Hooks
export async function getSalesOrders(params: SalesOrderQueryParams) { ... }
export async function getSalesOrder(id: string) { ... }
export async function createSalesOrder(orderData: SalesOrderCreateInput) { ... }
export async function updateSalesOrder(data: SalesOrderUpdateInput) { ... }
export async function deleteSalesOrder(id: string) { ... }
export async function updateSalesOrderStatus(id: string, status: SalesOrderStatus, remarks?: string) { ... }
```

#### 使用方式

- **查询**: 使用 `useQuery` + `getSalesOrders`
- **修改**: 直接在页面组件中调用 API 函数（如 `createSalesOrder`、`updateSalesOrder`）
- **缓存刷新**: 手动调用 `router.refresh()` 或 `window.location.reload()`

#### 问题分析

**P0 问题**: 无（不使用 TanStack Query Mutation）

**P1 问题**: 无

**P2 问题（架构建议）**:

- 建议迁移到 TanStack Query Mutation Hooks 模式
- 建议添加统一的缓存管理策略
- 建议参考退货订单模块的实现

---

### 二、采购订单模块

**文件**: `lib/api/purchase-orders.ts`

#### 架构分析

- ✅ **Query Keys 定义**: 使用 `queryKeys.purchaseOrders`（集中管理）
- ❌ **TanStack Query Mutation Hooks**: **不存在**
- ❌ **缓存管理**: **不适用**（未使用 TanStack Query 进行状态管理）

#### 代码结构

```typescript
// lib/api/purchase-orders.ts
import { queryKeys } from '@/lib/queryKeys';

// 导出 Query Keys（从 queryKeys 中获取）
export const purchaseOrderQueryKeys = queryKeys.purchaseOrders;

// 只有基础 API 函数，没有 Mutation Hooks
export async function getPurchaseOrders(params: PurchaseOrderListParams) { ... }
export async function getPurchaseOrder(id: string) { ... }
```

#### 使用方式

- **查询**: 使用 `useQuery` + `getPurchaseOrders`
- **修改**: 直接在页面组件中调用 API 函数
- **缓存刷新**: 手动刷新

#### 问题分析

**P0 问题**: 无（不使用 TanStack Query Mutation）

**P1 问题**: 无

**P2 问题（架构建议）**:

- 建议迁移到 TanStack Query Mutation Hooks 模式
- 建议添加统一的缓存管理策略

---

### 三、库存调整模块

**文件**: `lib/api/inventory.ts`

#### 架构分析

- ✅ **Query Keys 定义**: 使用 `queryKeys.inventory`（集中管理）
- ❌ **TanStack Query Mutation Hooks**: **不存在**
- ❌ **缓存管理**: **不适用**（未使用 TanStack Query 进行状态管理）

#### 代码结构

```typescript
// lib/api/inventory.ts
import { queryKeys } from '@/lib/queryKeys';

// 导出兼容的查询键（使用集中管理的 queryKeys）
export const inventoryQueryKeys = queryKeys.inventory;

// 只有基础 API 函数，没有 Mutation Hooks
export async function getInventories(params: InventoryQueryParams) { ... }
export async function getInventory(productId: string) { ... }
export async function createInbound(inboundData: InboundCreateInput) { ... }
export async function createOutbound(outboundData: OutboundCreateInput) { ... }
export async function adjustInventory(adjustData: InventoryAdjustInput) { ... }
```

#### 使用方式

- **查询**: 使用 `useQuery` + `getInventories`
- **修改**: 直接在页面组件中调用 API 函数
- **缓存刷新**: 手动刷新

#### 问题分析

**P0 问题**: 无（不使用 TanStack Query Mutation）

**P1 问题**: 无

**P2 问题（架构建议）**:

- 建议迁移到 TanStack Query Mutation Hooks 模式
- 建议添加统一的缓存管理策略

---

### 四、客户管理模块

**文件**: `lib/api/customers.ts`

#### 架构分析

- ✅ **Query Keys 定义**: 使用 `customerQueryKeys` 定义查询键
- ❌ **TanStack Query Mutation Hooks**: **不存在**
- ❌ **缓存管理**: **不适用**（未使用 TanStack Query 进行状态管理）

#### 代码结构

```typescript
// lib/api/customers.ts
export const customerQueryKeys = {
  all: ['customers'] as const,
  lists: () => [...customerQueryKeys.all, 'list'] as const,
  list: (params: CustomerQueryParams) =>
    [...customerQueryKeys.lists(), params] as const,
  details: () => [...customerQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerQueryKeys.details(), id] as const,
  hierarchy: (id?: string) =>
    [...customerQueryKeys.all, 'hierarchy', id] as const,
  searches: () => [...customerQueryKeys.all, 'search'] as const,
  search: (query: string, options?: { limit?: number; excludeId?: string }) =>
    [...customerQueryKeys.searches(), query, options] as const,
};

// 只有基础 API 函数，没有 Mutation Hooks
export async function getCustomers(params: CustomerQueryParams) { ... }
export async function getCustomer(id: string) { ... }
export async function createCustomer(customerData: CustomerCreateInput) { ... }
export async function updateCustomer(id: string, customerData: CustomerUpdateInput) { ... }
export async function deleteCustomer(id: string) { ... }
```

#### 使用方式

- **查询**: 使用 `useQuery` + `getCustomers`（通过 `hooks/use-customers-query.ts`）
- **修改**: 直接在页面组件中调用 API 函数
- **缓存刷新**: 手动刷新

#### 问题分析

**P0 问题**: 无（不使用 TanStack Query Mutation）

**P1 问题**: 无

**P2 问题（架构建议）**:

- 建议迁移到 TanStack Query Mutation Hooks 模式
- 建议添加统一的缓存管理策略

---

### 五、供应商管理模块

**文件**: `lib/api/suppliers.ts`

#### 架构分析

- ✅ **Query Keys 定义**: 使用 `supplierQueryKeys` 定义查询键
- ❌ **TanStack Query Mutation Hooks**: **不存在**
- ❌ **缓存管理**: **不适用**（未使用 TanStack Query 进行状态管理）

#### 代码结构

```typescript
// lib/api/suppliers.ts
export const supplierQueryKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierQueryKeys.all, 'list'] as const,
  list: (params: SupplierQueryParams) =>
    [...supplierQueryKeys.lists(), params] as const,
  details: () => [...supplierQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierQueryKeys.details(), id] as const,
};

// 只有基础 API 函数，没有 Mutation Hooks
export async function getSuppliers(params: SupplierQueryParams = {}) { ... }
export async function getSupplier(id: string) { ... }
export async function createSupplier(data: SupplierCreateInput) { ... }
export async function updateSupplier(id: string, data: SupplierUpdateInput) { ... }
export async function deleteSupplier(id: string) { ... }
export async function batchDeleteSuppliers(data: BatchDeleteSuppliersInput) { ... }
export async function batchUpdateSupplierStatus(data: BatchUpdateSupplierStatusInput) { ... }
```

#### 使用方式

- **查询**: 使用 `useQuery` + `getSuppliers`（通过 `hooks/use-suppliers.ts`）
- **修改**: 直接在页面组件中调用 API 函数
- **缓存刷新**: 手动刷新

#### 问题分析

**P0 问题**: 无（不使用 TanStack Query Mutation）

**P1 问题**: 无

**P2 问题（架构建议）**:

- 建议迁移到 TanStack Query Mutation Hooks 模式
- 建议添加统一的缓存管理策略

---

## 📊 检查总结

### 架构对比

| 模块         | Query Keys | useQuery | useMutation | 缓存管理 | P0 问题         |
| ------------ | ---------- | -------- | ----------- | -------- | --------------- |
| 销售订单     | ✅         | ✅       | ❌          | ❌       | 0               |
| 采购订单     | ✅         | ✅       | ❌          | ❌       | 0               |
| 库存调整     | ✅         | ✅       | ❌          | ❌       | 0               |
| 客户管理     | ✅         | ✅       | ❌          | ❌       | 0               |
| 供应商管理   | ✅         | ✅       | ❌          | ❌       | 0               |
| **退货订单** | ✅         | ✅       | ✅          | ✅       | **5（已修复）** |
| **厂家发货** | ✅         | ✅       | ✅          | ✅       | **2（已修复）** |
| **仓库进货** | ✅         | ✅       | ✅          | ✅       | **2（已修复）** |

### 关键发现

1. **架构差异**:
   - ✅ **使用 TanStack Query Mutation**: 退货订单、厂家发货、仓库进货
   - ❌ **不使用 TanStack Query Mutation**: 销售订单、采购订单、库存调整、客户管理、供应商管理

2. **缓存管理状态**:
   - ✅ **有缓存管理**: 退货订单、厂家发货、仓库进货（已修复 P0 问题）
   - ❌ **无缓存管理**: 销售订单、采购订单、库存调整、客户管理、供应商管理（不适用）

3. **P0 问题统计**:
   - **总计**: 0 个 P0 问题
   - **原因**: 这些模块不使用 TanStack Query Mutation，因此不存在缓存管理问题

---

## 🎯 结论

### 主要结论

**所有检查的核心业务模块（销售订单、采购订单、库存调整、客户管理、供应商管理）都不存在缓存管理问题，因为它们不使用 TanStack Query Mutation Hooks 进行状态管理。**

### 架构说明

项目中存在两种架构模式：

#### 模式 1: TanStack Query Mutation（推荐）

**使用模块**: 退货订单、厂家发货、仓库进货

**特点**:

- ✅ 使用 `useMutation` 进行数据修改
- ✅ 使用 `refetchQueries` 立即刷新当前模块缓存
- ✅ 使用 `invalidateQueries` 延迟刷新跨模块缓存
- ✅ 自动管理缓存一致性
- ✅ 更好的用户体验（无需手动刷新）

**示例**:

```typescript
export function useCreateReturnOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createReturnOrder,
    onSuccess: () => {
      // 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.lists(),
        type: 'active',
      });

      // 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
    },
  });
}
```

#### 模式 2: 直接调用 API（传统）

**使用模块**: 销售订单、采购订单、库存调整、客户管理、供应商管理

**特点**:

- ❌ 直接在页面组件中调用 API 函数
- ❌ 手动刷新页面（`router.refresh()` 或 `window.location.reload()`）
- ❌ 无自动缓存管理
- ❌ 用户体验较差（需要等待页面刷新）

**示例**:

```typescript
// 页面组件中
const handleCreate = async (data: CustomerCreateInput) => {
  try {
    await createCustomer(data);
    router.refresh(); // 手动刷新
    toast({ title: '创建成功' });
  } catch (error) {
    toast({ title: '创建失败', variant: 'destructive' });
  }
};
```

---

## 💡 建议

### 短期建议（不需要立即修复）

**当前状态**: 所有核心业务模块都不存在 P0 缓存管理问题

**原因**: 这些模块不使用 TanStack Query Mutation，因此不会出现缓存不一致的问题

**建议**: 保持现状，无需立即修复

### 长期建议（架构优化）

**目标**: 统一项目架构，提升用户体验

**建议**: 将所有模块迁移到 TanStack Query Mutation 模式

**优先级**:

1. **P1（高优先级）**: 销售订单模块（核心业务，使用频率高）
2. **P2（中优先级）**: 采购订单模块（核心业务）
3. **P3（低优先级）**: 客户管理、供应商管理、库存调整模块

**预估工作量**:

- 销售订单模块: 2-3 天
- 采购订单模块: 2-3 天
- 其他模块: 1-2 天/模块

**参考实现**: 退货订单模块（`lib/api/return-orders.ts`）

---

**报告生成时间**: 2025-01-14
**报告作者**: Augment Agent
**检查模块数**: 5 个
**发现 P0 问题**: 0 个
