# 缓存问题全面分析报告

> 生成时间: 2025-01-13
> 分析范围: TanStack Query 缓存、Next.js 缓存、数据一致性

---

## 📊 执行摘要

### 发现的问题总数: **8个**

- 🔴 **严重问题**: 3个（影响核心功能）
- 🟡 **中等问题**: 3个（影响用户体验）
- 🟢 **轻微问题**: 2个（优化建议）

### 核心问题

1. **采购订单 Query Keys 未集中管理**（严重）
2. **销售订单创建后未刷新采购订单缓存**（严重）
3. **采购订单表单未使用 TanStack Query**（严重）
4. **部分组件使用硬编码 Query Key**（中等）
5. **缺少统一的缓存刷新策略**（中等）

---

## 🔍 详细问题分析

### 问题 1: 采购订单 Query Keys 未集中管理 🔴

**优先级**: P0（严重）

**问题描述**:

- `lib/queryKeys.ts` 中**缺少采购订单的 Query Keys 定义**
- 采购订单使用独立的 `purchaseOrderQueryKeys`（定义在 `lib/api/purchase-orders.ts`）
- 与项目规范不一致，导致缓存管理混乱

**影响范围**:

- 采购订单列表页面
- 采购订单详情页面
- 所有需要刷新采购订单缓存的地方

**当前实现**:

```typescript
// ❌ 错误: 定义在 lib/api/purchase-orders.ts
export const purchaseOrderQueryKeys = {
  all: ['purchase-orders'] as const,
  lists: () => [...purchaseOrderQueryKeys.all, 'list'] as const,
  list: (params: PurchaseOrderListParams) =>
    [...purchaseOrderQueryKeys.lists(), params] as const,
  details: () => [...purchaseOrderQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseOrderQueryKeys.details(), id] as const,
};
```

**正确实现**:

```typescript
// ✅ 正确: 应该定义在 lib/queryKeys.ts
export const purchaseOrderKeys = {
  all: ['purchase-orders'] as const,

  lists: () => [...purchaseOrderKeys.all, 'list'] as const,
  list: (
    filters?: BaseFilters & {
      status?: string;
      supplierId?: string;
      salesOrderId?: string; // 新增: 支持按销售订单筛选
    }
  ) => [...purchaseOrderKeys.lists(), filters] as const,

  details: () => [...purchaseOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseOrderKeys.details(), id] as const,

  // 订单统计
  stats: () => [...purchaseOrderKeys.all, 'stats'] as const,

  // 关联销售订单的采购订单
  bySalesOrder: (salesOrderId: string) =>
    [...purchaseOrderKeys.all, 'sales-order', salesOrderId] as const,
} as const;

// 添加到 queryKeys 导出
export const queryKeys = {
  // ... 现有的 keys
  purchaseOrders: purchaseOrderKeys, // 新增
} as const;
```

**修复步骤**:

1. 在 `lib/queryKeys.ts` 中添加 `purchaseOrderKeys` 定义
2. 更新 `lib/api/purchase-orders.ts`，从 `lib/queryKeys.ts` 导入
3. 更新所有使用 `purchaseOrderQueryKeys` 的地方

---

### 问题 2: 销售订单创建后未刷新采购订单缓存 🔴

**优先级**: P0（严重）

**问题描述**:

- 客户直发订单创建时会自动创建采购订单
- 但销售订单表单提交后**未刷新采购订单缓存**
- 导致采购订单列表不会立即显示新创建的采购订单

**影响范围**:

- 客户直发订单创建流程
- 采购订单列表页面
- 财务应付款页面

**当前实现**:

```typescript
// components/sales-orders/erp-sales-order-form.tsx
const createMutation = useMutation({
  mutationFn: async (data: SalesOrderFormData) => {
    // ... 创建销售订单
  },
  onSuccess: () => {
    // ✅ 刷新销售订单缓存
    queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });

    // ✅ 刷新应收款缓存
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.receivables(),
    });

    // ✅ 刷新财务概览
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.overview(),
    });

    // ❌ 缺失: 未刷新采购订单缓存
    // ❌ 缺失: 未刷新应付款缓存
  },
});
```

