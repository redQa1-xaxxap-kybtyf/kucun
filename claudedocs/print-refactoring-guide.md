# 打印功能重构指南

## 📋 概述

本文档介绍重构后的统一打印架构，提供可复用的工具函数和组件，消除代码重复，提升开发效率。

## 🎯 设计目标

1. **消除重复**：提取公共逻辑，避免在多个文件中重复实现
2. **统一规范**：所有业务模块使用相同的打印架构
3. **易于维护**：组件化设计，修改一处即可影响全局
4. **类型安全**：完整的 TypeScript 类型定义
5. **性能优化**：使用 React.memo 等优化手段

## 📦 核心组件

### 1. 打印工具库

**位置**：`lib/utils/print-helpers.ts`

提供打印相关的通用工具函数：

```typescript
import {
  numberToChinese, // 数字转中文大写
  formatCurrency, // 格式化货币
  formatPrintDate, // 格式化日期
  formatFooterContent, // 格式化页脚
  calculateTotalWeight, // 计算总重量
  calculateTotalAmount, // 计算总金额
  safeGet, // 安全获取属性
} from '@/lib/utils/print-helpers';
```

### 2. 通用打印组件

**位置**：`components/print/common/`

提供可复用的打印组件：

```typescript
import {
  PrintHeader, // 标准表头
  PrintInfoSection, // 信息区
  PrintTable, // 明细表格
  PrintSummary, // 汇总区
  PrintSignature, // 签名区
  PrintFooter, // 页脚
} from '@/components/print/common';
```

## 🚀 快速开始

### 示例：创建销售订单打印组件（重构版）

```typescript
'use client';

import React, { useMemo } from 'react';
import { PrintLayout } from '@/components/print/PrintLayout';
import {
  PrintHeader,
  PrintInfoSection,
  PrintTable,
  PrintSummary,
  PrintFooter,
} from '@/components/print/common';
import {
  numberToChinese,
  calculateTotalWeight,
  calculateTotalAmount,
  calculateTotalQuantity,
} from '@/lib/utils/print-helpers';
import { salesOrderPrintConfig } from '@/lib/config/print-fields/sales-order-fields';

export interface SalesOrderPrintContentProps {
  order: SalesOrderDetail;
  styleConfig: PrintStyleConfig;
  fieldSelection: FieldSelection;
}

export function SalesOrderPrintContent({
  order,
  styleConfig,
  fieldSelection,
}: SalesOrderPrintContentProps) {
  // 计算汇总数据
  const summaryData = useMemo(() => {
    const items = order.items ?? [];
    return {
      totalQuantity: calculateTotalQuantity(items),
      totalAmount: calculateTotalAmount(items),
      totalWeight: calculateTotalWeight(items),
      totalAmountChinese: numberToChinese(calculateTotalAmount(items)),
    };
  }, [order.items]);

  // 准备表头数据
  const headerData = {
    orderNumber: order.orderNumber,
    customerName: order.customer?.name || '未知客户',
    customerPhone: order.customer?.phone || '-',
    customerAddress: order.customer?.address || '-',
    shippingAddress: order.shippingAddress || '-',
    createdAt: order.createdAt,
    status: order.status,
    remarks: order.remarks || '-',
  };

  // 行数据映射
  const rowDataMapper = (item: SalesOrderItem) => ({
    productCode: item.product?.code || '-',
    productName: item.product?.name || '-',
    specification: item.specification || '-',
    unit: item.unit || '-',
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.subtotal,
    remarks: item.remarks || '',
  });

  return (
    <PrintLayout
      size={styleConfig.page.size}
      orientation={styleConfig.page.orientation}
      margin={styleConfig.page.margin}
    >
      {/* 表头 */}
      <PrintHeader
        settings={styleConfig.header}
        subtitle="销售订单"
      />

      {/* 订单信息 */}
      <PrintInfoSection
        settings={styleConfig.infoSection}
        printConfig={salesOrderPrintConfig}
        selectedFields={fieldSelection.headerKeys}
        data={headerData}
      />

      {/* 明细表格 */}
      <PrintTable
        settings={styleConfig.table}
        printConfig={salesOrderPrintConfig}
        selectedColumns={fieldSelection.itemKeys}
        data={order.items ?? []}
        rowDataMapper={rowDataMapper}
      />

      {/* 汇总区 */}
      <PrintSummary
        settings={styleConfig.summary}
        printConfig={salesOrderPrintConfig}
        selectedFields={fieldSelection.summaryKeys}
        data={summaryData}
      />

      {/* 签名区 */}
      <PrintSignature settings={styleConfig.signature} />

      {/* 页脚 */}
      <PrintFooter settings={styleConfig.footer} />
    </PrintLayout>
  );
}
```

