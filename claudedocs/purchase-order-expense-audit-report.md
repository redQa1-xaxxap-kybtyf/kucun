# 采购订单费用链路审计报告

**审计日期**: 2025-11-22
**审计范围**: 采购订单费用生成、应付账款关联、数据一致性
**审计目的**: 验证采购费用链路与 Stage 3 应付账款集成的兼容性

---

## 执行摘要

本次审计针对采购订单（Purchase Order）的费用链路进行了全面检查，重点关注费用记录的生成、应付账款关联以及与 Stage 3 实现的兼容性。

### 关键发现

- ✅ **数据模型完整性**: ExpenseRecord 和 PayableRecord 模型支持所需字段
- ❌ **费用生成缺陷**: 缺少关键字段（supplierId, idempotencyKey），导致 Stage 3 集成失败
- ⚠️ **代码重复问题**: 费用创建逻辑在多处重复，违反 DRY 原则
- ⚠️ **应付款金额不准确**: 应付款创建时未包含费用金额（部分修复）
- ❌ **费用状态未初始化**: 新创建的费用记录缺少状态字段初始化

### 影响评估

| 问题类型            | 严重程度    | 影响范围     | Stage 3 兼容性  |
| ------------------- | ----------- | ------------ | --------------- |
| 缺少 supplierId     | 🔴 **严重** | 所有采购费用 | ❌ 阻断合并策略 |
| 缺少 idempotencyKey | 🟡 **中等** | 费用创建     | ⚠️ 幂等性缺失   |
| 代码重复            | 🟡 **中等** | 维护性       | ⚠️ 间接影响     |
| 应付款未关联费用    | 🔴 **严重** | 应付款准确性 | ❌ 阻断费用同步 |
| 费用状态未初始化    | 🟡 **中等** | 审批流程     | ⚠️ 审批失败风险 |

---

## 详细审计结果

### 1. 数据模型审查

#### 1.1 PurchaseOrder 模型（prisma/schema.prisma:1200-1238）

```prisma
model PurchaseOrder {
  id              String    @id @default(uuid())
  orderNumber     String    @unique
  supplierId      String
  totalAmount     Float     @default(0)
  expenseAmount   Float?    @default(0)  // ✅ 支持费用金额存储
  costAmount      Float?    @default(0)
  status          String    @default("draft")
  // ... 其他字段

  supplier        Supplier  @relation(...)
  items           PurchaseOrderItem[]

  @@index([supplierId])
  @@index([status])
}
```

**评估**: ✅ **合格** - 模型完整，支持费用金额跟踪

#### 1.2 ExpenseRecord 模型（prisma/schema.prisma:1080-1120）

```prisma
model ExpenseRecord {
  id              String   @id @default(uuid())
  expenseNumber   String   @unique
  expenseType     String
  expenseAmount   Float
  relatedType     String?  // 'purchase_order', 'sales_order', etc.
  relatedId       String?
  relatedNumber   String?
  status          String   @default("draft")

  // Stage 2 新增字段
  paymentStatus   String   @default("unpaid")
  payableId       String?
  idempotencyKey  String?  @unique
  supplierId      String?  // ⚠️ 可选字段，但对 Stage 3 至关重要

  payable         PayableRecord? @relation(...)

  @@index([relatedType, relatedId])
  @@index([status])
  @@index([paymentStatus])
  @@index([supplierId])
}
```

**评估**: ✅ **合格** - 模型支持所有必需字段（包括 supplierId, idempotencyKey, payableId）

#### 1.3 PayableRecord 模型（prisma/schema.prisma:943-976）

```prisma
model PayableRecord {
  id              String    @id @default(uuid())
  payableNumber   String    @unique
  supplierId      String
  sourceType      String    // 'purchase_order', 'sales_order', etc.
  sourceId        String?
  sourceNumber    String?
  payableAmount   Float
  paidAmount      Float     @default(0)
  remainingAmount Float
  status          String    @default("pending")

  expenseRecords  ExpenseRecord[]

  @@index([supplierId])
  @@index([status])
  @@index([sourceType, sourceId])
}
```

