# Optimistic Updates 实施指南 - P0 高优先级任务

> 本文档提供详细的代码修改步骤，用于实施 Optimistic Updates 第一阶段（P0 高优先级）的 4 个任务

## 📋 实施进度

- [x] **准备工作**：创建工具函数和文档 ✅
  - ✅ `lib/utils/optimistic-updates.ts` - 通用工具函数
  - ✅ `docs/optimistic-updates-guide.md` - 使用指南
- [ ] **P0-1**: 销售订单创建的 Optimistic Update ⏳
- [ ] **P0-2**: 订单状态更新的 Optimistic Update
- [ ] **P0-3**: 收款记录创建的 Optimistic Update
- [ ] **P0-4**: 产品入库的 Optimistic Update

---

## 🚀 P0-1: 销售订单创建的 Optimistic Update

### 需要修改的文件

1. `components/sales-orders/enhanced-sales-order-form/hooks/useSalesOrderSubmission.ts`
2. `components/sales-orders/use-enhanced-sales-order-form.ts`
3. `components/sales-orders/sales-order-form.tsx`

### 修改步骤

#### 文件 1: `useSalesOrderSubmission.ts`

**位置**: `components/sales-orders/enhanced-sales-order-form/hooks/useSalesOrderSubmission.ts`

**步骤 1**: 添加导入

```typescript
// 在文件顶部添加
import type { SalesOrder } from '@/lib/types/sales-order';
```

**步骤 2**: 修改 `createMutation` 配置

找到第 34 行的 `const createMutation = useMutation({`，替换为：

```typescript
const createMutation = useMutation({
  mutationFn: createSalesOrder,

  // ✅ Optimistic Update: 立即更新 UI
  onMutate: async variables => {
    // 1. 取消正在进行的查询
    await queryClient.cancelQueries({ queryKey: salesOrderQueryKeys.lists() });

    // 2. 保存当前数据（用于回滚）
    const previousOrders = queryClient.getQueryData(
      salesOrderQueryKeys.lists()
    );

    // 3. 乐观更新缓存
    if (previousOrders) {
      const tempOrder: SalesOrder = {
        id: `temp-${Date.now()}`,
        orderNumber: `临时-${Date.now()}`,
        customerId: variables.customerId,
        customer: null,
        userId: '',
        user: null,
        status: variables.status || 'draft',
        totalAmount: variables.totalAmount || 0,
        paidAmount: 0,
        roundingAdjustment: variables.roundingAdjustment || 0,
        usePrepayment: variables.usePrepayment || false,
        prepaymentAmount: variables.prepaymentAmount || 0,
        remarks: variables.remarks || '',
        items: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData(salesOrderQueryKeys.lists(), {
        ...previousOrders,
        data: [tempOrder, ...previousOrders.data],
        pagination: {
          ...previousOrders.pagination,
          total: previousOrders.pagination.total + 1,
        },
      });
    }

    // 4. 返回回滚上下文
    return { previousOrders };
  },

  onSuccess: data => {
    toast({
      title: '创建成功',
      description: `销售订单 "${data.orderNumber}" 创建成功！`,
    });

    // ✅ 失效销售订单缓存
    queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });

    // ✅ 失效应收款缓存
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.receivables(),
    });

    // ✅ 失效财务统计缓存
    queryClient.invalidateQueries({
      queryKey: queryKeys.finance.stats(),
    });

    if (onSuccess) {
      onSuccess(data);
    } else {
      router.push('/sales-orders');
    }
  },

  onError: (error, _variables, context) => {
    // ✅ 失败时回滚
    if (context?.previousOrders) {
      queryClient.setQueryData(
        salesOrderQueryKeys.lists(),
        context.previousOrders
      );
    }

    toast({
      title: '创建失败',
      description: error instanceof Error ? error.message : '创建失败',
      variant: 'destructive',
    });
  },

  onSettled: () => {
    // ✅ 无论成功或失败，都重新获取数据
    queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });
  },
});
```

#### 文件 2: `use-enhanced-sales-order-form.ts`

**位置**: `components/sales-orders/use-enhanced-sales-order-form.ts`

找到第 371 行的 `const createMutation = useMutation({`，应用与文件 1 相同的修改。

#### 文件 3: `sales-order-form.tsx`

**位置**: `components/sales-orders/sales-order-form.tsx`

找到第 123 行的 `const createMutation = useMutation({`，应用与文件 1 相同的修改。

---

## 🔄 P0-2: 订单状态更新的 Optimistic Update

### 需要查找的文件

使用以下命令查找所有更新订单状态的代码：

```bash
grep -r "updateOrderStatus\|updateSalesOrderStatus" --include="*.ts" --include="*.tsx" components lib
```

### 修改模板

对于每个找到的 `useMutation` Hook，添加以下配置：

```typescript
const updateStatusMutation = useMutation({
  mutationFn: updateOrderStatus,

  // ✅ Optimistic Update
  onMutate: async variables => {
    await queryClient.cancelQueries({ queryKey: salesOrderQueryKeys.lists() });

    const previousOrders = queryClient.getQueryData(
      salesOrderQueryKeys.lists()
    );

    if (previousOrders) {
      queryClient.setQueryData(salesOrderQueryKeys.lists(), {
        ...previousOrders,
        data: previousOrders.data.map(order =>
          order.id === variables.orderId
            ? {
                ...order,
                status: variables.status,
                updatedAt: new Date().toISOString(),
              }
            : order
        ),
      });
    }

    return { previousOrders };
  },

  onError: (_err, _variables, context) => {
    if (context?.previousOrders) {
      queryClient.setQueryData(
        salesOrderQueryKeys.lists(),
        context.previousOrders
      );
    }
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
  },
});
```

