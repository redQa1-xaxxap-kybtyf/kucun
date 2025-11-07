# invalidateQueries 使用审查报告

> 日期: 2025-11-07
> 目的: 审查项目中所有 `invalidateQueries` 的使用，评估是否需要改为 `refetchQueries`

## 评估标准

### 需要改为 `refetchQueries` 的场景

✅ **立即反馈场景**：用户操作后需要立即看到最新数据

- 创建、更新、删除操作
- 状态变更操作（确认、发货、取消等）
- 支付、收款操作
- 库存调整操作

### 可以保留 `invalidateQueries` 的场景

⭕ **非关键场景**：不需要立即反馈

- 后台数据预加载
- 统计数据刷新（可以延迟）
- 非活跃页面的数据刷新
- 刷新按钮触发的手动刷新

## 审查结果

### 🔴 高优先级：需要立即修复（用户操作后需要立即看到结果）

#### 1. 退货订单相关 (lib/api/return-orders.ts)

**问题**: 所有退货订单的 mutation 都使用 `invalidateQueries`，可能导致状态不立即刷新

| 行号    | 函数                         | 场景         | 建议                     |
| ------- | ---------------------------- | ------------ | ------------------------ |
| 411-412 | `useCreateReturnOrder`       | 创建退货订单 | ✅ 改为 `refetchQueries` |
| 433-437 | `useUpdateReturnOrder`       | 更新退货订单 | ✅ 改为 `refetchQueries` |
| 459-463 | `useUpdateReturnOrderStatus` | 更新退货状态 | ✅ 改为 `refetchQueries` |
| 484-488 | `useApproveReturnOrder`      | 审核退货订单 | ✅ 改为 `refetchQueries` |
| 509-510 | `useDeleteReturnOrder`       | 删除退货订单 | ✅ 改为 `refetchQueries` |

**影响**: 用户创建/更新/删除退货订单后，列表可能不会立即刷新

#### 2. 收款记录相关 (lib/api/payments.ts)

**问题**: 所有收款记录的 mutation 都使用 `invalidateQueries`

| 行号    | 函数                | 场景         | 建议                     |
| ------- | ------------------- | ------------ | ------------------------ |
| 407-411 | `useCreatePayment`  | 创建收款记录 | ✅ 改为 `refetchQueries` |
| 425-430 | `useUpdatePayment`  | 更新收款记录 | ✅ 改为 `refetchQueries` |
| 443-447 | `useConfirmPayment` | 确认收款     | ✅ 改为 `refetchQueries` |
| 461-466 | `useCancelPayment`  | 取消收款     | ✅ 改为 `refetchQueries` |
| 480-485 | `useDeletePayment`  | 删除收款记录 | ✅ 改为 `refetchQueries` |

**影响**: 用户创建/确认收款后，应收款列表可能不会立即更新

#### 3. 应付款相关 (lib/api/payables.ts)

**问题**: 所有应付款的 mutation 都使用 `invalidateQueries`

| 行号    | 函数                   | 场景         | 建议                     |
| ------- | ---------------------- | ------------ | ------------------------ |
| 329-330 | `useCreatePayable`     | 创建应付款   | ✅ 改为 `refetchQueries` |
| 343-345 | `useUpdatePayable`     | 更新应付款   | ✅ 改为 `refetchQueries` |
| 357-358 | `useDeletePayable`     | 删除应付款   | ✅ 改为 `refetchQueries` |
| 370-372 | `useCreatePaymentOut`  | 创建付款记录 | ✅ 改为 `refetchQueries` |
| 390-395 | `useConfirmPaymentOut` | 确认付款     | ✅ 改为 `refetchQueries` |
| 407-409 | `useDeletePaymentOut`  | 删除付款记录 | ✅ 改为 `refetchQueries` |

**影响**: 用户创建/确认付款后，应付款列表可能不会立即更新

#### 4. 厂家发货相关 (lib/api/factory-shipments.ts)

**问题**: 所有厂家发货的 mutation 都使用 `invalidateQueries`

| 行号    | 函数                        | 场景         | 建议                     |
| ------- | --------------------------- | ------------ | ------------------------ |
| 251     | `useCreateFactoryShipment`  | 创建发货单   | ✅ 改为 `refetchQueries` |
| 274-277 | `useUpdateFactoryShipment`  | 更新发货单   | ✅ 改为 `refetchQueries` |
| 300-303 | `useConfirmFactoryShipment` | 确认发货     | ✅ 改为 `refetchQueries` |
| 320     | `useReceiveFactoryShipment` | 确认收货     | ✅ 改为 `refetchQueries` |
| 343-346 | `useCancelFactoryShipment`  | 取消发货     | ✅ 改为 `refetchQueries` |
| 396-399 | `useDeleteFactoryShipment`  | 删除发货单   | ✅ 改为 `refetchQueries` |
| 416-419 | `useUpdateShippingInfo`     | 更新物流信息 | ✅ 改为 `refetchQueries` |