**评估**: ✅ **合格** - 完全支持 Stage 3 的 merge 策略（按 supplierId + sourceType + sourceId 分组）

---

### 2. 费用生成逻辑审查

#### 2.1 创建订单时的费用记录生成

**位置 1**: `app/actions/purchase-orders.utils.ts:172-199`

```typescript
async function createExpenseRecords(
  tx: PrismaTransaction,
  feeItems: NonNullable<PurchaseOrderFormData['feeItems']>,
  orderId: string,
  orderNumber: string,
  userId: string
): Promise<void> {
  if (!feeItems || feeItems.length === 0) {
    return;
  }

  const expenseRecords = feeItems.map(feeItem => ({
    expenseNumber: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // ⚠️ 不规范
    expenseType: feeItem.feeType,
    expenseName: feeItem.feeName,
    expenseAmount: feeItem.feeAmount,
    expenseDate: new Date(),
    relatedType: 'purchase_order', // ✅ 正确
    relatedId: orderId, // ✅ 正确
    relatedNumber: orderNumber, // ✅ 正确
    remarks: feeItem.remarks || undefined,
    userId,
    // ❌ 缺少: supplierId
    // ❌ 缺少: idempotencyKey
    // ❌ 缺少: status (应为 'draft')
    // ❌ 缺少: paymentStatus (应为 'unpaid')
  }));

  await tx.expenseRecord.createMany({ data: expenseRecords });
}
```

**位置 2**: `app/api/purchase-orders/route.ts:386-403` (POST 端点)

```typescript
if (feeItems && feeItems.length > 0) {
  const expenseRecords = feeItems.map(feeItem => ({
    expenseNumber: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // ⚠️ 不规范
    expenseType: feeItem.feeType,
    expenseName: feeItem.feeName,
    expenseAmount: feeItem.feeAmount,
    expenseDate: new Date(),
    relatedType: 'purchase_order',
    relatedId: newOrder.id,
    relatedNumber: newOrder.orderNumber,
    remarks: feeItem.remarks || undefined,
    userId,
    // ❌ 缺少: supplierId
    // ❌ 缺少: idempotencyKey
    // ❌ 缺少: status
    // ❌ 缺少: paymentStatus
  }));

  await tx.expenseRecord.createMany({ data: expenseRecords });
}
```

**问题清单**:

1. ❌ **缺少 `supplierId`**:
   - **影响**: Stage 3 的 `createOrMergePayableFromExpense` 函数要求 `supplierId` 不为 null（line 30: `if (!supplierId) throw ApiError.badRequest()`）
   - **后果**: 费用审批后无法创建应付款，导致 Stage 3 集成完全失败
   - **修复优先级**: 🔴 P0（严重阻断）

2. ❌ **缺少 `idempotencyKey`**:
   - **影响**: 无法防止重复创建费用记录
   - **后果**: 用户重复提交表单时可能生成重复费用
   - **修复优先级**: 🟡 P1（重要）

3. ⚠️ **`expenseNumber` 生成不规范**:
   - **影响**: 使用 `EXP-{timestamp}-{random}` 格式，不符合统一编号规范
   - **后果**: 编号不易识别、排序不友好
   - **修复优先级**: 🟢 P2（建议）

4. ❌ **缺少 `status` 字段**:
   - **影响**: 新费用记录的状态默认为 'draft'（schema 默认值），但应明确设置
   - **后果**: 如果 schema 默认值更改，可能导致意外行为
   - **修复优先级**: 🟡 P1（重要）

5. ❌ **缺少 `paymentStatus` 字段**:
   - **影响**: 新费用记录的支付状态默认为 'unpaid'（schema 默认值）
   - **后果**: 同上，依赖隐式默认值不够明确
   - **修复优先级**: 🟡 P1（重要）

#### 2.2 更新订单时的费用记录替换

**位置**: `app/actions/purchase-orders.utils.ts:281-324`

