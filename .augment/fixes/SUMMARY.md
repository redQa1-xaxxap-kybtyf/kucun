# 应收款缓存更新修复 - 总结

## 问题

销售订单创建或状态更新后，应收款页面数据不会自动更新，必须手动刷新浏览器。

## 根本原因

销售订单相关操作（创建、状态更新）只失效了销售订单缓存，没有同时失效应收款缓存。

## 解决方案

### 服务端修复（2个文件）

1. **`app/api/sales-orders/route.ts`** - 订单创建

   ```typescript
   await revalidateSalesOrders();
   await revalidateFinance('receivables'); // ✅ 新增
   ```

2. **`app/api/sales-orders/[id]/route.ts`** - 订单状态更新
   ```typescript
   await publishOrderStatus({...});
   const { revalidateFinance } = await import('@/lib/cache');
   await revalidateFinance('receivables'); // ✅ 新增
   ```

### 客户端修复（6个文件）

所有销售订单创建表单和列表组件的 `useMutation` 回调中添加：

```typescript
queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });
queryClient.invalidateQueries({ queryKey: ['finance', 'receivables'] }); // ✅ 新增
```

**修改的文件**：

- `components/sales-orders/enhanced-sales-order-form/hooks/useSalesOrderSubmission.ts`
- `components/sales-orders/use-enhanced-sales-order-form.ts`
- `components/sales-orders/invoice-oriented-form.tsx`
- `components/sales-orders/sales-order-form.tsx`
- `components/sales-orders/erp-sales-order-form.tsx`
- `components/sales-orders/erp-sales-order-list.tsx`

## 验证

1. ✅ 创建销售订单后，应收款页面自动显示新订单
2. ✅ 更新订单状态后，应收款页面自动更新
3. ✅ 无需手动刷新浏览器

## 详细文档

- [receivables-cache-invalidation-fix.md](./receivables-cache-invalidation-fix.md) - 缓存更新修复
- [rounding-adjustment-calculation-fix.md](./rounding-adjustment-calculation-fix.md) - 抹零金额计算修复
- [payment-rounding-display-fix.md](./payment-rounding-display-fix.md) - 收款记录抹零显示修复
- [sales-order-detail-rounding-display-fix.md](./sales-order-detail-rounding-display-fix.md) - 销售订单详情抹零显示修复
- [invoice-form-rounding-fix.md](./invoice-form-rounding-fix.md) - 发票导向表单抹零金额提交修复
- [order-data-fix-summary.md](./order-data-fix-summary.md) - 订单 SO202510230100 数据修复总结
- [datetime-format-unification.md](./datetime-format-unification.md) - 销售订单详情页面日期时间格式化函数统一修复
- [global-datetime-format-migration.md](./global-datetime-format-migration.md) - 全局日期时间格式化函数迁移完成