**正确实现**:

```typescript
const createMutation = useMutation({
  mutationFn: async (data: SalesOrderFormData) => {
    // ... 创建销售订单
  },
  onSuccess: (result, variables) => {
    // ✅ 刷新销售订单缓存
    queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });

    // ✅ 刷新应收款缓存
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.receivables(),
    });

    // ✅ 刷新财务概览
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.overview(),
    });

    // ✅ 新增: 刷新采购订单缓存（客户直发订单会自动创建采购订单）
    if (
      variables.orderType === 'TRANSFER' &&
      variables.transferMode === 'SUPPLIER_ONLY'
    ) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.all,
      });

      // ✅ 新增: 刷新应付款缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.payables(),
      });
    }

    // ✅ 刷新仪表盘
    queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard.all,
    });
  },
});
```

**修复步骤**:

1. 在销售订单创建成功后，检查是否为客户直发订单
2. 如果是，刷新采购订单和应付款缓存
3. 同时刷新仪表盘缓存

---

### 问题 3: 采购订单表单未使用 TanStack Query 🔴

**优先级**: P0（严重）

**问题描述**:

- `components/purchase-orders/purchase-order-form.tsx` 使用 Server Actions
- 未使用 `useMutation` 和 `queryClient.invalidateQueries`
- 创建/更新采购订单后**无法自动刷新缓存**

**影响范围**:

- 采购订单创建页面
- 采购订单编辑页面
- 采购订单列表页面（不会自动刷新）

**当前实现**:

