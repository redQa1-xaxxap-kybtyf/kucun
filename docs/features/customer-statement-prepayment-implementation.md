# 客户对账单预收款和预付款功能实现文档

## 📋 功能概述

根据行业最佳实践（参考 Microsoft Dynamics 365 标准），客户对账单应包含预收款和预付款的完整记录，以确保财务往来的完整性和准确性。

## ✅ 已完成的工作

### 1. 类型定义更新 (lib/types/customer-statement.ts)

#### 新增交易类型
```typescript
export type CustomerStatementTransactionType =
  | 'sales_order'      // 销售订单(应收)
  | 'sales_return'     // 销售退货(冲减应收)
  | 'payment_in'       // 客户付款
  | 'refund_out'       // 退款给客户
  | 'prepayment_in'    // ✨ 新增：预收款(客户预付定金)
  | 'purchase_order'   // 采购订单(应付)
  | 'purchase_return'  // 采购退货(冲减应付)
  | 'payment_out'      // 我方付款
  | 'refund_in'        // 客户退款给我方
  | 'prepayment_out';  // ✨ 新增：预付款(向客户作为供应商时预付)
```

#### 交易类型配置
```typescript
{
  type: 'prepayment_in',
  label: '预收款',
  description: '客户预付定金',
  isDebit: false,
  category: 'receivable',
},
{
  type: 'prepayment_out',
  label: '预付款',
  description: '向客户(供应商)预付',
  isDebit: true,
  category: 'payable',
}
```

### 2. 汇总数据结构更新

#### 应收账款汇总
```typescript
receivables: {
  salesAmount: number;          // 销售金额
  salesReturnAmount: number;    // 销售退货金额
  paymentReceived: number;      // 已收款
  refundPaid: number;           // 已退款
  prepaymentReceived: number;   // ✨ 新增：预收款
  receivableBalance: number;    // 应收余额 = 销售 - 退货 - 收款 - 预收 + 退款
}
```

#### 应付账款汇总
```typescript
payables: {
  purchaseAmount: number;       // 采购金额
  purchaseReturnAmount: number; // 采购退货金额
  paymentPaid: number;          // 已付款
  refundReceived: number;       // 已收退款
  prepaymentPaid: number;       // ✨ 新增：预付款
  payableBalance: number;       // 应付余额 = 采购 - 退货 - 付款 - 预付 + 退款
}
```

### 3. 后端服务层更新 (lib/services/customer-statement-service.ts)

#### 余额计算公式更新
```typescript
// 应收余额计算（包含预收款）
const receivableBalance =
  salesAmount -
  salesReturnAmount -
  paymentReceived -
  prepaymentReceived +  // 预收款减少应收
  refundPaid;

// 应付余额计算（包含预付款）
const payableBalance =
  purchaseAmount -
  purchaseReturnAmount -
  paymentPaid -
  prepaymentPaid +     // 预付款减少应付
  refundReceived;
```

### 4. 前端展示更新 (app/(dashboard)/finance/customer-statements/[customerId]/page.tsx)

#### 余额卡片增强
- 应收余额卡片：显示预收款金额（如果 > 0）
- 应付余额卡片：显示预付款金额（如果 > 0）
- 交易明细表：自动支持显示预收款和预付款交易

#### UI 示例
```tsx
{summary.receivables.prepaymentReceived > 0 && (
  <p className="text-muted-foreground mt-1 text-xs">
    含预收款：{formatCurrency(summary.receivables.prepaymentReceived)}
  </p>
)}
```

## ⏳ 待实现的工作

### 1. 数据库表结构设计

#### 方案 A：修改现有 PaymentRecord 表
```prisma
model PaymentRecord {
  // ... 现有字段
  paymentType  String @default("PAYMENT") // PAYMENT, PREPAYMENT
  salesOrderId String? @map("sales_order_id") // 改为可选，预收款时为空
}
```