```typescript
async function replaceExpenseRecords(
  tx: PrismaTransaction,
  orderId: string,
  feeItems: NonNullable<PurchaseOrderFormData['feeItems']>,
  orderNumber: string,
  userId: string
): Promise<number> {
  // ✅ 正确：删除旧费用记录
  await tx.expenseRecord.deleteMany({
    where: {
      relatedType: 'purchase_order',
      relatedId: orderId,
    },
  });

  if (!feeItems || feeItems.length === 0) {
    return 0;
  }

  // 创建新费用记录（循环创建）
  for (const feeItem of feeItems) {
    const expenseNumber = `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    await tx.expenseRecord.create({
      data: {
        expenseNumber,
        expenseType: feeItem.feeType,
        expenseName: feeItem.feeName.trim(),
        expenseAmount: feeItem.feeAmount,
        expenseDate: new Date(),
        remarks: feeItem.remarks?.trim() || undefined,
        relatedType: 'purchase_order',
        relatedId: orderId,
        relatedNumber: orderNumber,
        userId,
        // ❌ 同样缺少: supplierId, idempotencyKey, status, paymentStatus
      },
    });
  }

  // ✅ 正确：返回费用总额
  return feeItems.reduce((sum, item) => sum + item.feeAmount, 0);
}
```

**问题**: 与创建时相同的字段缺失问题

---

### 3. 应付账款关联审查

#### 3.1 应付款自动创建逻辑

**位置**: `app/actions/purchase-orders.utils.ts:133-166`

```typescript
// 按供应商分组创建应付账款
if (shouldAutoCreatePayable(status, totalAmount)) {
  const supplierAmounts = new Map<string, number>();

  // 统计每个供应商的采购金额
  for (const item of data.items) {
    const currentAmount = supplierAmounts.get(item.supplierId) || 0;
    supplierAmounts.set(item.supplierId, currentAmount + item.totalPrice);
  }

  // 为每个供应商创建应付记录
  for (const [supplierId, amount] of supplierAmounts.entries()) {
    const payableNumber = await generatePayableNumber(tx);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    await tx.payableRecord.create({
      data: {
        payableNumber,
        supplierId,
        userId,
        sourceType: 'purchase_order', // ✅ 正确
        sourceId: order.id, // ✅ 正确
        sourceNumber: order.orderNumber, // ✅ 正确
        payableAmount: amount, // ❌ 只包含采购金额，不包含费用！
        paidAmount: 0,
        remainingAmount: amount,
        dueDate,
        status: 'pending',
        paymentTerms: '30天',
        remarks: `系统自动生成：采购订单 ${order.orderNumber} 确认应付`,
      },
    });
  }
}
```

**问题清单**:

1. ❌ **应付款金额不包含费用**:
   - **影响**: `payableAmount` 只计算了采购项的 `totalPrice`，忽略了费用金额
   - **后果**: 应付款金额不准确，与实际应付不符
   - **修复状态**: ⚠️ 部分修复（API route 已传递 `expenseAmount`，但未实际使用）
   - **修复优先级**: 🔴 P0（严重）

2. ❌ **应付款未关联费用记录**:
   - **影响**: 创建应付款后，费用记录的 `payableId` 未设置
   - **后果**: 费用记录与应付款无关联，Stage 3 的付款核销无法更新费用支付状态
   - **修复优先级**: 🔴 P0（严重）

#### 3.2 API Route 应付款创建

**位置**: `app/api/purchase-orders/route.ts:375-384`

```typescript
if (shouldCreatePayable(newOrder.status as PurchaseOrderStatus)) {
  await ensurePurchaseOrderPayable(tx, {
    id: newOrder.id,
    supplierId: newOrder.supplierId,
    userId,
    orderNumber: newOrder.orderNumber,
    totalAmount,
    expenseAmount, // ✅ 修复：传递费用金额
  });
}
```

**评估**: ⚠️ **部分修复** - API 已传递 `expenseAmount`，但需验证 `ensurePurchaseOrderPayable` 是否正确使用该字段

---

### 4. 代码质量问题

#### 4.1 代码重复（违反 DRY 原则）

费用创建逻辑在以下位置重复出现：

1. `app/actions/purchase-orders.utils.ts:createExpenseRecords` (lines 172-199)
2. `app/actions/purchase-orders.utils.ts:replaceExpenseRecords` (lines 302-320)
3. `app/api/purchase-orders/route.ts:POST` (lines 386-403)

**影响**:

- 维护成本高：修复一个地方的bug需要同步修改多处
- 一致性风险：不同位置的逻辑可能产生不一致的行为
- 违反 DRY 原则

**建议**: 抽取统一的 `createExpenseFromFeeItem` 辅助函数

#### 4.2 缺少统一的编号生成器

当前使用 `EXP-${Date.now()}-${Math.random()}` 生成费用编号，存在以下问题：

- 不符合业务编号规范（如 `FY202501-EXP-0001`）
- 并发时可能产生重复编号（虽然概率极低）
- 不易识别和排序

**建议**: 使用类似 `generatePurchaseOrderNumber` 的统一编号生成器

---

### 5. 前端实现审查

#### 5.1 费用项输入组件

**位置**: `components/purchase-orders/purchase-order-form.tsx:128-143, 397-408`

```tsx
// 表单初始化
feeItems: initialData.expenses
  ? initialData.expenses.map(expense => ({
      feeType: expense.expenseType as 'freight' | 'processing' | ...,
      feeName: expense.expenseName,
      feeAmount: Number(expense.expenseAmount),
      remarks: expense.remarks || '',
    }))
  : [],