```typescript
// ❌ 错误: 使用 Server Actions，无法刷新缓存
import {
  createPurchaseOrder,
  updatePurchaseOrder,
} from '@/app/actions/purchase-orders';

export function PurchaseOrderForm({ ... }) {
  const handleSubmit = async (data: PurchaseOrderFormValues) => {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));

    const result = mode === 'edit'
      ? await updatePurchaseOrder(formData)
      : await createPurchaseOrder(formData);

    if (result.success) {
      toast({ title: '保存成功' });
      onSuccess?.();
      // ❌ 缺失: 未刷新缓存
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

**正确实现**:

```typescript
// ✅ 正确: 使用 useMutation 和 invalidateQueries
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export function PurchaseOrderForm({ ... }) {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: PurchaseOrderFormData) => {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      // ✅ 刷新采购订单缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.all
      });

      // ✅ 刷新应付款缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.payables(),
      });

      // ✅ 刷新仪表盘
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });

      toast({ title: '创建成功' });
      onSuccess?.();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdatePurchaseOrderFormData) => {
      const response = await fetch(`/api/purchase-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      // ✅ 刷新采购订单缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.all
      });

      if (orderId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.purchaseOrders.detail(orderId),
        });
      }

      // ✅ 刷新应付款缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.payables(),
      });

      toast({ title: '更新成功' });
      onSuccess?.();
    },
  });

  const handleSubmit = (data: PurchaseOrderFormValues) => {
    if (mode === 'edit') {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

**修复步骤**:

1. 将采购订单表单改为使用 `useMutation`
2. 在 `onSuccess` 回调中刷新相关缓存
3. 移除 Server Actions 的使用（或保留但通过 API 调用）

---

### 问题 4: 部分组件使用硬编码 Query Key 🟡

**优先级**: P1（中等）

**问题描述**:

- 部分组件直接使用硬编码的 Query Key 字符串
- 未使用 `lib/queryKeys.ts` 中定义的 Query Key Factory
- 导致 Query Key 不一致，缓存失效不准确

**影响范围**:

- `components/common/Header.tsx` - 刷新缓存按钮
- 部分旧代码

**当前实现**:

```typescript
// ❌ 错误: 硬编码 Query Key
queryClient.invalidateQueries({ queryKey: ['inventory'] });
queryClient.invalidateQueries({ queryKey: ['products'] });
queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
queryClient.invalidateQueries({ queryKey: ['factory-shipments'] });
queryClient.invalidateQueries({ queryKey: ['finance'] });
queryClient.invalidateQueries({ queryKey: ['customers'] });
queryClient.invalidateQueries({ queryKey: ['suppliers'] });
queryClient.invalidateQueries({ queryKey: ['categories'] });
```

**正确实现**:

```typescript
// ✅ 正确: 使用 queryKeys
import { queryKeys } from '@/lib/queryKeys';

queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
queryClient.invalidateQueries({ queryKey: queryKeys.factoryShipments.all });
queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
```

**修复步骤**:

1. 搜索所有硬编码的 Query Key
2. 替换为 `queryKeys` 中定义的 Key
3. 确保类型安全

---

### 问题 5: 删除销售订单后未刷新关联采购订单 🟡

**优先级**: P1（中等）

**问题描述**:

- 删除销售订单时，关联的采购订单 `salesOrderId` 字段会被设置为 `null`（数据库级联）
- 但前端缓存未刷新，采购订单列表仍显示旧的关联关系
- 用户需要手动刷新页面才能看到更新

**影响范围**:

- 销售订单删除功能
- 采购订单列表页面
- 采购订单详情页面

**数据库行为**:

```prisma
// prisma/schema.prisma
model PurchaseOrder {
  salesOrderId String? @map("sales_order_id") @db.Char(36)
  salesOrder   SalesOrder? @relation(
    fields: [salesOrderId],
    references: [id],
    onDelete: SetNull,  // ✅ 删除销售订单时自动设置为 null
    onUpdate: Cascade
  )
}
```

**当前实现**:

```typescript
// components/sales-orders/erp-sales-order-list.tsx
const deleteOrderMutation = useMutation({
  mutationFn: async (orderId: string) => {
    const response = await fetch(`/api/sales-orders/${orderId}`, {
      method: 'DELETE',
    });
    // ...
  },
  onSuccess: () => {
    // ✅ 刷新销售订单缓存
    queryClient.invalidateQueries({
      queryKey: salesOrderQueryKeys.all,
    });

    // ❌ 缺失: 未刷新采购订单缓存
    // ❌ 缺失: 未刷新应收款缓存
    // ❌ 缺失: 未刷新应付款缓存
  },
});
```

**正确实现**:

```typescript
const deleteOrderMutation = useMutation({
  mutationFn: async (orderId: string) => {
    const response = await fetch(`/api/sales-orders/${orderId}`, {
      method: 'DELETE',
    });
    // ...
  },
  onSuccess: () => {
    // ✅ 刷新销售订单缓存
    queryClient.invalidateQueries({
      queryKey: salesOrderQueryKeys.all,
    });

    // ✅ 新增: 刷新采购订单缓存（关联的采购订单 salesOrderId 会被设置为 null）
    queryClient.invalidateQueries({
      queryKey: queryKeys.purchaseOrders.all,
    });

    // ✅ 新增: 刷新应收款缓存
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.receivables(),
    });

    // ✅ 新增: 刷新应付款缓存
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.payables(),
    });

    // ✅ 刷新仪表盘
    queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard.all,
    });

    toast({ title: '删除成功' });
  },
});
```

**修复步骤**:

1. 在销售订单删除成功后，刷新采购订单缓存
2. 同时刷新应收款和应付款缓存
3. 刷新仪表盘缓存

---

### 问题 6: 缺少统一的缓存刷新策略 🟡

**优先级**: P1（中等）

**问题描述**:

- 不同组件使用不同的缓存刷新策略
- 缺少统一的缓存刷新工具函数
- 导致缓存刷新不一致，容易遗漏

**影响范围**:

- 所有使用 `useMutation` 的组件
- 所有需要刷新缓存的地方

**当前实现**:

```typescript
// ❌ 错误: 每个组件都手动刷新缓存，容易遗漏
// 组件 A
queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
queryClient.invalidateQueries({ queryKey: queryKeys.finance.receivables() });

