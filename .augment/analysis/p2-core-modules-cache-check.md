# 产品管理、产品分类、客户管理、供应商管理模块缓存管理检查报告

**检查日期**: 2025-01-14
**检查人**: Augment Agent
**检查范围**: 4 个核心业务模块

---

## 一、检查概况

### 检查结果汇总

| 模块       | 文件                    | 架构模式         | Mutation Hooks | 问题数量 | 优先级 |
| ---------- | ----------------------- | ---------------- | -------------- | -------- | ------ |
| 产品管理   | `lib/api/products.ts`   | ❌ 直接 API 调用 | ❌ 无          | 1        | P2     |
| 产品分类   | `lib/api/categories.ts` | ❌ 直接 API 调用 | ❌ 无          | 1        | P2     |
| 客户管理   | `lib/api/customers.ts`  | ❌ 直接 API 调用 | ❌ 无          | 1        | P2     |
| 供应商管理 | `lib/api/suppliers.ts`  | ❌ 直接 API 调用 | ❌ 无          | 1        | P2     |

**总计**:

- ✅ 检查模块: 4 个
- ❌ 发现问题: 4 个（全部为 P2 级别）
- 📊 架构模式: 全部使用直接 API 调用模式
- 🔧 需要迁移: 4 个模块

---

## 二、各模块详细检查结果

### 1. 产品管理模块 (lib/api/products.ts)

#### 基本信息

- **文件**: `lib/api/products.ts`
- **代码行数**: 242 行
- **架构模式**: ❌ 直接 API 调用（无 TanStack Query Mutation Hooks）

#### 当前实现

**API 函数**:

```typescript
// 查询函数
export async function getProducts(params): Promise<PaginatedResponse<Product>>;
export async function getProduct(id: string): Promise<Product>;

// 变更函数（直接 API 调用）
export async function createProduct(productData): Promise<Product>;
export async function updateProduct(id, productData): Promise<Product>;
export async function deleteProduct(id: string): Promise<void>;
```

**Query Keys**:

```typescript
export const productQueryKeys = queryKeys.products; // 使用集中管理的 queryKeys
```

#### 问题分析

**问题**: ❌ 未使用 TanStack Query Mutation Hooks

**影响**:

- 页面组件需要手动调用 `useMutation` 并手动管理缓存刷新
- 缓存刷新逻辑分散在各个页面组件中
- 容易遗漏跨模块缓存刷新
- 代码重复，不符合 DRY 原则

**跨模块依赖关系**:

- **产品管理** → 影响：销售订单、采购订单、库存、产品分类、仪表盘

**缺失的缓存刷新**（如果迁移到 Mutation Hooks）:

- 创建产品 → 需要刷新：产品列表、产品分类统计、仪表盘
- 更新产品 → 需要刷新：产品详情、产品列表、销售订单、采购订单、库存
- 删除产品 → 需要刷新：产品列表、产品分类统计、仪表盘

#### 优先级评估

**优先级**: P2（一般）

**理由**:

- 不影响功能正常运行（页面组件可以手动管理缓存）
- 但架构不统一，与已迁移的模块（销售订单、退货订单等）不一致
- 建议迁移以提升代码质量和可维护性

---

### 2. 产品分类模块 (lib/api/categories.ts)

#### 基本信息

- **文件**: `lib/api/categories.ts`
- **代码行数**: 258 行
- **架构模式**: ❌ 直接 API 调用（无 TanStack Query Mutation Hooks）

#### 当前实现

**API 函数**:

```typescript
// 查询函数
export async function getCategories(
  params
): Promise<PaginatedResponse<Category>>;
export async function getCategory(id: string): Promise<ApiResponse<Category>>;
export async function getCategoryOptions(): Promise<Category[]>;

// 变更函数（直接 API 调用）
export async function createCategory(data): Promise<ApiResponse<Category>>;
export async function updateCategory(data): Promise<ApiResponse<Category>>;
export async function deleteCategory(id: string): Promise<ApiResponse<void>>;
export async function updateCategoryStatus(
  id,
  status
): Promise<ApiResponse<Category>>;
```

**Query Keys**:

```typescript
export const categoryQueryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryQueryKeys.all, 'list'] as const,
  list: params => [...categoryQueryKeys.lists(), params] as const,
  details: () => [...categoryQueryKeys.all, 'detail'] as const,
  detail: id => [...categoryQueryKeys.details(), id] as const,
  options: () => [...categoryQueryKeys.all, 'options'] as const,
};
```

#### 问题分析

**问题**: ❌ 未使用 TanStack Query Mutation Hooks

**影响**:

- 页面组件需要手动调用 `useMutation` 并手动管理缓存刷新
- 缓存刷新逻辑分散在各个页面组件中
- 容易遗漏跨模块缓存刷新
- 代码重复，不符合 DRY 原则

**跨模块依赖关系**:

- **产品分类** → 影响：产品、仪表盘

**缺失的缓存刷新**（如果迁移到 Mutation Hooks）:

- 创建分类 → 需要刷新：分类列表、分类选项、产品列表、仪表盘
- 更新分类 → 需要刷新：分类详情、分类列表、分类选项、产品列表
- 删除分类 → 需要刷新：分类列表、分类选项、产品列表、仪表盘
- 更新分类状态 → 需要刷新：分类详情、分类列表、分类选项、产品列表

#### 优先级评估

**优先级**: P2（一般）

**理由**:

- 不影响功能正常运行（页面组件可以手动管理缓存）
- 但架构不统一，与已迁移的模块不一致
- 建议迁移以提升代码质量和可维护性

---

### 3. 客户管理模块 (lib/api/customers.ts)

#### 基本信息

- **文件**: `lib/api/customers.ts`
- **代码行数**: 244 行
- **架构模式**: ❌ 直接 API 调用（无 TanStack Query Mutation Hooks）

#### 当前实现

**API 函数**:

```typescript
// 查询函数
export async function getCustomers(
  params
): Promise<PaginatedResponse<Customer>>;
export async function getCustomer(id: string): Promise<Customer>;
export async function searchCustomersLightweight(
  query,
  options
): Promise<Customer[]>;
export async function searchCustomers(query, options): Promise<Customer[]>;

// 变更函数（直接 API 调用）
export async function createCustomer(customerData): Promise<Customer>;
export async function updateCustomer(id, customerData): Promise<Customer>;
export async function deleteCustomer(id: string): Promise<void>;
```

**Query Keys**:

```typescript
export const customerQueryKeys = {
  all: ['customers'] as const,
  lists: () => [...customerQueryKeys.all, 'list'] as const,
  list: params => [...customerQueryKeys.lists(), params] as const,
  details: () => [...customerQueryKeys.all, 'detail'] as const,
  detail: id => [...customerQueryKeys.details(), id] as const,
  hierarchy: (id?) => [...customerQueryKeys.all, 'hierarchy', id] as const,
  searches: () => [...customerQueryKeys.all, 'search'] as const,
  search: (query, options?) =>
    [...customerQueryKeys.searches(), query, options] as const,
};
```

#### 问题分析

**问题**: ❌ 未使用 TanStack Query Mutation Hooks

**影响**:

- 页面组件需要手动调用 `useMutation` 并手动管理缓存刷新
- 缓存刷新逻辑分散在各个页面组件中
- 容易遗漏跨模块缓存刷新
- 代码重复，不符合 DRY 原则

**跨模块依赖关系**:

- **客户管理** → 影响：销售订单、退货订单、应收款、仪表盘、财务

**缺失的缓存刷新**（如果迁移到 Mutation Hooks）:

- 创建客户 → 需要刷新：客户列表、客户搜索、仪表盘
- 更新客户 → 需要刷新：客户详情、客户列表、客户搜索、销售订单、退货订单、应收款
- 删除客户 → 需要刷新：客户列表、客户搜索、仪表盘

#### 优先级评估

**优先级**: P2（一般）

**理由**:

- 不影响功能正常运行（页面组件可以手动管理缓存）
- 但架构不统一，与已迁移的模块不一致
- 建议迁移以提升代码质量和可维护性

---

### 4. 供应商管理模块 (lib/api/suppliers.ts)

#### 基本信息

- **文件**: `lib/api/suppliers.ts`
- **代码行数**: 243 行
- **架构模式**: ❌ 直接 API 调用（无 TanStack Query Mutation Hooks）

#### 当前实现

**API 函数**:

```typescript
// 查询函数
export async function getSuppliers(
  params
): Promise<PaginatedResponse<Supplier>>;
export async function getSupplier(id: string): Promise<ApiResponse<Supplier>>;

// 变更函数（直接 API 调用）
export async function createSupplier(data): Promise<ApiResponse<Supplier>>;
export async function updateSupplier(id, data): Promise<ApiResponse<Supplier>>;
export async function deleteSupplier(id: string): Promise<ApiResponse<void>>;
export async function batchDeleteSuppliers(
  data
): Promise<BatchDeleteSuppliersResult>;
export async function batchUpdateSupplierStatus(
  data
): Promise<BatchUpdateSupplierStatusResult>;
```

**Query Keys**:

```typescript
export const supplierQueryKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierQueryKeys.all, 'list'] as const,
  list: params => [...supplierQueryKeys.lists(), params] as const,
  details: () => [...supplierQueryKeys.all, 'detail'] as const,
  detail: id => [...supplierQueryKeys.details(), id] as const,
};
```

#### 问题分析

**问题**: ❌ 未使用 TanStack Query Mutation Hooks

**影响**:

- 页面组件需要手动调用 `useMutation` 并手动管理缓存刷新
- 缓存刷新逻辑分散在各个页面组件中
- 容易遗漏跨模块缓存刷新
- 代码重复，不符合 DRY 原则

**跨模块依赖关系**:

- **供应商管理** → 影响：采购订单、应付款、仪表盘、财务

**缺失的缓存刷新**（如果迁移到 Mutation Hooks）:

- 创建供应商 → 需要刷新：供应商列表、仪表盘
- 更新供应商 → 需要刷新：供应商详情、供应商列表、采购订单、应付款
- 删除供应商 → 需要刷新：供应商列表、仪表盘
- 批量删除供应商 → 需要刷新：供应商列表、仪表盘
- 批量更新供应商状态 → 需要刷新：供应商列表、采购订单

#### 优先级评估

**优先级**: P2（一般）

**理由**:

- 不影响功能正常运行（页面组件可以手动管理缓存）
- 但架构不统一，与已迁移的模块不一致
- 建议迁移以提升代码质量和可维护性

---

## 三、问题汇总

### 按优先级分类

#### P0（紧急）- 0 个

无

#### P1（重要）- 0 个

无

#### P2（一般）- 4 个

1. **产品管理模块** - 未使用 TanStack Query Mutation Hooks
2. **产品分类模块** - 未使用 TanStack Query Mutation Hooks
3. **客户管理模块** - 未使用 TanStack Query Mutation Hooks
4. **供应商管理模块** - 未使用 TanStack Query Mutation Hooks

### 问题特征

**共同特征**:

- ✅ 所有模块都有完整的 Query Keys 定义
- ✅ 所有模块都有完整的 API 函数（CRUD）
- ❌ 所有模块都未使用 TanStack Query Mutation Hooks
- ❌ 所有模块的缓存刷新逻辑都分散在页面组件中

**与已迁移模块的对比**:

- ✅ 已迁移: 销售订单、退货订单、厂家发货、仓库进货
- ❌ 未迁移: 产品管理、产品分类、客户管理、供应商管理、采购订单、库存调整

---

## 四、修复建议

### 1. 是否需要修复？

**建议**: ⚠️ 暂不修复，但建议纳入技术债务清单

**理由**:

1. **功能正常**: 这些模块目前功能正常，页面组件可以手动管理缓存
2. **优先级较低**: 这些是 P2 级别问题，不影响用户体验
3. **工作量较大**: 迁移 4 个模块需要约 8-12 小时
4. **风险可控**: 手动缓存管理虽然不够优雅，但可以正常工作

**但是**:

- 如果未来需要修改这些模块的页面组件，建议同时进行迁移
- 如果发现手动缓存管理导致数据不一致问题，应立即修复

### 2. 如果要修复，修复方案

#### 方案 A: 完整迁移（推荐）

**步骤**:

1. 为每个模块创建 Mutation Hooks（参考 `lib/api/sales-orders.ts`）
2. 更新页面组件使用新的 Mutation Hooks
3. 移除手动缓存刷新逻辑
4. 测试验证

**预估工作量**:

- 产品管理模块: 2-3 小时
- 产品分类模块: 2-3 小时
- 客户管理模块: 2-3 小时
- 供应商管理模块: 2-3 小时
- **总计**: 8-12 小时

**优点**:

- ✅ 架构统一，易于维护
- ✅ 缓存管理集中，不易遗漏
- ✅ 符合 DRY 原则
- ✅ 代码质量提升

**缺点**:

- ❌ 工作量较大
- ❌ 需要修改多个页面组件
- ❌ 需要充分测试

#### 方案 B: 渐进式迁移

**步骤**:

1. 先创建 Mutation Hooks，但不强制使用
2. 新功能或修改现有功能时，逐步使用新的 Hooks
3. 最终完全迁移

**预估工作量**:

- 创建 Hooks: 4-6 小时
- 渐进式迁移: 根据实际需求

**优点**:

- ✅ 风险较低
- ✅ 可以分批进行
- ✅ 不影响现有功能

**缺点**:

- ❌ 迁移周期较长
- ❌ 过渡期架构不统一

#### 方案 C: 暂不修复（当前建议）

**理由**:

- 功能正常，优先级较低
- 可以作为技术债务，未来再处理
- 专注于更高优先级的任务

**建议**:

- 记录到技术债务清单
- 定期评估是否需要修复
- 如果发现问题，立即修复

---

## 五、参考标准

### 最佳实践参考

**参考模块**: `lib/api/return-orders.ts`（退货订单模块）

**Mutation Hook 示例**:

```typescript
export function useCreateReturnOrder(
  options?: UseMutationOptions<
    ApiResponse<ReturnOrder>,
    Error,
    CreateReturnOrderInput
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createReturnOrder,
    onSuccess: () => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.statistics(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all,
      });
    },
    ...options,
  });
}
```

### 缓存刷新策略

**立即刷新（refetchQueries）**:

- 当前模块的列表、详情、统计数据
- 用户需要立即看到的数据

**延迟刷新（invalidateQueries）**:

- 跨模块的相关数据
- 不需要立即显示的数据

**移除缓存（removeQueries）**:

- 删除操作后，移除详情缓存

---

## 六、总结

### 检查结论

1. **所有 4 个模块都未使用 TanStack Query Mutation Hooks**
2. **所有问题都是 P2 级别，不影响功能正常运行**
3. **建议暂不修复，但纳入技术债务清单**
4. **如果未来修改这些模块，建议同时进行迁移**

### 下一步行动

#### 立即行动

- ✅ 将这 4 个模块的迁移需求记录到技术债务清单
- ✅ 生成本检查报告并保存到 `.augment/analysis/` 目录

#### 未来行动（可选）

- ⏳ 评估是否需要迁移这些模块
- ⏳ 如果需要，按照方案 A 或方案 B 进行迁移
- ⏳ 定期检查是否有新的缓存管理问题

### 技术债务清单

| 模块       | 问题                  | 优先级 | 预估工作量 | 建议修复时机         |
| ---------- | --------------------- | ------ | ---------- | -------------------- |
| 产品管理   | 未使用 Mutation Hooks | P2     | 2-3 小时   | 修改产品管理功能时   |
| 产品分类   | 未使用 Mutation Hooks | P2     | 2-3 小时   | 修改产品分类功能时   |
| 客户管理   | 未使用 Mutation Hooks | P2     | 2-3 小时   | 修改客户管理功能时   |
| 供应商管理 | 未使用 Mutation Hooks | P2     | 2-3 小时   | 修改供应商管理功能时 |

---

**报告生成时间**: 2025-01-14
**报告作者**: Augment Agent
**检查模块**: 产品管理、产品分类、客户管理、供应商管理
**发现问题**: 4 个（全部为 P2 级别）
**修复建议**: 暂不修复，纳入技术债务清单
**参考文档**:

- `.augment/analysis/p0-warehouse-inbound-fix.md` - 仓库进货模块修复报告
- `.augment/analysis/p1-factory-shipments-fix.md` - 厂家发货模块修复报告
- `.augment/analysis/p0-return-orders-fix.md` - 退货订单模块修复报告
- `.augment/analysis/p1-sales-orders-mutation-migration.md` - 销售订单模块迁移报告
