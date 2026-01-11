# 厂家发货订单费用明细功能实施文档

## 🎯 功能概述

在厂家发货订单详情页面添加费用明细展示功能，清晰展示订单相关的各项费用，并区分客户承担和公司承担的费用。

## ✅ 已完成的工作

### 1. 类型定义

**文件**: `lib/types/factory-shipment.ts`

**新增类型**:

```typescript
// 厂家发货订单费用项
export interface FactoryShipmentOrderFeeItem {
  id: string;
  factoryShipmentOrderId: string;
  feeType: FactoryShipmentFeeType;
  feeName: string;
  feeAmount: number;
  paidBy: 'customer' | 'company';
  remarks?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// 费用类型
export type FactoryShipmentFeeType =
  | 'freight' // 运费
  | 'processing' // 加工费
  | 'packaging' // 包装费
  | 'loading_unloading' // 装卸费
  | 'storage' // 仓储费
  | 'customs' // 报关费
  | 'other'; // 其他费用

// 费用类型标签
export const FACTORY_SHIPMENT_FEE_TYPE_LABELS: Record<
  FactoryShipmentFeeType,
  string
> = {
  freight: '运费',
  processing: '加工费',
  packaging: '包装费',
  loading_unloading: '装卸费',
  storage: '仓储费',
  customs: '报关费',
  other: '其他费用',
};
```

**更新类型**:

```typescript
export interface FactoryShipmentOrder {
  // ... 其他字段
  feeItems?: FactoryShipmentOrderFeeItem[]; // ✅ 新增费用项字段
}
```

### 2. API 修改

**文件**: `app/api/factory-shipments/[id]/route.ts`

**修改内容**: 在 GET 接口的 `include` 中添加 `feeItems: true`

```typescript
const order = await prisma.factoryShipmentOrder.findUnique({
  where: { id },
  include: {
    customer: { ... },
    user: { ... },
    items: { ... },
    feeItems: true, // ✅ 包含费用项
  },
});
```

### 3. 费用明细组件

**文件**: `components/factory-shipments/fee-items-section.tsx`

**功能特性**:

1. **空状态处理**
   - 无费用时显示"暂无费用"提示

2. **费用明细表格**
   - 序号
   - 费用类型（中文显示）
   - 费用名称
   - 费用金额（右对齐，保留2位小数）
   - 承担方（Badge 标识）
   - 备注

3. **视觉区分**
   - 客户承担：蓝色 Badge（`variant="default"`）
   - 公司承担：灰色 Badge（`variant="secondary"`）

4. **费用汇总**
   - 客户承担费用总额（蓝色）
   - 公司承担费用总额（灰色）
   - 费用总计（主题色）

5. **响应式设计**
   - 表格支持横向滚动
   - 汇总区域在移动端自动换行

### 4. 集成到订单详情页

**文件**: `components/factory-shipments/factory-shipment-order-detail.tsx`

**位置**: 客户信息卡片和金额信息卡片之间

**设计理由**: 将费用明细放在金额信息之前，用户可以先看到费用明细，再看到基于这些费用计算出的金额汇总，逻辑更清晰，避免遗漏费用信息。

```typescript
{/* 客户信息 */}
<Card>...</Card>

{/* 费用明细 */}
<FeeItemsSection feeItems={order.feeItems} />

{/* 金额信息 */}
<Card>...</Card>

{/* 产品明细 */}
<Card>...</Card>
```

## 📊 UI 设计

### 费用明细卡片结构

```
┌─────────────────────────────────────────────────────┐
│ 💰 费用明细                              共 3 项    │
├─────────────────────────────────────────────────────┤
│ 序号 │ 费用类型 │ 费用名称 │ 金额 │ 承担方 │ 备注 │
├─────────────────────────────────────────────────────┤
│  1   │ 运费     │ 海运费   │ 500  │ 客户   │ -    │
│  2   │ 加工费   │ 切割费   │ 200  │ 客户   │ -    │
│  3   │ 包装费   │ 木箱包装 │ 300  │ 公司   │ -    │
├─────────────────────────────────────────────────────┤
│ 客户承担费用: ¥700.00                               │
│ 公司承担费用: ¥300.00                               │
│ 费用总计:     ¥1,000.00                             │
└─────────────────────────────────────────────────────┘
```

### 颜色方案

- **客户承担**: 蓝色（`text-blue-600`）
- **公司承担**: 灰色（`text-gray-600`）
- **费用总计**: 主题色（`text-[hsl(var(--color-primary))]`）

## 🧪 测试指南

### 测试场景

#### 场景 1: 无费用订单

**预期结果**:

- 显示"暂无费用"提示
- 卡片样式正常

#### 场景 2: 只有客户承担费用

**测试数据**:

```json
{
  "feeItems": [
    {
      "feeType": "freight",
      "feeName": "海运费",
      "feeAmount": 500,
      "paidBy": "customer"
    }
  ]
}
```

**预期结果**:

- 客户承担费用: ¥500.00（蓝色）
- 公司承担费用: ¥0.00（灰色）
- 费用总计: ¥500.00

#### 场景 3: 混合费用

**测试数据**:

```json
{
  "feeItems": [
    {
      "feeType": "freight",
      "feeName": "海运费",
      "feeAmount": 500,
      "paidBy": "customer"
    },
    {
      "feeType": "packaging",
      "feeName": "木箱包装",
      "feeAmount": 300,
      "paidBy": "company"
    }
  ]
}
```

**预期结果**:

- 客户承担费用: ¥500.00（蓝色）
- 公司承担费用: ¥300.00（灰色）
- 费用总计: ¥800.00

### 验收清单

- [x] ✅ 费用明细卡片正确显示
- [x] ✅ 费用类型中文显示正确
- [x] ✅ 客户承担和公司承担的费用有明显区分（Badge 颜色）
- [x] ✅ 费用汇总计算正确
- [x] ✅ 无费用时显示友好提示
- [x] ✅ 金额格式正确（保留2位小数，千分位分隔）
- [x] ✅ 表格支持横向滚动（移动端）
- [x] ✅ 通过 TypeScript 类型检查
- [x] ✅ 通过 ESLint 检查
- [x] ✅ 响应式布局正常

## 📝 使用说明

### 查看费用明细

1. 进入厂家发货订单详情页面
2. 在"金额信息"卡片下方查看"费用明细"卡片
3. 查看各项费用的详细信息
4. 查看底部的费用汇总统计

### 费用承担方说明

- **客户承担**: 这部分费用会计入应收金额
- **公司承担**: 这部分费用不计入应收金额，由公司自行承担

## 🔗 相关文档

- [应收金额计算修复总结](./receivable-amount-fix-summary.md)
- [应收金额问题分析](./receivable-amount-analysis.md)

---

**实施日期**: 2025-01-13
**实施者**: Augment Agent
**状态**: ✅ 已完成并可用