// 组件 B
queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
// ❌ 忘记刷新 finance.receivables

// 组件 C
queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
queryClient.invalidateQueries({ queryKey: queryKeys.finance.receivables() });
queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
```

**正确实现**:

```typescript
// ✅ 正确: 创建统一的缓存刷新工具函数
// lib/cache/invalidation-helpers.ts

import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 销售订单相关缓存刷新
 */
export function invalidateSalesOrderCaches(
  queryClient: QueryClient,
  options?: {
    includeFinance?: boolean;
    includeDashboard?: boolean;
    includePurchaseOrders?: boolean;
  }
) {
  const {
    includeFinance = true,
    includeDashboard = true,
    includePurchaseOrders = false,
  } = options || {};

  // 刷新销售订单缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.salesOrders.all,
  });

  // 刷新财务缓存
  if (includeFinance) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.receivables(),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.overview(),
    });
  }

  // 刷新采购订单缓存（客户直发订单）
  if (includePurchaseOrders) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.purchaseOrders.all,
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.payables(),
    });
  }

  // 刷新仪表盘缓存
  if (includeDashboard) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard.all,
    });
  }
}

/**
 * 采购订单相关缓存刷新
 */
export function invalidatePurchaseOrderCaches(
  queryClient: QueryClient,
  options?: {
    includeFinance?: boolean;
    includeDashboard?: boolean;
  }
) {
  const { includeFinance = true, includeDashboard = true } = options || {};

  // 刷新采购订单缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.purchaseOrders.all,
  });

  // 刷新财务缓存
  if (includeFinance) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.payables(),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.overview(),
    });
  }

  // 刷新仪表盘缓存
  if (includeDashboard) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard.all,
    });
  }
}

/**
 * 库存相关缓存刷新
 */
export function invalidateInventoryCaches(
  queryClient: QueryClient,
  options?: {
    productId?: string;
    includeDashboard?: boolean;
  }
) {
  const { productId, includeDashboard = true } = options || {};

  // 刷新库存缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.inventory.all,
  });

  // 刷新产品缓存（如果指定了产品ID）
  if (productId) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.products.detail(productId),
    });
  }

  // 刷新仪表盘缓存
  if (includeDashboard) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.dashboard.all,
    });
  }
}
```

**使用示例**:

```typescript
// 销售订单创建
const createMutation = useMutation({
  mutationFn: createSalesOrder,
  onSuccess: (result, variables) => {
    invalidateSalesOrderCaches(queryClient, {
      includePurchaseOrders:
        variables.orderType === 'TRANSFER' &&
        variables.transferMode === 'SUPPLIER_ONLY',
    });
  },
});

// 采购订单创建
const createMutation = useMutation({
  mutationFn: createPurchaseOrder,
  onSuccess: () => {
    invalidatePurchaseOrderCaches(queryClient);
  },
});
```

**修复步骤**:

1. 创建 `lib/cache/invalidation-helpers.ts` 文件
2. 定义统一的缓存刷新工具函数
3. 更新所有组件使用这些工具函数

---

### 问题 7: API Route Handlers 缺少缓存配置 🟢

**优先级**: P2（轻微）

**问题描述**:

- 部分 API Route Handlers 未配置 `export const dynamic`
- 可能导致 Next.js 静态生成缓存问题
- 影响数据实时性

**影响范围**:

- 所有 API Route Handlers

**当前实现**:

```typescript
// ❌ 缺失: 未配置 dynamic
// app/api/sales-orders/route.ts
export async function GET(request: Request) {
  // ...
}

export async function POST(request: Request) {
  // ...
}
```

**正确实现**:

```typescript
// ✅ 正确: 配置 dynamic = 'force-dynamic'
// app/api/sales-orders/route.ts

// 强制动态渲染，禁用缓存
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ...
}