## 📖 组件详细说明

### PrintHeader

渲染统一的打印表头。

**属性**：

- `settings` - 表头样式配置
- `subtitle` - 副标题（可选，覆盖配置中的副标题）

**示例**：

```tsx
<PrintHeader settings={styleConfig.header} subtitle="销售订单" />
```

### PrintInfoSection

渲染信息区，支持单列/双列/三列布局。

**属性**：

- `settings` - 信息区样式配置
- `printConfig` - 打印字段配置
- `selectedFields` - 要显示的字段 key 列表
- `data` - 数据对象

**示例**：

```tsx
<PrintInfoSection
  settings={styleConfig.infoSection}
  printConfig={salesOrderPrintConfig}
  selectedFields={['orderNumber', 'customerName', 'createdAt']}
  data={{
    orderNumber: 'SO-2025-001',
    customerName: '张三',
    createdAt: new Date(),
  }}
/>
```

### PrintTable

渲染明细表格，支持泛型数据类型。

**属性**：

- `settings` - 表格样式配置
- `printConfig` - 打印字段配置
- `selectedColumns` - 要显示的列字段 key 列表
- `data` - 表格数据数组
- `rowDataMapper` - 行数据转换函数

**示例**：

```tsx
<PrintTable
  settings={styleConfig.table}
  printConfig={salesOrderPrintConfig}
  selectedColumns={['productCode', 'productName', 'quantity']}
  data={order.items}
  rowDataMapper={item => ({
    productCode: item.product?.code || '-',
    productName: item.product?.name || '-',
    quantity: item.quantity,
  })}
/>
```

### PrintSummary

渲染汇总区，支持高亮总计。

**属性**：

- `settings` - 汇总区样式配置
- `printConfig` - 打印字段配置
- `selectedFields` - 要显示的汇总字段 key 列表
- `data` - 汇总数据对象

**示例**：

```tsx
<PrintSummary
  settings={styleConfig.summary}
  printConfig={salesOrderPrintConfig}
  selectedFields={['totalQuantity', 'totalAmount']}
  data={{
    totalQuantity: 100,
    totalAmount: 12345.67,
  }}
/>
```

### PrintSignature

渲染签名区。

**属性**：

- `settings` - 签名区样式配置

**示例**：

```tsx
<PrintSignature settings={styleConfig.signature} />
```

### PrintFooter

渲染页脚，支持模板变量替换。

**属性**：

- `settings` - 页脚样式配置
- `pageNumber` - 当前页码（可选，默认 1）
- `totalPages` - 总页数（可选，默认 1）

**示例**：

```tsx
<PrintFooter settings={styleConfig.footer} pageNumber={1} totalPages={1} />
```

## 🛠️ 工具函数使用

### numberToChinese

将数字转换为中文大写金额。

```typescript
import { numberToChinese } from '@/lib/utils/print-helpers';

numberToChinese(123.45); // '壹佰贰拾叁元肆角伍分'
numberToChinese(10000); // '壹万元整'
numberToChinese(0); // '零元整'
```

### formatCurrency

格式化货币。

```typescript
import { formatCurrency } from '@/lib/utils/print-helpers';

formatCurrency(1234.5); // '¥1,234.50'
formatCurrency(1234.5, '$'); // '$1,234.50'
formatCurrency(1234.567, '¥', 3); // '¥1,234.567'
```

### formatPrintDate

格式化日期。

