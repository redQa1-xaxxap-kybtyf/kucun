# 预收款/预付款业务流程设计(修订版)

## 🔄 设计原则修正

### ❌ 错误设计(之前的实现)

- 独立的预收款/预付款表
- 手动创建预收款记录
- 手动冲抵到订单

### ✅ 正确设计(业务流程驱动)

- **复用现有 PaymentRecord 表**
- **业务流程自动触发**
- **自动关联和冲抵**

## 📊 数据库设计修正

### PaymentRecord 表扩展

```prisma
model PaymentRecord {
  id            String   @id
  paymentNumber String   @unique
  salesOrderId  String?  // ✅ 改为可选,预收款时为null
  customerId    String
  userId        String

  // ✨ 新增字段
  paymentType   String   @default("order_payment")  // order_payment | prepayment
  appliedAmount Float    @default(0)                // 已冲抵金额

  paymentMethod String   @default("cash")
  paymentAmount Float
  paymentDate   DateTime
  status        String   @default("pending")        // pending | confirmed | applied
  remarks       String?
  receiptNumber String?
  bankInfo      String?
}
```

**paymentType 枚举:**

- `order_payment`: 订单收款(salesOrderId必填)
- `prepayment`: 预收款(salesOrderId为null)

**status 状态流转:**

- `pending`: 待确认
- `confirmed`: 已确认
- `applied`: 已冲抵(仅预收款)

## 🔄 业务流程

### 场景 1: 客户预付定金

#### 步骤 1: 客户付款(无订单)

```typescript
// POST /api/payments
{
  customerId: "xxx",
  paymentType: "prepayment",    // ✅ 预收款类型
  paymentAmount: 5000,
  paymentMethod: "bank_transfer",
  paymentDate: "2025-01-10"
}

// 自动生成:
// paymentNumber: "SK-20250110-0001"
// salesOrderId: null
// appliedAmount: 0
// status: "pending"
```

#### 步骤 2: 创建销售订单并自动冲抵

```typescript
// POST /api/sales-orders
{
  customerId: "xxx",
  items: [...],
  totalAmount: 10000,
  usePrepayment: true  // ✅ 标记使用预收款
}

// 后端自动处理:
1. 查询客户未冲抵的预收款
   SELECT * FROM payment_records
   WHERE customerId = 'xxx'
   AND paymentType = 'prepayment'
   AND (paymentAmount - appliedAmount) > 0
   ORDER BY paymentDate ASC

2. 自动冲抵预收款
   UPDATE payment_records
   SET appliedAmount = appliedAmount + 5000,
       status = 'applied'
   WHERE id = 'prepayment-id'

3. 更新订单已付金额
   UPDATE sales_orders
   SET paidAmount = 5000
   WHERE id = 'order-id'
```

#### 结果:

- 预收款: ￥5000 (全部冲抵)
- 订单应付: ￥10,000
- 订单已付: ￥5,000
- 订单欠款: ￥5,000

### 场景 2: 订单后付款(现有流程)

```typescript
// 1. 创建订单
POST /api/sales-orders
{
  customerId: "xxx",
  totalAmount: 10000
}

// 2. 客户付款
POST /api/payments
{
  salesOrderId: "order-id",      // ✅ 有订单ID
  paymentType: "order_payment",   // ✅ 订单付款
  customerId: "xxx",
  paymentAmount: 10000
}
```

## 🎯 客户对账单计算

### 修正后的查询逻辑

```typescript
// 1. 查询销售金额(不变)
const salesAmount = sum(SalesOrder, 'totalAmount');

// 2. 查询收款金额
const payments = await prisma.paymentRecord.findMany({
  where: {
    customerId,
    status: 'confirmed',
    paymentType: { in: ['order_payment', 'prepayment'] }, // ✅ 包含所有类型
    paymentDate: dateFilter,
  },
});

// 3. 分类统计
const orderPayment = payments
  .filter(p => p.paymentType === 'order_payment')
  .reduce((sum, p) => sum + p.paymentAmount, 0);

const prepaymentApplied = payments
  .filter(p => p.paymentType === 'prepayment')
  .reduce((sum, p) => sum + p.appliedAmount, 0); // ✅ 使用已冲抵金额

// 4. 计算应收余额
receivableBalance =
  salesAmount - // 销售金额
  salesReturnAmount - // 退货金额
  orderPayment - // 订单付款
  prepaymentApplied + // 预收款冲抵
  refundPaid; // 补偿退款
```

### 交易明细显示

```typescript
// 预收款交易(收款时)
{
  transactionType: 'prepayment_in',
  description: '预收款 SK-20250110-0001',
  debitAmount: 0,
  creditAmount: 5000,  // 贷方:减少应收
}

// 预收款冲抵(订单确认时)
{
  transactionType: 'prepayment_applied',
  description: '预收款冲抵订单 SO-20250111-0001',
  debitAmount: 0,
  creditAmount: -5000,  // 抵消之前的预收款记录
}

// 或者简化:只在冲抵时显示
{
  transactionType: 'payment_in',
  description: '预收款冲抵 SK-20250110-0001',
  debitAmount: 0,
  creditAmount: 5000,
}
```

## 🔧 API 修改

### 1. 收款 API 扩展

```typescript
// POST /api/payments
interface PaymentCreateInput {
  salesOrderId?: string; // 可选,预收款时为空
  customerId: string;
  paymentType: 'order_payment' | 'prepayment';
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: Date;
  remarks?: string;
}

// 验证逻辑
if (paymentType === 'order_payment' && !salesOrderId) {
  throw new Error('订单付款必须指定订单ID');
}
if (paymentType === 'prepayment' && salesOrderId) {
  throw new Error('预收款不应关联订单');
}
```

### 2. 销售订单 API 扩展