---

## 💰 P0-3: 收款记录创建的 Optimistic Update

### 需要修改的文件

1. `lib/api/payments.ts` - `useCreatePaymentRecord` Hook
2. `app/(dashboard)/finance/payments/create/page.tsx`
3. `components/finance/payment-creation-dialog.tsx`

### 修改步骤

#### 文件 1: `lib/api/payments.ts`

找到第 420 行的 `export const useCreatePaymentRecord = () => {`，修改为：

```typescript
export const useCreatePaymentRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentsApi.createPaymentRecord,

    // ✅ Optimistic Update
    onMutate: async variables => {
      await queryClient.cancelQueries({ queryKey: paymentQueryKeys.lists() });

      const previousPayments = queryClient.getQueryData(
        paymentQueryKeys.lists()
      );

      if (previousPayments) {
        const tempPayment = {
          id: `temp-${Date.now()}`,
          paymentNumber: `临时-${Date.now()}`,
          ...variables,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        queryClient.setQueryData(paymentQueryKeys.lists(), {
          ...previousPayments,
          data: [tempPayment, ...previousPayments.data],
          pagination: {
            ...previousPayments.pagination,
            total: previousPayments.pagination.total + 1,
          },
        });
      }

      return { previousPayments };
    },

    onSuccess: () => {
      // ✅ 失效收款记录列表
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.lists() });

      // ✅ 失效应收账款
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.accountsReceivable(),
      });

      // ✅ 失效收款统计
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.statistics(),
      });

      // ✅ 失效应收款缓存（新的 Query Key）
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.receivables(),
      });

      // ✅ 失效销售订单缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.all,
      });

      // ✅ 失效财务统计缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.stats(),
      });
    },

    onError: (_err, _variables, context) => {
      if (context?.previousPayments) {
        queryClient.setQueryData(
          paymentQueryKeys.lists(),
          context.previousPayments
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.lists() });
    },
  });
};
```

---

## 📦 P0-4: 产品入库的 Optimistic Update

### 需要查找的文件

使用以下命令查找入库相关的 mutation：

```bash
grep -r "createInbound\|useCreateInbound" --include="*.ts" --include="*.tsx" lib hooks components
```

### 修改模板

```typescript
const createInboundMutation = useMutation({
  mutationFn: createInbound,

  // ✅ Optimistic Update
  onMutate: async variables => {
    await queryClient.cancelQueries({ queryKey: inboundQueryKeys.lists() });

    const previousInbounds = queryClient.getQueryData(inboundQueryKeys.lists());

    if (previousInbounds) {
      const tempInbound = {
        id: `temp-${Date.now()}`,
        ...variables,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData(inboundQueryKeys.lists(), {
        ...previousInbounds,
        data: [tempInbound, ...previousInbounds.data],
        pagination: {
          ...previousInbounds.pagination,
          total: previousInbounds.pagination.total + 1,
        },
      });
    }

    return { previousInbounds };
  },

  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: inboundQueryKeys.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
  },

  onError: (_err, _variables, context) => {
    if (context?.previousInbounds) {
      queryClient.setQueryData(
        inboundQueryKeys.lists(),
        context.previousInbounds
      );
    }
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: inboundQueryKeys.lists() });
  },
});
```

---

## ✅ 验证步骤

完成每个任务后，执行以下验证：

### 1. ESLint 检查

```bash
npm run lint
```

### 2. TypeScript 检查

```bash
npm run type-check
```

### 3. 手动测试

#### 成功场景

1. 执行操作（如创建订单）
2. ✅ UI 立即更新（<100ms）
3. ✅ API 调用成功
4. ✅ 数据保持一致

#### 失败场景

1. 模拟 API 失败（断网或修改 API 返回错误）
2. ✅ UI 自动回滚到操作前状态
3. ✅ 显示错误提示

#### 网络延迟场景

1. 使用浏览器开发工具模拟慢速网络（Slow 3G）
2. ✅ UI 立即更新
3. ✅ 后台 API 调用完成后数据一致

---

## 📊 预期效果

完成所有 P0 任务后：

- ⭐ 操作响应时间：**1-2秒 → <100ms**（提升 **90%**）
- ⭐ 用户体验：**显著提升**
- ⭐ 代码质量：**保持优秀**

---

## 🔧 故障排除

### 问题 1: TypeScript 类型错误

**错误**: `Type 'X' is not assignable to type 'Y'`

**解决**: 确保 `tempOrder`/`tempPayment` 等临时对象的类型与实际类型完全匹配。

### 问题 2: 缓存未更新

**错误**: UI 没有立即更新

**解决**: 检查 `queryKey` 是否正确，确保使用的是 `lists()` 而不是 `list(params)`。

### 问题 3: 回滚失败

**错误**: 操作失败后 UI 没有回滚

**解决**: 确保 `onMutate` 返回了 `previousData`，并在 `onError` 中正确使用。

---

**最后更新**: 2025-01-02  
**状态**: 准备就绪，等待实施
