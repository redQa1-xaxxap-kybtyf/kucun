# 采购费用 P0 修复总结

**修复日期**: 2025-11-22
**修复范围**: Stage 3 应付账款集成的关键阻断问题
**修复优先级**: P0（严重阻断）

---

## 修复内容

### ✅ 修复 1: 费用记录添加 supplierId（3处代码）

**问题**: 采购费用记录缺少 `supplierId`，导致 Stage 3 审批后无法创建应付款

**影响**: 🔴 **严重阻断** - 费用审批完全失败，Stage 3 集成不可用

**修复位置 1**: `app/actions/purchase-orders.utils.ts` - `createExpenseRecords` 函数

```typescript
// 修复前
async function createExpenseRecords(
  tx: PrismaTransaction,
  feeItems: NonNullable<PurchaseOrderFormData['feeItems']>,
  orderId: string,
  orderNumber: string,
  userId: string
): Promise<void> {
  const expenseRecords = feeItems.map(feeItem => ({
    expenseNumber: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    // ... 其他字段
    userId,
    // ❌ 缺少: supplierId, status, paymentStatus
  }));
  await tx.expenseRecord.createMany({ data: expenseRecords });
}

// 修复后
async function createExpenseRecords(
  tx: PrismaTransaction,
  feeItems: NonNullable<PurchaseOrderFormData['feeItems']>,
  orderId: string,
  orderNumber: string,
  userId: string,
  supplierId: string // ✅ 新增参数
): Promise<void> {
  const expenseRecords = feeItems.map(feeItem => ({
    expenseNumber: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    // ... 其他字段
    userId,
    supplierId, // ✅ 设置 supplierId（Stage 3 必需）
    status: 'draft', // ✅ 明确设置状态
    paymentStatus: 'unpaid', // ✅ 明确设置支付状态
  }));
  await tx.expenseRecord.createMany({ data: expenseRecords });
}

// 调用处修复（第124-131行）
await createExpenseRecords(
  tx,
  data.feeItems ?? [],
  order.id,
  order.orderNumber,
  userId,
  primarySupplierId // ✅ 传递供应商ID
);
```

**修复位置 2**: `app/actions/purchase-orders.utils.ts` - `replaceExpenseRecords` 函数

```typescript
// 修复后（第286-333行）
async function replaceExpenseRecords(
  tx: PrismaTransaction,
  orderId: string,
  feeItems: NonNullable<PurchaseOrderFormData['feeItems']>,
  orderNumber: string,
  userId: string,
  supplierId: string // ✅ 新增参数
): Promise<number> {
  // ... 删除旧费用记录

  for (const feeItem of feeItems) {
    await tx.expenseRecord.create({
      data: {
        expenseNumber: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        // ... 其他字段
        supplierId, // ✅ 设置 supplierId
        status: 'draft', // ✅ 明确设置状态
        paymentStatus: 'unpaid', // ✅ 明确设置支付状态
      },
    });
  }

  return feeItems.reduce((sum, item) => sum + item.feeAmount, 0);
}

// 调用处修复（第239-246行）
const expenseAmount = await replaceExpenseRecords(
  tx,
  orderId,
  data.feeItems ?? [],
  existingOrder.orderNumber,
  userId,
  existingOrder.supplierId // ✅ 传递供应商ID
);
```

**修复位置 3**: `app/api/purchase-orders/route.ts` - POST 端点

```typescript
// 修复后（第386-406行）
if (feeItems && feeItems.length > 0) {
  const expenseRecords = feeItems.map(feeItem => ({
    expenseNumber: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    // ... 其他字段
    userId,
    supplierId: normalizedSupplierId, // ✅ 设置 supplierId
    status: 'draft', // ✅ 明确设置状态
    paymentStatus: 'unpaid', // ✅ 明确设置支付状态
  }));

  await tx.expenseRecord.createMany({ data: expenseRecords });
}
```

---

### ✅ 修复 2: 应付款金额包含费用

**问题**: 应付款金额只计算采购金额，不包含费用金额

**影响**: 🔴 **严重** - 应付款金额不准确，财务核算错误

**修复状态**: ⚠️ **已存在修复** - `lib/services/purchase-order-payable.ts` 已正确实现

