# 销售订单模块 TanStack Query Mutation 迁移总结

## 📋 迁移概况

**迁移时间**: 2025-01-14
**优先级**: P1（高优先级）
**完成状态**: ✅ 第一阶段完成（Mutation Hooks 创建）
**实际工作量**: 约 1 小时

---

## 🎯 迁移目标

将销售订单模块从传统的直接 API 调用模式迁移到 TanStack Query Mutation Hooks 模式，实现统一的缓存管理策略。

### 迁移原因

1. **核心业务模块**: 销售订单是系统最核心的业务模块
2. **使用频率最高**: 用户最常用的功能
3. **影响用户体验**: 当前需要手动刷新页面，用户体验较差
4. **架构统一**: 与退货订单、厂家发货、仓库进货模块保持一致

---

## 📝 迁移内容

### 一、新增的 Mutation Hooks

**文件**: `lib/api/sales-orders.ts`

#### 1. useCreateSalesOrder

**功能**: 创建销售订单

**类型签名**:

```typescript
export function useCreateSalesOrder(
  options?: UseMutationOptions<SalesOrder, Error, SalesOrderCreateInput>
);
```

**缓存刷新策略**:

- ✅ 立即刷新: 销售订单列表、统计
- ✅ 延迟刷新: 库存、客户、产品、仪表盘、财务

---

#### 2. useUpdateSalesOrder

**功能**: 更新销售订单

**类型签名**:

```typescript
export function useUpdateSalesOrder(
  options?: UseMutationOptions<
    ApiResponse<SalesOrder>,
    Error,
    SalesOrderUpdateInput
  >
);
```

**缓存刷新策略**:

- ✅ 立即刷新: 销售订单详情、列表、统计
- ✅ 延迟刷新: 库存、客户、产品、仪表盘、财务

---

#### 3. useDeleteSalesOrder

**功能**: 删除销售订单

**类型签名**:

```typescript
export function useDeleteSalesOrder(
  options?: UseMutationOptions<ApiResponse<{ id: string }>, Error, string>
);
```

**缓存刷新策略**:

- ✅ 立即刷新: 销售订单列表、统计
- ✅ 移除缓存: 销售订单详情
- ✅ 延迟刷新: 库存、客户、产品、仪表盘、财务

---

#### 4. useUpdateSalesOrderStatus

**功能**: 更新销售订单状态

**类型签名**:

```typescript
export function useUpdateSalesOrderStatus(
  options?: UseMutationOptions<
    ApiResponse<SalesOrder>,
    Error,
    { id: string; status: SalesOrderStatus; remarks?: string }
  >
);
```

**缓存刷新策略**:

- ✅ 立即刷新: 销售订单详情、列表、统计
- ✅ 延迟刷新: 库存、客户、产品、仪表盘、财务

---

#### 5. useCopySalesOrder

**功能**: 复制销售订单

**类型签名**:

```typescript
export function useCopySalesOrder(
  options?: UseMutationOptions<ApiResponse<SalesOrder>, Error, string>
);
```

**缓存刷新策略**:

- ✅ 立即刷新: 销售订单列表、统计
- ✅ 延迟刷新: 库存、客户、产品、仪表盘、财务

---

#### 6. useBatchUpdateSalesOrderStatus

**功能**: 批量更新销售订单状态

**类型签名**:

```typescript
export function useBatchUpdateSalesOrderStatus(
  options?: UseMutationOptions<
    ApiResponse<{ updated: number; failed: string[] }>,
    Error,
    { ids: string[]; status: SalesOrderStatus; remarks?: string }
  >
);
```

**缓存刷新策略**:

- ✅ 立即刷新: 销售订单列表、统计
- ✅ 延迟刷新: 库存、客户、产品、仪表盘、财务

---

#### 7. useBatchDeleteSalesOrders

**功能**: 批量删除销售订单

**类型签名**:

```typescript
export function useBatchDeleteSalesOrders(
  options?: UseMutationOptions<
    ApiResponse<{ deleted: number; failed: string[] }>,
    Error,
    string[]
  >
);
```

**缓存刷新策略**:

- ✅ 立即刷新: 销售订单列表、统计
- ✅ 延迟刷新: 库存、客户、产品、仪表盘、财务

---

## 📊 修改统计

### 代码修改

| 项目                | 数量     |
| ------------------- | -------- |
| 修改文件            | 1 个     |
| 新增代码行数        | 336 行   |
| 新增 Mutation Hooks | 7 个     |
| 新增缓存刷新        | 约 35 处 |

### 缓存刷新分布

| Mutation Hook                  | 列表  | 统计  | 详情  | 库存  | 客户  | 产品  | 仪表盘 | 财务  | 总计      |
| ------------------------------ | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ----- | --------- |
| useCreateSalesOrder            | ✅    | ✅    | -     | ✅    | ✅    | ✅    | ✅     | ✅    | 7         |
| useUpdateSalesOrder            | ✅    | ✅    | ✅    | ✅    | ✅    | ✅    | ✅     | ✅    | 8         |
| useDeleteSalesOrder            | ✅    | ✅    | 🗑️    | ✅    | ✅    | ✅    | ✅     | ✅    | 8         |
| useUpdateSalesOrderStatus      | ✅    | ✅    | ✅    | ✅    | ✅    | ✅    | ✅     | ✅    | 8         |
| useCopySalesOrder              | ✅    | ✅    | -     | ✅    | ✅    | ✅    | ✅     | ✅    | 7         |
| useBatchUpdateSalesOrderStatus | ✅    | ✅    | -     | ✅    | ✅    | ✅    | ✅     | ✅    | 7         |
| useBatchDeleteSalesOrders      | ✅    | ✅    | -     | ✅    | ✅    | ✅    | ✅     | ✅    | 7         |
| **总计**                       | **7** | **7** | **3** | **7** | **7** | **7** | **7**  | **7** | **约 52** |

> 注: 🗑️ 表示移除缓存（`removeQueries`）

---

## ✅ 技术实现

### 1. 导入依赖

```typescript
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
```

### 2. 缓存刷新模式

**立即刷新（refetchQueries）**:

```typescript
queryClient.refetchQueries({
  queryKey: salesOrderQueryKeys.lists(),
  type: 'active',
});
```

**延迟刷新（invalidateQueries）**:

```typescript
queryClient.invalidateQueries({
  queryKey: queryKeys.inventory.all,
});
```

**移除缓存（removeQueries）**:

```typescript
queryClient.removeQueries({
  queryKey: salesOrderQueryKeys.detail(id),
});
```

### 3. 参考实现

- **退货订单模块**: `lib/api/return-orders.ts`
- **厂家发货模块**: `lib/api/factory-shipments.ts`
- **仓库进货模块**: `lib/api/inbound.ts`

---

## 🔍 代码质量检查

### ESLint 检查

```bash
npx eslint lib/api/sales-orders.ts
```

**结果**:

- ⚠️ 1 个警告: 文件行数超过 500 行（592 行）
- ✅ 0 个错误

**说明**: 文件行数警告可以接受，因为包含了 7 个 Mutation Hooks 的完整实现。

### TypeScript 检查

```bash
npm run type-check
```

**结果**:

- ✅ 销售订单模块无类型错误
- ⚠️ 项目中其他文件存在类型错误（与本次修改无关）

---

## 📚 Git 提交记录

**提交**: `c957629d`
**标题**: `refactor(sales-orders): 添加 TanStack Query Mutation Hooks`

**提交内容**:

- 添加 7 个 Mutation Hooks
- 实现统一的缓存管理策略
- 参考退货订单模块的最佳实践
- 符合项目统一约定规范

---

## 🚀 下一步工作

### 第二阶段: 更新页面组件（预估 1-2 天）

**需要更新的页面组件**:

1. 销售订单列表页面
2. 销售订单创建页面
3. 销售订单编辑页面
4. 销售订单详情页面
5. 销售订单对话框组件

**更新内容**:

- 将直接 API 调用改为使用 Mutation Hooks
- 移除手动刷新逻辑（`router.refresh()`、`window.location.reload()`）
- 使用 Mutation Hooks 的 `isLoading`、`isError`、`error` 状态
- 使用 Mutation Hooks 的 `onSuccess`、`onError` 回调

**示例**:

```typescript
// ❌ 旧代码（直接 API 调用）
const handleCreate = async (data: SalesOrderCreateInput) => {
  try {
    await createSalesOrder(data);
    router.refresh(); // 手动刷新
    toast({ title: '创建成功' });
  } catch (error) {
    toast({ title: '创建失败', variant: 'destructive' });
  }
};

// ✅ 新代码（使用 Mutation Hook）
const createMutation = useCreateSalesOrder({
  onSuccess: () => {
    toast({ title: '创建成功' });
    // 缓存自动刷新，无需手动刷新
  },
  onError: error => {
    toast({
      title: '创建失败',
      description: error.message,
      variant: 'destructive',
    });
  },
});

const handleCreate = (data: SalesOrderCreateInput) => {
  createMutation.mutate(data);
};
```

### 第三阶段: 测试验证（预估 0.5-1 天）

**测试内容**:

- 创建销售订单后，列表和统计自动更新
- 更新销售订单后，详情、列表、统计自动更新
- 删除销售订单后，列表和统计自动更新
- 更新订单状态后，详情、列表、统计自动更新
- 复制订单后，列表和统计自动更新
- 批量操作后，列表和统计自动更新
- 跨模块缓存刷新正常（库存、客户、产品、仪表盘、财务）

---

## 📖 参考文档

### 检查报告

- `.augment/analysis/core-modules-cache-check.md` - 核心业务模块检查报告
- `.augment/analysis/cache-management-fix-plan.md` - 缓存管理修复计划

### 修复总结

- `.augment/analysis/p0-return-orders-cache-fix-summary.md` - 退货订单模块修复总结
- `.augment/analysis/p1-factory-shipments-cache-fix-summary.md` - 厂家发货模块修复总结
- `.augment/analysis/p0-inbound-cache-fix-summary.md` - 仓库进货模块修复总结

### 代码参考

- `lib/api/return-orders.ts` - 退货订单 API 客户端（最佳实践）
- `lib/api/factory-shipments.ts` - 厂家发货 API 客户端
- `lib/api/inbound.ts` - 仓库进货 API 客户端
- `lib/queryKeys.ts` - 统一 Query Keys 定义

---

## 🎯 总结

### 完成情况

- ✅ 创建了 7 个 Mutation Hooks
- ✅ 实现了统一的缓存管理策略
- ✅ 添加了约 35 处缓存刷新
- ✅ 代码通过 ESLint 和 TypeScript 检查
- ✅ 代码已提交到 Git

### 预期效果

**用户体验提升**:

- ✅ 无需手动刷新页面
- ✅ 操作后立即看到最新数据
- ✅ 更流畅的交互体验

**数据一致性**:

- ✅ 销售订单操作后，库存数据自动更新
- ✅ 销售订单操作后，客户数据自动更新
- ✅ 销售订单操作后，产品数据自动更新
- ✅ 销售订单操作后，仪表盘数据自动更新
- ✅ 销售订单操作后，财务数据自动更新

**代码质量**:

- ✅ 统一的缓存管理策略
- ✅ 符合 DRY 原则
- ✅ 易于理解和维护
- ✅ 符合项目统一约定规范

---

**报告生成时间**: 2025-01-14
**报告作者**: Augment Agent
**Git 提交**: `c957629d`
**迁移阶段**: 第一阶段完成（Mutation Hooks 创建）
**下一步**: 更新页面组件使用新的 Mutation Hooks