export async function POST(request: Request) {
  // ...
}
```

**修复步骤**:

1. 检查所有 API Route Handlers
2. 添加 `export const dynamic = 'force-dynamic'`
3. 确保数据实时性

---

### 问题 8: 缺少 Query 配置优化 🟢

**优先级**: P2（轻微）

**问题描述**:

- 部分 `useQuery` 未配置 `staleTime` 和 `cacheTime`
- 可能导致不必要的重复请求
- 影响性能和用户体验

**影响范围**:

- 所有使用 `useQuery` 的组件

**当前实现**:

```typescript
// ❌ 缺失: 未配置 staleTime 和 cacheTime
const { data } = useQuery({
  queryKey: queryKeys.products.list(filters),
  queryFn: () => fetchProducts(filters),
});
```

**正确实现**:

```typescript
// ✅ 正确: 配置 staleTime 和 cacheTime
const { data } = useQuery({
  queryKey: queryKeys.products.list(filters),
  queryFn: () => fetchProducts(filters),
  staleTime: 5 * 60 * 1000, // 5分钟内不重新请求
  gcTime: 10 * 60 * 1000, // 10分钟后清除缓存（TanStack Query v5）
});
```

**推荐配置**:

```typescript
// lib/query-config.ts
export const QUERY_CONFIG = {
  // 列表数据：5分钟内不重新请求
  list: {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  },

  // 详情数据：3分钟内不重新请求
  detail: {
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  },

  // 统计数据：10分钟内不重新请求
  stats: {
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  },

  // 实时数据：立即过期
  realtime: {
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  },
} as const;
```

**修复步骤**:

1. 创建 `lib/query-config.ts` 配置文件
2. 为不同类型的查询配置合适的 `staleTime` 和 `gcTime`
3. 更新所有 `useQuery` 使用这些配置

---

## 📋 修复优先级和计划

### 第一阶段: 紧急修复（P0）- 预计 4-6 小时

**目标**: 修复影响核心功能的严重问题

#### 任务 1: 添加采购订单 Query Keys 到 `lib/queryKeys.ts`

- **文件**: `lib/queryKeys.ts`
- **工作量**: 30分钟
- **步骤**:
  1. 在 `lib/queryKeys.ts` 中添加 `purchaseOrderKeys` 定义
  2. 添加 `bySalesOrder` 方法支持按销售订单筛选
  3. 导出到 `queryKeys` 对象

#### 任务 2: 更新销售订单表单缓存刷新逻辑

- **文件**: `components/sales-orders/erp-sales-order-form.tsx`
- **工作量**: 1小时
- **步骤**:
  1. 在 `createMutation.onSuccess` 中添加采购订单缓存刷新
  2. 检查是否为客户直发订单
  3. 刷新应付款缓存
  4. 测试验证

#### 任务 3: 重构采购订单表单使用 TanStack Query

- **文件**: `components/purchase-orders/purchase-order-form.tsx`
- **工作量**: 2-3小时
- **步骤**:
  1. 添加 `useMutation` 和 `useQueryClient`
  2. 创建 `createMutation` 和 `updateMutation`
  3. 在 `onSuccess` 中刷新相关缓存
  4. 移除 Server Actions 调用
  5. 测试验证

#### 任务 4: 更新销售订单删除缓存刷新

- **文件**: `components/sales-orders/erp-sales-order-list.tsx`
- **工作量**: 30分钟
- **步骤**:
  1. 在 `deleteOrderMutation.onSuccess` 中添加采购订单缓存刷新
  2. 刷新应收款和应付款缓存
  3. 测试验证

---

### 第二阶段: 重要优化（P1）- 预计 3-4 小时

**目标**: 统一缓存管理策略，提升代码质量

#### 任务 5: 创建统一的缓存刷新工具函数

- **文件**: `lib/cache/invalidation-helpers.ts`（新建）
- **工作量**: 2小时
- **步骤**:
  1. 创建 `invalidateSalesOrderCaches` 函数
  2. 创建 `invalidatePurchaseOrderCaches` 函数
  3. 创建 `invalidateInventoryCaches` 函数
  4. 创建 `invalidateFinanceCaches` 函数
  5. 添加完整的 TypeScript 类型定义
  6. 编写使用文档

#### 任务 6: 替换硬编码 Query Keys

- **文件**: `components/common/Header.tsx` 等
- **工作量**: 1小时
- **步骤**:
  1. 搜索所有硬编码的 Query Key
  2. 替换为 `queryKeys` 中定义的 Key
  3. 确保类型安全
  4. 测试验证

#### 任务 7: 更新所有组件使用统一工具函数

- **文件**: 所有使用 `useMutation` 的组件
- **工作量**: 1-2小时
- **步骤**:
  1. 更新销售订单相关组件
  2. 更新采购订单相关组件
  3. 更新库存相关组件
  4. 更新财务相关组件
  5. 测试验证

---

### 第三阶段: 性能优化（P2）- 预计 2-3 小时

**目标**: 优化查询配置，减少不必要的请求

#### 任务 8: 创建 Query 配置文件

- **文件**: `lib/query-config.ts`（新建）
- **工作量**: 30分钟
- **步骤**:
  1. 定义不同类型查询的 `staleTime` 和 `gcTime`
  2. 导出配置常量
  3. 编写使用文档

#### 任务 9: 更新 useQuery 配置

- **文件**: 所有使用 `useQuery` 的组件
- **工作量**: 1-2小时
- **步骤**:
  1. 为列表查询添加配置
  2. 为详情查询添加配置
  3. 为统计查询添加配置
  4. 测试验证

#### 任务 10: 添加 API Route Handlers 缓存配置

- **文件**: 所有 `app/api/**/route.ts` 文件
- **工作量**: 30分钟
- **步骤**:
  1. 检查所有 API Route Handlers
  2. 添加 `export const dynamic = 'force-dynamic'`
  3. 测试验证

---

## 🎯 预期收益

### 功能改进

1. **客户直发订单创建后，采购订单列表立即刷新** ✅
2. **销售订单删除后，关联采购订单正确更新** ✅
3. **采购订单创建/更新后，列表自动刷新** ✅
4. **财务数据实时同步** ✅

### 性能提升

1. **减少不必要的 API 请求** - 通过配置 `staleTime`
2. **减少缓存失效次数** - 通过统一的缓存刷新策略
3. **提升用户体验** - 数据更新更及时

### 代码质量

1. **统一的 Query Keys 管理** - 所有 Keys 集中在 `lib/queryKeys.ts`
2. **统一的缓存刷新策略** - 使用工具函数，避免遗漏
3. **类型安全** - 完整的 TypeScript 类型定义
4. **可维护性** - 代码结构清晰，易于维护

---

## 📝 最佳实践建议

### 1. Query Keys 管理

**规范**:

- 所有 Query Keys 必须定义在 `lib/queryKeys.ts`
- 使用 Query Key Factory 模式
- 遵循 `['entity', id]` 和 `['list', filters]` 格式

**示例**:

```typescript
// ✅ 正确
import { queryKeys } from '@/lib/queryKeys';