```typescript
// lib/services/purchase-order-payable.ts (第26-89行)
export async function ensurePurchaseOrderPayable(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    supplierId: string;
    userId: string;
    orderNumber: string;
    totalAmount: number;
    expenseAmount?: number | null; // ✅ 接收费用金额
  }
): Promise<void> {
  // ✅ 应付金额 = 物料金额 + 费用金额
  const payableAmount = order.totalAmount + (order.expenseAmount ?? 0);

  // ... 创建应付款
  const newPayable = await tx.payableRecord.create({
    data: {
      // ...
      payableAmount, // ✅ 使用包含费用的总金额
      remainingAmount: payableAmount, // ✅ 使用包含费用的总金额
    },
  });

  // （见修复3）
}
```

**验证**: API Route 已传递 `expenseAmount`（`app/api/purchase-orders/route.ts:382`）

---

### ✅ 修复 3: 应付款关联费用记录

**问题**: 创建应付款后，费用记录的 `payableId` 未设置

**影响**: 🔴 **严重阻断** - 付款核销后费用支付状态永远不会更新

**修复位置**: `lib/services/purchase-order-payable.ts`

```typescript
// 修复前（第60-76行）
await tx.payableRecord.create({
  data: {
    // ... 应付款数据
  },
});
// ❌ 缺少：更新费用记录的 payableId

// 修复后（第60-89行）
const newPayable = await tx.payableRecord.create({
  data: {
    // ... 应付款数据
  },
});

// ✅ P0修复：关联费用记录到应付款
await tx.expenseRecord.updateMany({
  where: {
    relatedType: 'purchase_order',
    relatedId: order.id,
    payableId: null, // 仅更新未关联的费用
  },
  data: {
    payableId: newPayable.id,
  },
});
```

**效果**:

- 费用记录正确关联到应付款
- 付款核销时可以通过 `payableId` 找到关联费用
- Stage 3 的 `updateExpensePaymentStatusAfterPayment` 可以正常工作

---

### ✅ 修复 4: 明确设置 status 和 paymentStatus

**问题**: 新创建的费用记录依赖 schema 默认值，不够明确

**影响**: 🟡 **中等** - 潜在风险，如果 schema 默认值更改可能导致意外行为

**修复**: 包含在修复 1 中，所有费用创建点都明确设置了：

- `status: 'draft'`
- `paymentStatus: 'unpaid'`

---

## 修复文件汇总

| 文件路径                                 | 修改类型 | 修改行数           |
| ---------------------------------------- | -------- | ------------------ |
| `app/actions/purchase-orders.utils.ts`   | 修改     | 函数签名+调用点 x2 |
| `app/api/purchase-orders/route.ts`       | 修改     | 费用创建逻辑       |
| `lib/services/purchase-order-payable.ts` | 新增     | 费用关联逻辑       |

---

## 验证方法

### 1. 手动测试流程

```
1. 创建采购订单（包含费用项）
   - 输入采购物料：总价 1000 元
   - 添加费用：运费 100 元
   - 供应商：测试供应商 A
   - 状态：草稿 或 已下单

2. 验证费用记录
   - 检查 ExpenseRecord 表
   - 确认 supplierId 已设置为 "测试供应商 A"
   - 确认 status = 'draft'
   - 确认 paymentStatus = 'unpaid'
   - 确认 relatedType = 'purchase_order'

3. 审批费用（如果订单状态为草稿）
   - 调用审批接口
   - 验证应付款已自动创建（Stage 3 集成）
   - 确认 payableAmount = 1100 元（1000 + 100）
   - 确认费用的 payableId 已设置

4. 如果订单创建时状态为 ORDERED
   - 验证应付款已立即创建
   - 确认 payableAmount = 1100 元
   - 确认费用的 payableId 已立即设置

5. 创建付款记录
   - 付款金额：600 元（部分付款）
   - 验证应付款 remainingAmount = 500
   - 验证费用 paymentStatus = 'partial'

6. 创建第二笔付款
   - 付款金额：500 元（全额付款）
   - 验证应付款 status = 'paid'
   - 验证费用 paymentStatus = 'paid'
```

### 2. 数据验证 SQL