```typescript
import { formatPrintDate } from '@/lib/utils/print-helpers';

formatPrintDate(new Date('2025-01-15')); // '2025年01月15日'
formatPrintDate('2025-01-15', 'short'); // '2025-01-15'
formatPrintDate(new Date('2025-01-15'), 'time'); // '2025-01-15 14:30:00'
```

### calculateTotalWeight

计算总重量（转换为吨）。

```typescript
import { calculateTotalWeight } from '@/lib/utils/print-helpers';

const items = [
  { weight: 100, quantity: 10 }, // 100kg × 10 = 1000kg
  { weight: 50, quantity: 5 }, // 50kg × 5 = 250kg
];
calculateTotalWeight(items); // 1.25 (吨)
```

### calculateTotalAmount

计算总金额。

```typescript
import { calculateTotalAmount } from '@/lib/utils/print-helpers';

const items = [{ subtotal: 100.5 }, { subtotal: 200.75 }];
calculateTotalAmount(items); // 301.25
```

## ✅ 最佳实践

### 1. 使用 useMemo 缓存计算结果

```typescript
const summaryData = useMemo(() => {
  const items = order.items ?? [];
  return {
    totalQuantity: calculateTotalQuantity(items),
    totalAmount: calculateTotalAmount(items),
    totalWeight: calculateTotalWeight(items),
    totalAmountChinese: numberToChinese(calculateTotalAmount(items)),
  };
}, [order.items]);
```

### 2. 统一数据映射函数

```typescript
const rowDataMapper = (item: OrderItem) => ({
  productCode: item.product?.code || '-',
  productName: item.product?.name || '-',
  quantity: item.quantity,
  unitPrice: item.unitPrice,
});
```

### 3. 使用字段配置驱动

```typescript
// 创建字段配置
export const orderPrintConfig: PrintConfig = {
  documentType: 'order',
  title: '订单',
  fields: [
    {
      key: 'orderNumber',
      label: '订单编号',
      type: 'header',
      defaultVisible: true,
      required: true,
    },
    // ... 更多字段
  ],
  headerFields: [...],
  itemFields: [...],
  summaryFields: [...],
};
```

### 4. 复用 PrintPreviewDialog

```typescript
import { PrintPreviewDialog } from '@/components/print/PrintPreviewDialog';

<PrintPreviewDialog
  open={isPrintDialogOpen}
  onClose={() => setIsPrintDialogOpen(false)}
  documentType="sales-order"
  printConfig={salesOrderPrintConfig}
  renderContent={(styleConfig, fieldSelection) => (
    <SalesOrderPrintContent
      order={order}
      styleConfig={styleConfig}
      fieldSelection={fieldSelection}
    />
  )}
/>
```

## 🔄 迁移现有组件

### 步骤

1. **导入新的工具和组件**

```typescript
import {
  PrintHeader,
  PrintInfoSection,
  PrintTable,
  PrintSummary,
  PrintFooter,
} from '@/components/print/common';
import {
  numberToChinese,
  calculateTotalWeight,
  calculateTotalAmount,
} from '@/lib/utils/print-helpers';
```

2. **���除重复的工具函数**

删除组件内的 `numberToChinese`、`calculateTotalWeight` 等函数定义。

3. **替换渲染逻辑**

将手动编写的 JSX 替换为通用组件：

```typescript
// 旧代码
<div className="print-header" style={{...}}>
  <h1>{companyName}</h1>
  <h2>{subtitle}</h2>
</div>

// 新代码
<PrintHeader settings={styleConfig.header} subtitle="销售订单" />
```

4. **测试验证**

确保打印效果与之前一致。

## 📚 相关文档

- [打印技术栈文档](./print-tech-stack.md) - 技术栈选型和最佳实践
- [打印样式配置](../lib/types/print-style.ts) - 样式类型定义
- [打印字段配置](../lib/types/print-config.ts) - 字段类型定义

## 🎯 下一步计划

- [ ] 重构现有的打印组件（SalesOrder, FactoryShipment, PurchaseOrder）
- [ ] 为新业务模块添加打印功能（退货订单、库存记录、财务报表）
- [ ] 编写单元测试
- [ ] 性能优化

---

**维护者**：技术团队
**最后更新**：2025-01-15