useQuery({
  queryKey: queryKeys.products.list({ page: 1, limit: 20 }),
  queryFn: () => fetchProducts({ page: 1, limit: 20 }),
});

// ❌ 错误
useQuery({
  queryKey: ['products', 'list', { page: 1, limit: 20 }],
  queryFn: () => fetchProducts({ page: 1, limit: 20 }),
});
```

### 2. 缓存刷新策略

**规范**:

- 使用统一的缓存刷新工具函数
- 根据业务逻辑选择刷新范围
- 避免过度刷新（性能问题）
- 避免遗漏刷新（数据不一致）

**示例**:

```typescript
// ✅ 正确
import { invalidateSalesOrderCaches } from '@/lib/cache/invalidation-helpers';

const createMutation = useMutation({
  mutationFn: createSalesOrder,
  onSuccess: (result, variables) => {
    invalidateSalesOrderCaches(queryClient, {
      includePurchaseOrders:
        variables.orderType === 'TRANSFER' &&
        variables.transferMode === 'SUPPLIER_ONLY',
    });
  },
});

// ❌ 错误: 手动刷新，容易遗漏
const createMutation = useMutation({
  mutationFn: createSalesOrder,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
    // 忘记刷新 finance.receivables
    // 忘记刷新 dashboard.all
  },
});
```

### 3. Query 配置

**规范**:

- 为不同类型的查询配置合适的 `staleTime` 和 `gcTime`
- 列表数据: 5分钟
- 详情数据: 3分钟
- 统计数据: 10分钟
- 实时数据: 0秒

**示例**:

```typescript
// ✅ 正确
import { QUERY_CONFIG } from '@/lib/query-config';