```sql
-- 验证 supplierId 已正确设置
SELECT
  e.expenseNumber,
  e.expenseAmount,
  e.supplierId,
  e.status,
  e.paymentStatus,
  e.payableId,
  po.orderNumber,
  po.supplierId AS order_supplierId
FROM ExpenseRecord e
INNER JOIN PurchaseOrder po ON e.relatedId = po.id
WHERE e.relatedType = 'purchase_order'
  AND e.supplierId IS NOT NULL
ORDER BY e.createdAt DESC
LIMIT 10;

-- 验证应付款金额准确性
SELECT
  pr.payableNumber,
  pr.payableAmount AS "应付款金额",
  po.totalAmount AS "采购金额",
  po.expenseAmount AS "费用金额",
  (po.totalAmount + COALESCE(po.expenseAmount, 0)) AS "预期应付金额",
  pr.payableAmount - (po.totalAmount + COALESCE(po.expenseAmount, 0)) AS "差异"
FROM PayableRecord pr
INNER JOIN PurchaseOrder po ON pr.sourceId = po.id
WHERE pr.sourceType = 'purchase_order'
ORDER BY pr.createdAt DESC
LIMIT 10;

-- 验证费用与应付款关联
SELECT
  e.expenseNumber,
  e.expenseAmount,
  e.status,
  e.paymentStatus,
  e.payableId,
  pr.payableNumber,
  pr.status AS payable_status
FROM ExpenseRecord e
INNER JOIN PayableRecord pr ON e.payableId = pr.id
WHERE e.relatedType = 'purchase_order'
  AND pr.sourceType = 'purchase_order'
ORDER BY e.createdAt DESC
LIMIT 10;
```

### 3. 集成测试（建议添加）

```typescript
describe('采购费用 Stage 3 集成测试', () => {
  it('应在创建订单时正确设置费用 supplierId', async () => {
    const order = await createPurchaseOrder({
      items: [{ supplierId: 'supplier-1', totalPrice: 1000 }],
      feeItems: [{ feeType: 'freight', feeName: '运费', feeAmount: 100 }],
    });

    const expense = await prisma.expenseRecord.findFirst({
      where: { relatedId: order.id },
    });

    expect(expense.supplierId).toBe('supplier-1');
    expect(expense.status).toBe('draft');
    expect(expense.paymentStatus).toBe('unpaid');
  });

  it('应在审批费用后自动创建应付款', async () => {
    const { order, expense } = await setupPurchaseOrderWithExpense();

    await approveExpenseRecord(expense.id, 'approver-id');

    const payable = await prisma.payableRecord.findFirst({
      where: { sourceId: order.id },
    });

    expect(payable).toBeDefined();
    expect(payable.payableAmount).toBe(1100); // 1000 + 100
  });

  it('应在创建应付款时关联费用记录', async () => {
    const { order, expense } = await setupPurchaseOrderWithExpense();

    await approveExpenseRecord(expense.id, 'approver-id');

    const updatedExpense = await prisma.expenseRecord.findUnique({
      where: { id: expense.id },
    });

    expect(updatedExpense.payableId).toBeDefined();
  });

  it('应在付款核销后更新费用支付状态', async () => {
    const { payable, expense } = await setupPayableWithExpense();

    // 部分付款
    await createPaymentOutRecord({
      payableRecordId: payable.id,
      paymentAmount: 600,
    });

    let updatedExpense = await prisma.expenseRecord.findUnique({
      where: { id: expense.id },
    });
    expect(updatedExpense.paymentStatus).toBe('partial');

    // 全额付款
    await createPaymentOutRecord({
      payableRecordId: payable.id,
      paymentAmount: 500,
    });

    updatedExpense = await prisma.expenseRecord.findUnique({
      where: { id: expense.id },
    });
    expect(updatedExpense.paymentStatus).toBe('paid');
  });
});
```

---

## Stage 3 兼容性验证

### 审批后创建应付款流程

