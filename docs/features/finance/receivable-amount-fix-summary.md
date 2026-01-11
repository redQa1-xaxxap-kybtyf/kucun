# 厂家发货应收金额计算修复总结

## 🎯 修复目标

修复厂家发货订单应收金额计算逻辑，确保客户承担的费用（如运费）正确计入应收金额。

## 🔍 问题诊断

### 原始问题

**用户发现**: 厂家发货的应收金额未包含运费等客户承担的费用。

**错误逻辑**:

```typescript
应收金额 = 客户货总金额 - 定金;
```

**正确逻辑**:

```typescript
应收金额 = 客户货总金额 + 客户承担的费用 - 定金;
```

### 影响范围

1. **应收金额偏低** - 少算了客户承担的费用
2. **利润计算不准确** - 应收金额错误导致利润偏低
3. **应收账款记录不完整** - 生成的应收记录金额不正确
4. **财务报表数据偏差** - 影响应收账款统计和利润分析

## ✅ 已完成的修复

### 1. 修复创建订单的应收金额计算

**文件**: `app/api/factory-shipments/route.ts`

**修改位置**: 第 666-675 行

**修改内容**:

```typescript
// ✅ 修复：计算客户承担的费用总额
const customerFees = (feeItems || [])
  .filter(fee => fee.paidBy === 'customer')
  .reduce((sum, fee) => sum + fee.feeAmount, 0);

// ✅ 修复：应收金额 = 客户货总金额 + 客户承担的费用 - 定金
const finalReceivableAmount = Math.max(
  0,
  customerAmount + customerFees - finalDepositAmount
);
```

### 2. 修复更新订单的应收金额计算

**文件**: `app/api/factory-shipments/[id]/route.ts`

**修改位置**: 第 178-241 行

**修改内容**:

```typescript
function buildUpdateData(
  validatedData: UpdateFactoryShipmentOrderData,
  calculatedTotalAmount?: number,
  existingDepositAmount?: number // ✅ 新增参数
): Partial<Prisma.FactoryShipmentOrderUncheckedUpdateInput> {
  // ...
  if (items) {
    data.items = { create: items.map(mapItemCreate) };
    // ✅ 修复：如果未显式提供 receivableAmount，自动计算
    if (receivableAmount === undefined) {
      const summary = computeAmountSummary(items);
      const customerAmount = summary ? summary.customer : 0;

      // 计算客户承担的费用总额
      const customerFees = (feeItems || [])
        .filter(fee => fee.paidBy === 'customer')
        .reduce((sum, fee) => sum + fee.feeAmount, 0);

      // 使用更新后的定金或现有定金
      const finalDepositAmount =
        depositAmount !== undefined
          ? depositAmount
          : existingDepositAmount || 0;

      // 应收金额 = 客户货总金额 + 客户承担的费用 - 定金
      data.receivableAmount = Math.max(
        0,
        customerAmount + customerFees - finalDepositAmount
      );
    }
  }
  return data;
}
```

**调用处修改**: 第 423 行

```typescript
data: buildUpdateData(
  validatedData,
  calculatedTotalAmount,
  existingOrder.depositAmount  // ✅ 传入现有定金
),
```

### 3. 修复类型定义

**文件**: `app/api/factory-shipments/[id]/route.ts`

**修改位置**: 第 79-89 行

**修改内容**:

```typescript
async function validateEntities({
  items,
  customerId,
}: {
  items?: Array<{
    isManualProduct?: boolean;
    productId?: string | null;
    supplierId?: string;  // ✅ 改为可选
  }>;
  customerId?: string;
}) {
```

## 🧪 测试验证

### 测试1: 应收金额计算测试

**测试文件**: `scripts/test-receivable-calculation.ts`

**测试结果**: ✅ 6/6 通过

**测试场景**:

1. ✅ 基础场景：只有客户货，无费用，无定金
2. ✅ 客户货 + 客户承担运费 - 定金
3. ✅ 客户货 + 公司承担运费 - 定金
4. ✅ 客户货 + 自有货 + 客户承担运费
5. ✅ 多个费用项（部分客户承担，部分公司承担）
6. ✅ 定金大于客户货金额（应收为0）