useQuery({
  queryKey: queryKeys.products.list(filters),
  queryFn: () => fetchProducts(filters),
  ...QUERY_CONFIG.list, // staleTime: 5分钟
});

// ❌ 错误: 未配置，每次都重新请求
useQuery({
  queryKey: queryKeys.products.list(filters),
  queryFn: () => fetchProducts(filters),
});
```

### 4. API Route Handlers

**规范**:

- 所有 API Route Handlers 必须配置 `export const dynamic = 'force-dynamic'`
- 确保数据实时性
- 避免 Next.js 静态生成缓存问题

**示例**:

```typescript
// ✅ 正确
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ...
}

// ❌ 错误: 未配置，可能被静态生成
export async function GET(request: Request) {
  // ...
}
```

---

## 🔧 测试验证清单

### 功能测试

- [ ] **客户直发订单创建**
  - [ ] 创建客户直发订单
  - [ ] 验证采购订单列表立即显示新订单
  - [ ] 验证应付款列表立即显示新记录
  - [ ] 验证仪表盘数据更新

- [ ] **销售订单删除**
  - [ ] 删除关联采购订单的销售订单
  - [ ] 验证采购订单的 `salesOrderId` 字段为 `null`
  - [ ] 验证采购订单列表正确显示
  - [ ] 验证应收款列表更新

- [ ] **采购订单创建/更新**
  - [ ] 创建采购订单
  - [ ] 验证采购订单列表立即显示新订单
  - [ ] 更新采购订单
  - [ ] 验证采购订单列表和详情页更新

### 性能测试

- [ ] **缓存命中率**
  - [ ] 验证列表查询在 5分钟内不重新请求
  - [ ] 验证详情查询在 3分钟内不重新请求
  - [ ] 验证统计查询在 10分钟内不重新请求

- [ ] **缓存刷新效率**
  - [ ] 验证只刷新必要的缓存
  - [ ] 验证不会过度刷新
  - [ ] 验证刷新后数据正确

### 代码质量测试

- [ ] **TypeScript 检查**
  - [ ] 运行 `npm run type-check`
  - [ ] 确保无类型错误

- [ ] **ESLint 检查**
  - [ ] 运行 `npm run lint`
  - [ ] 确保无新增错误

- [ ] **代码审查**
  - [ ] 检查所有 Query Keys 是否集中管理
  - [ ] 检查所有缓存刷新是否使用工具函数
  - [ ] 检查所有 API Route Handlers 是否配置 `dynamic`

---

## 📚 参考资源

- [TanStack Query v5 文档](https://tanstack.com/query/v5/docs/framework/react/overview)
- [TanStack Query Best Practices](https://tanstack.com/query/v5/docs/framework/react/community/tkdodos-blog)
- [Next.js 15.4 Caching](https://nextjs.org/docs/app/building-your-application/caching)
- [项目 Query Keys 定义](../lib/queryKeys.ts)
- [项目缓存失效策略](../lib/cache/invalidation-strategy.ts)

---

**最后更新**: 2025-01-13
**分析者**: Augment Agent
**版本**: 1.0.0