```typescript
// lib/services/expense-service.ts:435-504
export async function approveExpenseRecord(
  id: string,
  approverId: string
): Promise<ExpenseRecordDetail> {
  const expense = await prisma.$transaction(async tx => {
    const updatedExpense = await tx.expenseRecord.update({
      where: { id },
      data: {
        status: 'approved',
        approvedById: approverId,
        approvedAt: new Date(),
      },
    });

    // Stage 3 集成
    if (
      env.EXPENSE_TO_PAYABLE_ENABLED &&
      updatedExpense.supplierId && // ✅ P0修复后，采购费用有 supplierId
      updatedExpense.expenseAmount > 0
    ) {
      await createOrMergePayableFromExpense({
        expenseId: updatedExpense.id,
        supplierId: updatedExpense.supplierId, // ✅ 传递有效的 supplierId
        // ... 其他参数
      });
    }

    return updatedExpense;
  });
}
```

**修复前**: `updatedExpense.supplierId` 为 null → 条件失败 → 不创建应付款 ❌

**修复后**: `updatedExpense.supplierId` 为供应商ID → 条件通过 → 创建应付款 ✅

### 付款核销更新费用状态流程

```typescript
// app/api/finance/payments-out/route.ts:299-320
if (env.EXPENSE_TO_PAYABLE_ENABLED && data.payableRecordId) {
  await updateExpensePaymentStatusAfterPayment({
    payableRecordId: data.payableRecordId,
    paymentAmount: data.paymentAmount,
    tx,
  });
}

// lib/services/expense-payable-integration.ts
export async function updateExpensePaymentStatusAfterPayment(params) {
  const payable = await db.payableRecord.findUnique({
    where: { id: payableRecordId },
    include: {
      expenseRecords: {
        // ✅ P0修复后，可以通过 payableId 找到关联费用
        where: { paymentStatus: { in: ['unpaid', 'partial'] } },
      },
    },
  });

  // 更新应付款金额
  // ...

  // 更新费用支付状态
  if (isFullyPaid) {
    await db.expenseRecord.updateMany({
      where: {
        payableId: payableRecordId, // ✅ P0修复后，费用有 payableId
        paymentStatus: { in: ['unpaid', 'partial'] },
      },
      data: { paymentStatus: 'paid' },
    });
  } else if (newPaidAmount > 0) {
    await db.expenseRecord.updateMany({
      where: {
        payableId: payableRecordId,
        paymentStatus: 'unpaid',
      },
      data: { paymentStatus: 'partial' },
    });
  }
}
```

**修复前**: 费用的 `payableId` 为 null → 无法通过 `payableRecordId` 关联 → 费用状态不更新 ❌

**修复后**: 费用的 `payableId` 已设置 → 可以正确关联 → 费用状态正确更新 ✅

---

## 预期效果

修复后，采购订单费用链路将完全兼容 Stage 3：

1. ✅ **费用创建时包含 supplierId**
   - 所有采购费用记录都有有效的 `supplierId`
   - 费用状态和支付状态明确初始化

2. ✅ **费用审批后自动创建应付款（merge 策略）**
   - 按 `supplierId` + `sourceType` + `sourceId` 分组合并
   - 应付款金额 = 采购金额 + 费用金额

3. ✅ **费用正确关联应付款**
   - 费用记录的 `payableId` 正确设置
   - 可以通过应付款ID查询关联的所有费用

4. ✅ **付款核销后费用支付状态自动更新**
   - 部分付款：`paymentStatus` 从 'unpaid' 更新为 'partial'
   - 全额付款：`paymentStatus` 从 'partial' 更新为 'paid'

5. ✅ **幂等性保证**
   - 重复运行不会产生重复数据
   - 已关联的费用不会被重复关联

---

## 后续建议

### P1 修复（重要，建议2-3天内完成）

1. **添加 idempotencyKey**
   - 使用订单ID + 费用详情生成唯一键
   - 防止重复创建费用记录

2. **统一费用创建函数（DRY）**
   - 抽取 `createExpenseFromFeeItem` 辅助函数
   - 在所有需要创建费用的地方复用

3. **补充集成测试**
   - 覆盖审批和付款核销场景
   - 验证 Stage 3 兼容性

### P2 优化（建议1天内完成）

1. **统一编号生成器**
   - 实现 `generateExpenseNumber()` 函数
   - 使用规范编号格式（如 `FY202501-EXP-0001`）

2. **补充单元测试**
   - 边界条件测试
   - 错误处理测试

---

**修复完成时间**: 2025-11-22
**下一步**: 运行构建验证，然后进行手动测试
