# 客户对账单API 500错误修复指南

## 问题描述

访问 `GET /api/finance/customer-statements` 时出现 500 Internal Server Error

**错误位置**: `E:\kucun\lib\api\customer-statements.ts:77`

## 根本原因

**Prisma Client未更新**: 数据库schema已经添加了新字段(`payment_type`, `applied_amount`),但运行中的开发服务器使用的是旧的Prisma Client,导致查询时访问不存在的字段。

### 验证结果

✅ 数据库已有新字段:
- `payment_type` (TEXT)
- `applied_amount` (REAL)

❌ Prisma Client未重新生成:
- 服务器锁定了 `query_engine-windows.dll.node` 文件
- 无法更新Prisma Client

## 解决方案

### 步骤1: 停止开发服务器

在运行 `npm run dev` 的终端中按 `Ctrl+C` 停止服务器

### 步骤2: 重新生成Prisma Client

```bash
npx prisma generate
```

**预期输出**:
```
✔ Generated Prisma Client to ./node_modules/@prisma/client
```

### 步骤3: 重启开发服务器

```bash
npm run dev
```

### 步骤4: 验证修复

访问: `http://localhost:3000/api/finance/customer-statements?page=1&pageSize=20`

**预期响应**:
```json
{
  "success": true,
  "data": {
    "statements": [...],
    "pagination": {...}
  }
}
```

## 技术细节

### 修改的文件

**`lib/services/customer-statement-service.ts`**
- 第314-341行: 更新收款记录查询逻辑
- 使用 `paymentType` 字段区分订单付款和预收款
- 使用 `appliedAmount` 字段计算预收款已冲抵金额

**旧代码** (错误):
```typescript
// ❌ 使用废弃的 prepaymentReceived 表
const prepayments = await prisma.prepaymentReceived.findMany({...});
```

**新代码** (正确):
```typescript
// ✅ 使用 PaymentRecord 表的 paymentType 和 appliedAmount 字段
const payments = await prisma.paymentRecord.findMany({
  select: {
    paymentType: true,
    paymentAmount: true,
    appliedAmount: true,
  }
});

const prepayments = payments.filter(p => p.paymentType === 'prepayment');
const prepaymentReceived = prepayments.reduce(
  (sum, p) => sum + Number(p.appliedAmount),
  0
);
```

### 应收账款计算公式

```
应收余额 = 销售金额 - 退货金额 - 订单付款 - 预收款冲抵 + 补偿退款
```

**字段映射**:
- `salesAmount`: 销售订单总额
- `salesReturnAmount`: 退货订单退款额
- `paymentReceived`: `payment_type='order_payment'` 的付款金额
- `prepaymentReceived`: `payment_type='prepayment'` 的已冲抵金额(`applied_amount`)
- `refundPaid`: 无退货关联的补偿退款

## 预防措施

### 开发流程规范

1. **Schema变更后必须重新生成**:
   ```bash
   npx prisma db push      # 推送schema到数据库
   npx prisma generate     # 重新生成Prisma Client
   ```

2. **服务器重启**:
   - Schema变更后必须重启开发服务器
   - 否则会使用旧的Prisma Client导致运行时错误

3. **CI/CD检查**:
   - 添加检查确保Prisma Client是最新的
   - 部署前自动运行 `prisma generate`

### 相关文档

- [预收款业务流程设计](../features/prepayment-business-process.md)
- [预收款设计修正总结](../features/prepayment-correction-summary.md)
- [客户对账单计算规则](../business-logic/customer-statement-calculation-rules.md)

## 总结

✅ **根本原因**: Prisma Client未更新,无法识别新字段
✅ **解决方案**: 重新生成Prisma Client并重启服务器
✅ **预防措施**: 建立Schema变更后的标准操作流程
