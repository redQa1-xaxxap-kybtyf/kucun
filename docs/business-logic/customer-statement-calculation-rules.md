# 客户对账单计算规则说明

## 📋 业务逻辑概述

客户对账单用于记录与客户之间的完整财务往来，包括销售、收款、退货、退款等所有交易。

## 💰 应收账款计算公式

### 标准公式
```
应收余额 = 销售金额 - 销售退货 - 收款 - 预收款 + 补偿退款
```

### 字段说明

| 项目 | 增减 | 说明 | 数据来源 |
|-----|-----|------|---------|
| 销售金额 | + | 开具销售发票，增加应收 | SalesOrder.totalAmount |
| 销售退货 | - | 客户退货，减少应收 | ReturnOrder.refundAmount |
| 收款 | - | 客户付款，减少应收 | PaymentRecord.paymentAmount |
| 预收款 | - | 客户预付定金，减少应收 | 待实现 |
| 补偿退款 | + | 质量补偿等，增加应收 | RefundRecord.refundAmount (returnOrderId=null) |

### 会计分录示例

#### 场景 1：正常销售流程
```
1. 开具发票 ¥10,000
   借：应收账款 10,000
   贷：销售收入 10,000

2. 客户付款 ¥10,000
   借：银行存款 10,000
   贷：应收账款 10,000

对账单余额：10,000 - 10,000 = 0 ✅
```

#### 场景 2：退货退款流程
```
1. 销售 ¥10,000
   借：应收账款 10,000
   贷：销售收入 10,000

2. 退货 ¥3,000 (开红字发票)
   借：销售收入 3,000
   贷：应收账款 3,000

3. 退款 ¥3,000 (现金流出)
   借：应收账款 3,000
   贷：银行存款 3,000

对账单余额：10,000 - 3,000 = 7,000 ✅
注：退款不再影响应收，因为退货已处理
```

#### 场景 3：质量补偿流程
```
1. 销售 ¥10,000，客户已付款
   应收 = 10,000 - 10,000 = 0

2. 质量补偿 ¥500 (无退货)
   借：应收账款 500
   贷：银行存款 500

对账单余额：10,000 - 10,000 + 500 = 500 ✅
注：补偿后客户又欠我们500
```

## 🔍 退款处理规则

### 退款分类

| 退款类型 | returnOrderId | 对账单处理 | 说明 |
|---------|--------------|----------|------|
| 退货退款 | 有值 | 不计入 | 金额已在退货中统计 |
| 补偿退款 | null | 借方(+) | 质量补偿，增加应收 |
| 折扣退款 | null | 借方(+) | 价格调整，增加应收 |

### 数据验证结果

**当前系统状态：**
- ✅ 总退款记录：32 条
- ✅ 退货关联退款：32 条 (100%)
- ✅ 无退货退款：0 条 (0%)
- ✅ RefundRecord.refundAmount：全部为 0
- ✅ 实际金额存储在：ReturnOrder.refundAmount

**结论：**
- 所有退款都关联退货订单
- 退款金额已在退货中正确统计
- 不存在重复计算问题
- 业务逻辑正确 ✅

## 📊 交易明细借贷规则

### 借贷方向定义

从公司视角（应收账款明细账）：
- **借方** = 增加应收（客户欠我们的）
- **贷方** = 减少应收（客户还我们的 / 我们退给客户的）

### 交易类型对照表

| 交易类型 | 借方 | 贷方 | 数据来源 | 说明 |
|---------|-----|------|---------|------|
| 销售订单 | ✅ totalAmount | - | SalesOrder | 开具发票，增加应收 |
| 销售退货 | - | ✅ refundAmount | ReturnOrder | 红字发票，减少应收 |
| 客户付款 | - | ✅ paymentAmount | PaymentRecord | 收到款项，减少应收 |
| 补偿退款 | ✅ refundAmount | - | RefundRecord (无退货) | 补偿支出，增加应收 |
| 预收款 | - | ✅ amount | PrepaymentRecord | 预收定金，减少应收 |

**特别说明：**
- 退货退款：已在退货记录中体现，不单独记录
- 补偿退款：当前系统无记录，未来实现时按借方处理

## 🔧 代码实现要点

### 1. 汇总计算 (calculateCustomerStatementSummary)

```typescript
// 退款查询：只查询无退货关联的退款
const refunds = await prisma.refundRecord.findMany({
  where: {
    customerId,
    status: 'completed',
    returnOrderId: null,  // ✅ 关键：过滤退货退款
    ...dateFilter,
  },
});

// 当前系统中 refundPaid = 0
const refundPaid = refunds.reduce(
  (sum, refund) => sum + Number(refund.refundAmount),
  0
);

// 余额计算
const receivableBalance =
  salesAmount -          // 销售
  salesReturnAmount -    // 退货（包含退款金额）
  paymentReceived -      // 收款
  prepaymentReceived +   // 预收（待实现）
  refundPaid;            // 补偿退款（当前为0）
```

### 2. 交易明细 (getCustomerTransactions)

```typescript
// 退款记录：只查询无退货关联的退款
const refunds = await prisma.refundRecord.findMany({
  where: {
    customerId,
    status: 'completed',
    returnOrderId: null,  // ✅ 关键：过滤退货退款
    refundDate: dateFilter,
  },
});

// 补偿退款作为借方
for (const refund of refunds) {
  transactionEntries.push({
    transactionType: 'refund_out',
    debitAmount: Number(refund.refundAmount),  // 借方
    creditAmount: 0,
    description: `补偿退款 ${refund.refundNumber}`,
  });
}
// 当前系统中无记录
```

## 🎯 数据完整性保障

### 余额校验公式

```typescript
期末余额 = 期初余额 + 本期净变动
本期净变动 = 本期借方合计 - 本期贷方合计

验证：
期末余额 = 期初余额 + (销售 + 补偿退款) - (退货 + 收款 + 预收)
```

### 逻辑验证检查

- [x] 销售订单只统计已确认状态
- [x] 退货金额使用 ReturnOrder.refundAmount
- [x] 退款过滤 returnOrderId 避免重复
- [x] 收款只统计已确认状态
- [x] 预收款暂为 0（待实现）
- [x] 余额计算公式正确
- [x] 借贷方向符合会计准则

## 📝 未来扩展点

### 1. 预收款功能

**实现要点：**
- 创建 PrepaymentRecord 表
- 记录客户预付定金
- 销售订单时冲抵预收款
- 对账单中作为贷方（减少应收）

### 2. 补偿退款功能

**实现要点：**
- 创建无退货关联的退款记录
- RefundRecord.returnOrderId = null
- 填充 refundAmount 字段
- 对账单中作为借方（增加应收）

### 3. 应付账款功能

**实现要点：**
- 客户同时作为供应商
- 统计采购订单、采购退货
- 统计付款、预付款
- 计算应付余额和净余额

## 📚 相关文档

- [数据验证报告](../analysis/customer-statement-data-validation-report.md)
- [业务逻辑问题分析](../analysis/customer-statement-business-logic-issues.md)
- [预收预付实现文档](../features/customer-statement-prepayment-implementation.md)

## 🔄 更新记录

- 2025-01-10: 完成数据验证，优化退款查询逻辑
- 2025-01-10: 添加详细业务规则说明和会计示例