### 测试2: 利润计算测试

**测试文件**: `scripts/test-profit-calculation.ts`

**测试结果**: ✅ 5/5 通过

**关键对比**:

- **正确场景**: 应收 10,500 元（含 500 运费）→ 利润 4,000 元，利润率 38.1%
- **错误场景**: 应收 10,000 元（不含运费）→ 利润 3,500 元，利润率 35% ❌

## 📊 修复效果

### 修复前

```
客户货: 10,000 元
运费（客户承担）: 500 元
定金: 2,000 元

应收金额 = 10,000 - 2,000 = 8,000 元 ❌
利润 = 8,000 - 6,000 - 500 = 1,500 元 ❌
利润率 = 1,500 / 8,000 = 18.75% ❌
```

### 修复后

```
客户货: 10,000 元
运费（客户承担）: 500 元
定金: 2,000 元

应收金额 = 10,000 + 500 - 2,000 = 8,500 元 ✅
利润 = 8,500 - 6,000 - 500 = 2,000 元 ✅
利润率 = 2,000 / 8,500 = 23.53% ✅
```

**改进**:

- 应收金额增加 500 元（+6.25%）
- 利润增加 500 元（+33.3%）
- 利润率提高 4.78 个百分点

## 📋 后续工作

### 优先级 P1（本周完成）

- [ ] **数据迁移**: 重新计算已有订单的应收金额
- [ ] **应收记录更新**: 更新已生成的应收账款记录
- [ ] **手动测试**: 创建测试订单验证功能

### 优先级 P2（下周完成）

- [ ] **UI 优化**: 在订单详情页显示费用明细
- [ ] **文档更新**: 更新用户手册和操作指南
- [ ] **培训**: 通知用户新的计算逻辑

## 🔧 技术细节

### 修改的文件

1. **`app/api/factory-shipments/route.ts`**
   - 第 666-675 行：创建订单时计算应收金额

2. **`app/api/factory-shipments/[id]/route.ts`**
   - 第 178-241 行：`buildUpdateData` 函数
   - 第 423 行：调用 `buildUpdateData` 时传入现有定金
   - 第 79-89 行：修复 `validateEntities` 类型定义

### 测试文件

1. **`scripts/test-receivable-calculation.ts`**
   - 应收金额计算测试（6个测试用例）

2. **`scripts/test-profit-calculation.ts`**
   - 利润计算测试（5个测试用例）

### 文档文件

1. **`docs/receivable-amount-analysis.md`**
   - 问题分析文档

2. **`docs/receivable-amount-fix-summary.md`**
   - 修复总结文档（本文档）

## ⚠️ 注意事项

### 1. 费用项的 `paidBy` 字段

确保在创建/编辑订单时，正确设置费用项的 `paidBy` 字段：

- `customer`: 客户承担（计入应收）
- `company`: 公司承担（不计入应收）

### 2. 定金的处理

- 创建订单时：使用用户输入的定金
- 更新订单时：如果未提供新定金，使用现有定金

### 3. 应收账款记录

创建订单时，如果状态不是草稿或已取消，会自动生成应收账款记录。
应收金额 = 客户货总金额 + 客户承担的费用 - 定金

### 4. 利润计算

利润计算服务 (`lib/services/factory-shipment-profit-service.ts`) 使用订单的 `receivableAmount` 字段。
确保该字段已正确计算后再调用利润计算服务。

## 🎉 总结

✅ **问题确认**: 应收金额计算确实存在问题
✅ **根因分析**: 未包含客户承担的费用
✅ **修复完成**: 创建和更新订单的应收金额计算已修复
✅ **测试通过**: 所有测试用例通过
✅ **代码质量**: 通过 TypeScript 类型检查

**核心改进**:

```typescript
应收金额 = 客户货总金额 + 客户承担的费用 - 定金;
```

---

**修复日期**: 2025-01-13
**修复者**: Augment Agent
**状态**: ✅ 已完成并测试通过