#### 方案 B：创建独立预收款表（推荐）
```prisma
model PrepaymentRecord {
  id               String   @id @default(uuid())
  prepaymentNumber String   @unique
  customerId       String
  amount           Float
  prepaymentDate   DateTime
  status           String   @default("pending") // pending, applied, refunded
  relatedOrderId   String?  // 关联的销售订单ID（冲抵后）
  remarks          String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  customer     Customer     @relation(fields: [customerId], references: [id])
  relatedOrder SalesOrder?  @relation(fields: [relatedOrderId], references: [id])
}
```

### 2. 服务层实现

#### 预收款查询逻辑
```typescript
// 查询未冲抵的预收款
const prepayments = await prisma.prepaymentRecord.findMany({
  where: {
    customerId,
    status: { in: ['pending', 'applied'] },
    prepaymentDate: dateFilter,
  },
});

const prepaymentReceived = prepayments.reduce(
  (sum, p) => sum + Number(p.amount),
  0
);
```

#### 预收款冲抵逻辑
```typescript
// 创建销售订单时自动冲抵预收款
async function applyPrepaymentToOrder(
  orderId: string,
  customerId: string
): Promise<void> {
  const availablePrepayments = await prisma.prepaymentRecord.findMany({
    where: { customerId, status: 'pending' },
    orderBy: { prepaymentDate: 'asc' },
  });

  // 执行冲抵逻辑...
}
```

### 3. 交易明细集成

在 `getCustomerTransactions` 函数中添加：
```typescript
// 5. 获取预收款记录
const prepayments = await prisma.prepaymentRecord.findMany({
  where: {
    customerId,
    prepaymentDate: dateFilter,
  },
  orderBy: { prepaymentDate: 'asc' },
});

for (const prepayment of prepayments) {
  transactionEntries.push({
    id: prepayment.id,
    transactionType: 'prepayment_in',
    transactionDate: prepayment.prepaymentDate.toISOString(),
    referenceNumber: prepayment.prepaymentNumber,
    referenceId: prepayment.id,
    description: `预收款 ${prepayment.prepaymentNumber}`,
    debitAmount: 0,
    creditAmount: Number(prepayment.amount),
    status: prepayment.status,
  });
}
```

## 📊 业务流程

### 预收款业务流程
```mermaid
graph LR
    A[客户预付定金] --> B[创建预收款记录]
    B --> C[记录在对账单-贷方]
    C --> D[创建销售订单]
    D --> E[自动冲抵预收款]
    E --> F[更新预收款状态为已冲抵]
    F --> G[对账单余额自动调整]
```

### 会计分录示例
```
预收款时：
  借：银行存款  3,000
  贷：预收账款  3,000

开具发票时：
  借：应收账款  10,000
  贷：销售收入  10,000

冲抵预收款：
  借：预收账款  3,000
  贷：应收账款  3,000

客户补付款：
  借：银行存款  7,000
  贷：应收账款  7,000
```

## 🎯 验证检查清单

- [x] 类型定义已更新
- [x] 汇总数据结构已扩展
- [x] 服务层框架已搭建（预留 TODO）
- [x] 前端界面已适配
- [x] 交易类型中文标签已配置
- [ ] 数据库表结构待设计
- [ ] 预收款查询逻辑待实现
- [ ] 预收款冲抵逻辑待实现
- [ ] 预付款逻辑待实现
- [ ] 单元测试待编写

## 📝 使用说明

### 当前状态
- ✅ 类型系统已完整支持预收款和预付款
- ✅ 前端界面已适配，当有预收预付数据时会正确显示
- ⏸️ 实际数据查询逻辑暂时返回 0（待数据库表完善后实现）

### 后续开发步骤
1. 设计并创建预收款/预付款数据库表
2. 实现预收款和预付款的 CRUD 接口
3. 在服务层实现实际的数据查询逻辑
4. 实现预收款与订单的冲抵逻辑
5. 添加预收款管理界面（可选）
6. 编写单元测试和集成测试

## 🔗 相关文档
- Microsoft Dynamics 365 预收款管理: https://learn.microsoft.com/en-us/dynamics365/finance/accounts-receivable/customer-prepayments
- 会计准则参考：预收账款属于负债类科目
- 对账单设计规范：lib/types/customer-statement.ts

## 📅 更新记录
- 2025-10-10: 完成类型定义、服务层框架和前端适配
- 待定: 数据库表设计和实际逻辑实现