**影响**: 用户操作发货单后，列表可能不会立即刷新

#### 5. 库存盘点相关 (components/inventory/counts/)

**问题**: 库存盘点的 mutation 使用 `invalidateQueries`

| 文件                         | 行号           | 场景                | 建议                     |
| ---------------------------- | -------------- | ------------------- | ------------------------ |
| count-form.tsx               | 128, 166-170   | 创建/更新盘点单     | ✅ 改为 `refetchQueries` |
| count-list.tsx               | 103, 136       | 删除/批量删除盘点单 | ✅ 改为 `refetchQueries` |
| [id]/execute/page-client.tsx | 84-89, 123-126 | 提交/完成盘点       | ✅ 改为 `refetchQueries` |
| [id]/page-client.tsx         | 116-119, 165   | 更新盘点状态        | ✅ 改为 `refetchQueries` |

**影响**: 用户提交盘点数据后，盘点列表可能不会立即刷新

#### 6. 客户管理相关

**问题**: 客户创建/更新/删除使用 `invalidateQueries`

| 文件                          | 行号         | 场景          | 建议                     |
| ----------------------------- | ------------ | ------------- | ------------------------ |
| customer-form.tsx             | 97, 118-119  | 创建/更新客户 | ✅ 改为 `refetchQueries` |
| customer-delete-dialog.tsx    | 49           | 删除客户      | ✅ 改为 `refetchQueries` |
| customer-edit-dialog.tsx      | 117, 121     | 编辑客户      | ✅ 改为 `refetchQueries` |
| erp-customer-form.tsx         | 104, 129-130 | 创建/更新客户 | ✅ 改为 `refetchQueries` |
| quick-add-customer-dialog.tsx | 87           | 快速添加客户  | ✅ 改为 `refetchQueries` |

**影响**: 用户创建/更新客户后，客户列表可能不会立即刷新

#### 7. 供应商管理相关

**问题**: 供应商创建/更新使用 `invalidateQueries`

| 文件                          | 行号 | 场景           | 建议                     |
| ----------------------------- | ---- | -------------- | ------------------------ |
| quick-add-supplier-dialog.tsx | 85   | 快速添加供应商 | ✅ 改为 `refetchQueries` |
| suppliers-page-client.tsx     | 154  | 删除供应商     | ✅ 改为 `refetchQueries` |

**影响**: 用户创建/删除供应商后，供应商列表可能不会立即刷新

#### 8. 产品管理相关

**问题**: 产品创建/更新/删除使用 `invalidateQueries`

| 文件                            | 行号     | 场景          | 建议                     |
| ------------------------------- | -------- | ------------- | ------------------------ |
| use-product-form.ts             | 211, 255 | 创建/更新产品 | ✅ 改为 `refetchQueries` |
| use-product-delete.ts           | 28       | 删除产品      | ✅ 改为 `refetchQueries` |
| quick-create-product-dialog.tsx | 128      | 快速创建产品  | ✅ 改为 `refetchQueries` |
| erp-product-detail.tsx          | 86       | 更新产品      | ✅ 改为 `refetchQueries` |

**影响**: 用户创建/更新/删除产品后，产品列表可能不会立即刷新

#### 9. 分类管理相关

**问题**: 分类创建/更新/删除使用 `invalidateQueries`

| 文件                          | 行号    | 场景          | 建议                     |
| ----------------------------- | ------- | ------------- | ------------------------ |
| use-categories.ts             | 63, 85  | 创建/删除分类 | ✅ 改为 `refetchQueries` |
| categories/create/page.tsx    | 161-162 | 创建分类      | ✅ 改为 `refetchQueries` |
| categories/[id]/edit/page.tsx | 250-251 | 更新分类      | ✅ 改为 `refetchQueries` |

**影响**: 用户创建/更新/删除分类后，分类列表可能不会立即刷新

#### 10. 用户管理相关

**问题**: 用户创建/更新/删除使用 `invalidateQueries`

| 文件                    | 行号               | 场景                    | 建议                     |
| ----------------------- | ------------------ | ----------------------- | ------------------------ |
| settings/users/page.tsx | 127, 159, 190, 227 | 创建/更新/删除/重置密码 | ✅ 改为 `refetchQueries` |

**影响**: 用户管理操作后，用户列表可能不会立即刷新