// 表单字段
<FormField
  control={form.control}
  name="feeItems"
  render={({ field }) => (
    <FormItem>
      <FormControl>
        <FactoryShipmentFeeItemsInput
          feeItems={(field.value || []).map(item => ({
            ...item,
            paidBy: undefined, // 类型适配
          }))}
          onUpdate={field.onChange}
          totalWeight={0}
          totalQuantity={0}
        />
      </FormControl>
    </FormItem>
  )}
/>
```

**评估**: ✅ **合格** - 前端正确收集了 `feeType`, `feeName`, `feeAmount`, `remarks` 字段

**说明**: 前端无法提供 `supplierId`，需要后端从 `PurchaseOrder.supplierId` 获取

---

## Stage 3 兼容性分析

### 核心集成点验证

#### 集成点 1: 费用审批后创建应付款

**代码**: `lib/services/expense-service.ts:435-504`

```typescript
export async function approveExpenseRecord(
  id: string,
  approverId: string
): Promise<ExpenseRecordDetail> {
  const expense = await prisma.$transaction(async tx => {
    const updatedExpense = await tx.expenseRecord.update({ ... });

    if (
      env.EXPENSE_TO_PAYABLE_ENABLED &&
      updatedExpense.supplierId &&  // ❌ 采购费用的 supplierId 为 null，此条件失败
      updatedExpense.expenseAmount > 0
    ) {
      await createOrMergePayableFromExpense({
        supplierId: updatedExpense.supplierId, // ❌ 传递 null，导致 ApiError
        // ...
      });
    }
    return updatedExpense;
  });
}
```

**问题**:

- 采购费用缺少 `supplierId` → 条件 `updatedExpense.supplierId` 为 false → **不会创建应付款**
- 即使条件通过，`createOrMergePayableFromExpense` 也会因 `supplierId` 为 null 而抛出错误

**兼容性**: ❌ **完全阻断** - 采购费用无法通过审批流程自动创建应付款

#### 集成点 2: 付款核销更新费用支付状态

**代码**: `app/api/finance/payments-out/route.ts:299-320`

```typescript
// 阶段3：付款核销后联动更新关联费用的支付状态
if (env.EXPENSE_TO_PAYABLE_ENABLED && data.payableRecordId) {
  await updateExpensePaymentStatusAfterPayment({
    payableRecordId: data.payableRecordId,
    paymentAmount: data.paymentAmount,
    tx,
  });
}
```

**问题**:

- 采购费用的 `payableId` 未设置 → 无法通过 `payableRecordId` 关联到费用 → **费用支付状态不会更新**

**兼容性**: ❌ **功能缺失** - 付款后费用状态不会同步更新为 'partial' 或 'paid'

---

## 修复建议

### 优先级 P0（立即修复）

#### 修复 1: 费用创建时添加 supplierId

**文件**: `app/actions/purchase-orders.utils.ts`

```typescript
async function createExpenseRecords(
  tx: PrismaTransaction,
  feeItems: NonNullable<PurchaseOrderFormData['feeItems']>,
  orderId: string,
  orderNumber: string,
  userId: string,
  supplierId: string // ✅ 新增参数
): Promise<void> {
  if (!feeItems || feeItems.length === 0) {
    return;
  }

  const expenseRecords = feeItems.map(feeItem => ({
    expenseNumber: `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    expenseType: feeItem.feeType,
    expenseName: feeItem.feeName,
    expenseAmount: feeItem.feeAmount,
    expenseDate: new Date(),
    relatedType: 'purchase_order',
    relatedId: orderId,
    relatedNumber: orderNumber,
    remarks: feeItem.remarks || undefined,
    userId,
    supplierId, // ✅ 新增字段
    status: 'draft', // ✅ 明确设置状态
    paymentStatus: 'unpaid', // ✅ 明确设置支付状态
    // idempotencyKey: generateIdempotencyKey(orderId, feeItem), // 建议添加
  }));

  await tx.expenseRecord.createMany({ data: expenseRecords });
}

// 调用处修改（多处）
await createExpenseRecords(
  tx,
  data.feeItems ?? [],
  order.id,
  order.orderNumber,
  userId,
  primarySupplierId // ✅ 传递供应商ID
);
```

**同样修改**:

- `replaceExpenseRecords` 函数
- `app/api/purchase-orders/route.ts:POST` 端点

#### 修复 2: 应付款金额包含费用

**文件**: `lib/services/purchase-order-payable.ts` (推测)

```typescript
export async function ensurePurchaseOrderPayable(
  tx: PrismaTransaction,
  params: {
    id: string;
    supplierId: string;
    userId: string;
    orderNumber: string;
    totalAmount: number;
    expenseAmount?: number; // ✅ 接收费用金额
  }
) {
  const { totalAmount, expenseAmount } = params;
  const payableAmount = totalAmount + (expenseAmount || 0); // ✅ 合并采购金额和费用

  await tx.payableRecord.create({
    data: {
      // ...
      payableAmount, // ✅ 使用合并后的金额
      remainingAmount: payableAmount,
      // ...
    },
  });
}
```

#### 修复 3: 应付款关联费用记录

**文件**: `app/actions/purchase-orders.utils.ts`

```typescript
// 创建应付款后，更新费用记录的 payableId
if (shouldAutoCreatePayable(status, totalAmount)) {
  const payable = await tx.payableRecord.create({
    // ... 应付款数据
  });

  // ✅ 新增：关联费用记录
  await tx.expenseRecord.updateMany({
    where: {
      relatedType: 'purchase_order',
      relatedId: order.id,
      payableId: null, // 仅更新未关联的费用
    },
    data: {
      payableId: payable.id,
    },
  });
}
```

### 优先级 P1（重要）

#### 修复 4: 添加 idempotencyKey

```typescript
function generateExpenseIdempotencyKey(
  orderId: string,
  feeItem: { feeType: string; feeName: string; feeAmount: number }
): string {
  // 基于订单ID和费用详情生成唯一键
  const content = `${orderId}:${feeItem.feeType}:${feeItem.feeName}:${feeItem.feeAmount}`;
  return createHash('sha256').update(content).digest('hex').substring(0, 32);
}

// 在费用创建时使用
const expenseRecords = feeItems.map(feeItem => ({
  // ...
  idempotencyKey: generateExpenseIdempotencyKey(orderId, feeItem),
}));
```

#### 修复 5: 统一费用创建函数（DRY）

```typescript
// lib/services/expense-creation.ts
export interface CreateExpenseParams {
  feeType: string;
  feeName: string;
  feeAmount: number;
  remarks?: string;
  relatedType: 'purchase_order' | 'sales_order' | 'factory_shipment' | 'other';
  relatedId: string;
  relatedNumber: string;
  supplierId: string;
  userId: string;
}

export async function createExpenseRecord(
  tx: PrismaTransaction,
  params: CreateExpenseParams
): Promise<void> {
  const expenseNumber = await generateExpenseNumber(tx); // 使用统一编号生成器

  await tx.expenseRecord.create({
    data: {
      expenseNumber,
      expenseType: params.feeType,
      expenseName: params.feeName,
      expenseAmount: params.feeAmount,
      expenseDate: new Date(),
      relatedType: params.relatedType,
      relatedId: params.relatedId,
      relatedNumber: params.relatedNumber,
      remarks: params.remarks || undefined,
      userId: params.userId,
      supplierId: params.supplierId,
      status: 'draft',
      paymentStatus: 'unpaid',
      idempotencyKey: generateExpenseIdempotencyKey(params.relatedId, {
        feeType: params.feeType,
        feeName: params.feeName,
        feeAmount: params.feeAmount,
      }),
    },
  });
}

// 在所有需要创建费用的地方调用此函数
```

### 优先级 P2（建议）

#### 修复 6: 统一编号生成器

```typescript
// lib/services/expense-number-generator.ts
export async function generateExpenseNumber(
  tx?: PrismaTransaction
): Promise<string> {
  const db = tx || prisma;
  const now = new Date();
  const prefix = `FY${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const lastExpense = await db.expenseRecord.findFirst({
    where: {
      expenseNumber: { startsWith: prefix },
    },
    orderBy: { createdAt: 'desc' },
    select: { expenseNumber: true },
  });

  let sequence = 1;
  if (lastExpense) {
    const match = lastExpense.expenseNumber.match(/-(\d{4})$/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}-EXP-${String(sequence).padStart(4, '0')}`;
}
```

---

## 测试建议

### 集成测试用例

#### 测试 1: 采购费用审批后创建应付款

```typescript
describe('采购费用审批集成', () => {
  it('应在审批后自动创建应付款', async () => {
    // 1. 创建采购订单（包含费用）
    const order = await createPurchaseOrder({
      items: [{ supplierId: 'supplier-1', totalPrice: 1000 }],
      feeItems: [{ feeType: 'freight', feeName: '运费', feeAmount: 100 }],
    });

    // 2. 获取费用记录
    const expense = await prisma.expenseRecord.findFirst({
      where: { relatedId: order.id },
    });

    // 3. 审批费用
    await approveExpenseRecord(expense.id, 'approver-id');

    // 4. 验证应付款已创建
    const payable = await prisma.payableRecord.findFirst({
      where: {
        sourceId: order.id,
        sourceType: 'purchase_order',
      },
    });
    expect(payable).toBeDefined();
    expect(payable.payableAmount).toBe(1100); // 1000 + 100

    // 5. 验证费用已关联应付款
    const updatedExpense = await prisma.expenseRecord.findUnique({
      where: { id: expense.id },
    });
    expect(updatedExpense.payableId).toBe(payable.id);
  });
});
```

#### 测试 2: 付款核销更新费用支付状态

```typescript
describe('付款核销集成', () => {
  it('应在付款后更新费用支付状态', async () => {
    // 1. 创建采购订单 + 费用 + 应付款（假设已修复）
    const { order, expense, payable } = await setupPurchaseOrderWithExpense();

    // 2. 创建付款记录（部分付款）
    await createPaymentOutRecord({
      payableRecordId: payable.id,
      paymentAmount: 500, // 部分付款
    });

    // 3. 验证费用支付状态更新为 'partial'
    const updatedExpense = await prisma.expenseRecord.findUnique({
      where: { id: expense.id },
    });
    expect(updatedExpense.paymentStatus).toBe('partial');

    // 4. 创建第二笔付款（全额付款）
    await createPaymentOutRecord({
      payableRecordId: payable.id,
      paymentAmount: 600,
    });

    // 5. 验证费用支付状态更新为 'paid'
    const finalExpense = await prisma.expenseRecord.findUnique({
      where: { id: expense.id },
    });
    expect(finalExpense.paymentStatus).toBe('paid');
  });
});
```

### 数据一致性验证 SQL

```sql
-- 检查采购费用的 supplierId 是否为 null
SELECT
  e.id,
  e.expenseNumber,
  e.expenseAmount,
  e.supplierId,
  e.payableId,
  po.orderNumber,
  po.supplierId AS order_supplierId
FROM ExpenseRecord e
LEFT JOIN PurchaseOrder po ON e.relatedId = po.id
WHERE e.relatedType = 'purchase_order'
  AND e.supplierId IS NULL
ORDER BY e.createdAt DESC
LIMIT 50;

-- 检查应付款金额是否包含费用
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
  AND ABS(pr.payableAmount - (po.totalAmount + COALESCE(po.expenseAmount, 0))) > 0.01
ORDER BY ABS(pr.payableAmount - (po.totalAmount + COALESCE(po.expenseAmount, 0))) DESC;

-- 检查费用与应付款的关联情况
SELECT
  e.expenseNumber,
  e.expenseAmount,
  e.status,
  e.paymentStatus,
  e.payableId,
  pr.payableNumber,
  pr.status AS payable_status,
  pr.payableAmount,
  pr.remainingAmount
FROM ExpenseRecord e
LEFT JOIN PayableRecord pr ON e.payableId = pr.id
WHERE e.relatedType = 'purchase_order'
  AND e.status = 'approved'
ORDER BY e.approvedAt DESC
LIMIT 50;
```

---

## 总结与建议

### 关键问题总结

| #   | 问题描述                    | 严重程度 | Stage 3 兼容性 | 修复优先级 |
| --- | --------------------------- | -------- | -------------- | ---------- |
| 1   | 费用记录缺少 supplierId     | 🔴 严重  | ❌ 阻断        | P0         |
| 2   | 应付款未关联费用记录        | 🔴 严重  | ❌ 阻断        | P0         |
| 3   | 应付款金额不包含费用        | 🔴 严重  | ⚠️ 数据不一致  | P0         |
| 4   | 费用记录缺少 idempotencyKey | 🟡 中等  | ⚠️ 幂等性缺失  | P1         |
| 5   | 费用状态未明确初始化        | 🟡 中等  | ⚠️ 潜在风险    | P1         |
| 6   | 代码重复（违反DRY）         | 🟡 中等  | ⚠️ 维护成本    | P1         |
| 7   | 编号生成不规范              | 🟢 轻微  | ✅ 不影响      | P2         |

### 修复计划建议

#### 阶段 1: P0 修复（1-2 天）

1. ✅ **添加 supplierId 字段**（所有费用创建点）
2. ✅ **应付款关联费用**（费用创建后立即更新 payableId）
3. ✅ **应付款金额包含费用**（修改 ensurePurchaseOrderPayable）
4. ✅ **明确设置 status 和 paymentStatus**

#### 阶段 2: P1 修复（2-3 天）

1. ✅ **添加 idempotencyKey**（防止重复）
2. ✅ **统一费用创建函数**（DRY 原则）
3. ✅ **编写集成测试**（覆盖审批和付款核销场景）

#### 阶段 3: P2 优化（1 天）

1. ✅ **统一编号生成器**（使用规范编号格式）
2. ✅ **补充单元测试**（边界条件、错误处理）

### 预期结果

修复后，采购订单费用链路将完全兼容 Stage 3：

- ✅ 费用审批后自动创建/合并应付款（merge 策略）
- ✅ 应付款金额准确（采购金额 + 费用金额）
- ✅ 费用记录正确关联应付款
- ✅ 付款核销后费用支付状态自动更新（unpaid → partial → paid）
- ✅ 幂等性保证（防止重复创建）
- ✅ 代码质量改善（DRY、统一编号）

---

**审计完成日期**: 2025-11-22
**审计人员**: Claude (AI Assistant)
**下一步行动**: 请确认修复方案并开始实施 P0 修复