```typescript
// POST /api/sales-orders
interface SalesOrderCreateInput {
  customerId: string;
  items: OrderItem[];
  usePrepayment?: boolean; // ✅ 是否使用预收款
  prepaymentAmount?: number; // ✅ 指定冲抵金额(可选)
}

// 自动冲抵逻辑
async function applyPrepayment(customerId: string, orderTotal: number) {
  const prepayments = await prisma.paymentRecord.findMany({
    where: {
      customerId,
      paymentType: 'prepayment',
      status: 'confirmed',
      // 剩余可用金额 > 0
      appliedAmount: { lt: prisma.paymentRecord.fields.paymentAmount },
    },
    orderBy: { paymentDate: 'asc' }, // FIFO策略
  });

  let remainingAmount = orderTotal;
  const appliedRecords = [];

  for (const prepayment of prepayments) {
    if (remainingAmount <= 0) break;

    const available = prepayment.paymentAmount - prepayment.appliedAmount;
    const applyAmount = Math.min(available, remainingAmount);

    await prisma.paymentRecord.update({
      where: { id: prepayment.id },
      data: {
        appliedAmount: { increment: applyAmount },
        status:
          prepayment.appliedAmount + applyAmount === prepayment.paymentAmount
            ? 'applied'
            : 'confirmed',
      },
    });

    appliedRecords.push({ id: prepayment.id, amount: applyAmount });
    remainingAmount -= applyAmount;
  }

  return {
    totalApplied: orderTotal - remainingAmount,
    records: appliedRecords,
  };
}
```

## 📊 UI 交互流程

### 创建销售订单页面

```tsx
<SalesOrderForm>
  {/* 基本信息 */}
  <CustomerSelect />
  <OrderItems />

  {/* 预收款面板 */}
  {availablePrepayments > 0 && (
    <PrepaymentPanel>
      <Checkbox checked={usePrepayment} onChange={setUsePrepayment}>
        使用预收款冲抵 (可用: ￥{availablePrepayments})
      </Checkbox>

      {usePrepayment && (
        <Input
          type="number"
          label="冲抵金额"
          max={Math.min(availablePrepayments, orderTotal)}
          value={prepaymentAmount}
        />
      )}

      <PrepaymentList>
        {prepaymentRecords.map(p => (
          <PrepaymentItem key={p.id}>
            <span>{p.paymentNumber}</span>
            <span>可用: ￥{p.paymentAmount - p.appliedAmount}</span>
            <span>{formatDate(p.paymentDate)}</span>
          </PrepaymentItem>
        ))}
      </PrepaymentList>
    </PrepaymentPanel>
  )}

  {/* 金额汇总 */}
  <OrderSummary>
    <div>订单总额: ￥{orderTotal}</div>
    <div>预收款抵扣: -￥{prepaymentAmount}</div>
    <div>应付金额: ￥{orderTotal - prepaymentAmount}</div>
  </OrderSummary>
</SalesOrderForm>
```

### 收款页面

```tsx
<PaymentForm>
  <CustomerSelect />

  {/* 收款类型 */}
  <RadioGroup value={paymentType}>
    <Radio value="order_payment">订单收款</Radio>
    <Radio value="prepayment">预收款(定金)</Radio>
  </RadioGroup>

  {/* 条件字段 */}
  {paymentType === 'order_payment' && (
    <SalesOrderSelect customerId={customerId} required />
  )}

  <AmountInput />
  <PaymentMethodSelect />
  <DatePicker />
</PaymentForm>
```

## ✅ 优势总结

### KISS 原则(简单至上)

- ✅ 复用现有表,无需新建表
- ✅ 业务流程自然,符合直觉
- ✅ 减少数据冗余

### YAGNI 原则(精益求精)

- ✅ 只扩展必要字段(paymentType, appliedAmount)
- ✅ 无过度设计的独立表结构

### SOLID 原则

- ✅ SRP: PaymentRecord 单一职责(收款管理)
- ✅ OCP: 通过 paymentType 扩展,无需修改现有逻辑
- ✅ DIP: API 层抽象业务逻辑

### DRY 原则

- ✅ 收款逻辑统一在 PaymentRecord
- ✅ 无需重复的冲抵逻辑

## 🔄 迁移策略

### 数据库变更

```sql
-- 1. 添加新字段
ALTER TABLE payment_records
ADD COLUMN payment_type VARCHAR(20) DEFAULT 'order_payment';

ALTER TABLE payment_records
ADD COLUMN applied_amount DECIMAL(10,2) DEFAULT 0;

-- 2. 修改 salesOrderId 为可选
ALTER TABLE payment_records
MODIFY COLUMN sales_order_id VARCHAR(36) NULL;

-- 3. 添加索引
CREATE INDEX idx_payment_records_type ON payment_records(payment_type);
CREATE INDEX idx_payment_records_customer_type_status
  ON payment_records(customer_id, payment_type, status);
```

### 代码迁移

1. 删除独立的预收款/预付款 API
2. 扩展现有 PaymentRecord API
3. 在 SalesOrder 创建流程中添加预收款冲抵逻辑
4. 更新客户对账单查询逻辑

## 📝 后续任务清单

- [ ] 删除独立预收款/预付款表和API
- [ ] 扩展 PaymentRecord 表结构
- [ ] 修改收款 API 支持预收款类型
- [ ] 实现销售订单自动冲抵逻辑
- [ ] 更新客户对账单服务层
- [ ] 创建预收款管理UI
- [ ] 测试完整业务流程
- [ ] 更新用户文档

## 🔗 相关文档

- [客户对账单计算规则](../business-logic/customer-statement-calculation-rules.md)
- [收款管理业务流程](./payment-management-process.md)
- [销售订单业务流程](./sales-order-process.md)