### 🟡 中优先级：建议修复（影响用户体验但不严重）

#### 11. 财务报表相关

**问题**: 费用记录使用 `invalidateQueries`

| 文件               | 行号          | 场景          | 建议                        |
| ------------------ | ------------- | ------------- | --------------------------- |
| expense-form.tsx   | 143, 146, 151 | 创建/更新费用 | ⭕ 可保留（统计数据可延迟） |
| expense-list.tsx   | 104, 107      | 删除费用      | ✅ 改为 `refetchQueries`    |
| expense-detail.tsx | 70, 73        | 更新费用      | ✅ 改为 `refetchQueries`    |

#### 12. 库存操作相关

**问题**: 库存调整使用 `invalidateQueries`

| 文件                             | 行号     | 场景           | 建议                     |
| -------------------------------- | -------- | -------------- | ------------------------ |
| useInventoryOperationForm.ts     | 416, 419 | 入库/出库/调整 | ✅ 改为 `refetchQueries` |
| use-optimized-inventory-query.ts | 181, 314 | 库存调整       | ✅ 改为 `refetchQueries` |

**影响**: 用户调整库存后，库存列表可能不会立即刷新

### 🟢 低优先级：可以保留（非关键场景）

#### 13. 刷新按钮

**文件**: `components/common/Header.tsx` (行号 93-110)

**场景**: 用户手动点击刷新按钮

**建议**: ⭕ 保留 `invalidateQueries`（手动刷新可以延迟）

#### 14. 仪表盘统计

**文件**: `lib/api/dashboard.ts` (行号 335, 346)

**场景**: 待办事项、库存警报

**建议**: ⭕ 保留 `invalidateQueries`（统计数据可以延迟）

#### 15. WebSocket 事件处理

**文件**: `components/examples/WebSocketHooksExample.tsx`

**场景**: WebSocket 推送事件

**建议**: ⭕ 保留 `invalidateQueries`（已注释，示例代码）

#### 16. 批量规格管理

**文件**: `lib/api/batch-specifications.ts` (行号 160, 179, 183, 197)

**场景**: 批量规格创建/更新/删除

**建议**: ✅ 改为 `refetchQueries`（用户操作后需要立即看到结果）

#### 17. 价格历史

**文件**: `hooks/use-price-history.ts` (行号 163, 202)

**场景**: 创建/删除价格历史

**建议**: ✅ 改为 `refetchQueries`（用户操作后需要立即看到结果）

#### 18. 应付款表单

**文件**: `hooks/use-payable-form.ts` (行号 102, 129, 133)

**场景**: 创建/更新应付款

**建议**: ✅ 改为 `refetchQueries`（用户操作后需要立即看到结果）

## 修复优先级总结

### 🔴 第一批（最高优先级）- 影响核心业务流程

1. 退货订单相关 (lib/api/return-orders.ts)
2. 收款记录相关 (lib/api/payments.ts)
3. 应付款相关 (lib/api/payables.ts)
4. 厂家发货相关 (lib/api/factory-shipments.ts)

### 🟡 第二批（高优先级）- 影响日常操作

5. 库存盘点相关
6. 客户管理相关
7. 供应商管理相关
8. 产品管理相关
9. 分类管理相关
10. 用户管理相关

### 🟢 第三批（中优先级）- 优化用户体验

11. 财务报表相关
12. 库存操作相关
13. 批量规格管理
14. 价格历史
15. 应付款表单

## 修复模式

### 标准修复模式

```typescript
// ❌ 之前的代码
queryClient.invalidateQueries({ queryKey: someQueryKeys.lists() });

// ✅ 修复后的代码
queryClient.refetchQueries({
  queryKey: someQueryKeys.lists(),
  type: 'active',
});
```

### 多个查询的修复模式

```typescript
// ❌ 之前的代码
queryClient.invalidateQueries({ queryKey: queryKeys.list() });
queryClient.invalidateQueries({ queryKey: queryKeys.stats() });

// ✅ 修复后的代码
queryClient.refetchQueries({
  queryKey: queryKeys.list(),
  type: 'active',
});
queryClient.refetchQueries({
  queryKey: queryKeys.stats(),
  type: 'active',
});
```

## 预计影响

- **修复文件数**: ~40 个文件
- **修复行数**: ~150 处
- **预计工作量**: 2-3 小时
- **风险等级**: 低（只是改变缓存刷新策略，不改变业务逻辑）

## 下一步行动

1. ✅ 完成审查报告
2. ⏳ 按优先级批量修复
3. ⏳ 运行 ESLint 检查
4. ⏳ 提交修复
5. ⏳ 端到端测试验证
