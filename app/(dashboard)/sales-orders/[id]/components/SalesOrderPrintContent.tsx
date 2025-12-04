/**
 * SalesOrderPrintContent - 销售订单打印内容组件（重构版）
 *
 * 重构说明：
 * - 使用统一的打印工具函数（lib/utils/print-helpers.ts）
 * - 使用通用打印组件（components/print/common）
 * - 消除重复代码，提高可维护性
 *
 * 功能：
 * - 支持DIY样式配置
 * - 支持字段选择
 * - 保持原有数据处理逻辑
 *
 * 设计原则：
 * - DRY：复用工具函数和组件
 * - KISS：简化代码逻辑
 * - 单一职责：仅负责渲染销售订单打印内容
 */

'use client';

import React, { useMemo } from 'react';

import {
  PrintHeader,
  PrintInfoSection,
  PrintTable,
  PrintSummary,
  PrintSignature,
  PrintFooter,
} from '@/components/print/common';
import { PrintLayout } from '@/components/print/PrintLayout';
import { salesOrderPrintConfig } from '@/lib/config/print-fields/sales-order-fields';
import type { FieldSelection } from '@/lib/types/print-config';
import type { PrintStyleConfig } from '@/lib/types/print-style';
import {
  numberToChinese,
  calculateTotalWeight,
  calculateTotalQuantity,
  calculateTotalAmount,
} from '@/lib/utils/print-helpers';

import type { SalesOrderDetail } from './types';

/**
 * 组件属性
 */
export interface SalesOrderPrintContentProps {
  /**
   * 订单数据
   */
  order: SalesOrderDetail;

  /**
   * 样式配置
   */
  styleConfig: PrintStyleConfig;

  /**
   * 字段选择
   */
  fieldSelection: FieldSelection;
}

/**
 * SalesOrderPrintContent 组件（重构版）
 *
 * @example
 * ```tsx
 * <SalesOrderPrintContent
 *   order={order}
 *   styleConfig={styleConfig}
 *   fieldSelection={fieldSelection}
 * />
 * ```
 */
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
  const headerData = useMemo(
    () => ({
      orderNumber: order.orderNumber,
      customerName: order.customer?.name || '未知客户',
      customerPhone: order.customer?.phone || '-',
      customerAddress: order.customer?.address || '-',
      shippingAddress:
        order.shippingAddress ?? order.customer?.address ?? '逐鹿',
      transferMode: order.transferMode || '-',
      createdAt: order.createdAt,
      status: order.status,
      remarks: order.remarks || '-',
    }),
    [order]
  );

  // 行数据映射函数
  const rowDataMapper = (item: SalesOrderDetail['items'][number]) => {
    // 显示单位与数量（优先使用销售员录入的显示单位/数量）
    const displayUnit = item.displayUnit || item.product?.unit || '-';
    const piecesPerUnit =
      item.piecesPerUnit ?? item.product?.piecesPerUnit ?? 0;
    const quantityDisplay =
      typeof item.displayQuantity === 'number' && item.displayQuantity > 0
        ? item.displayQuantity
        : item.quantity;

    // 打印单价：与详情页/Excel 导出一致
    // - 按件销售：单价 = 行小计 ÷ 件数（如果可用），否则用 片价 × 每件片数近似
    // - 其他情况：直接使用片单价
    let displayUnitPrice = item.unitPrice;
    if (displayUnit === '件') {
      const units =
        typeof item.displayQuantity === 'number' && item.displayQuantity > 0
          ? item.displayQuantity
          : piecesPerUnit > 0 && item.quantity
            ? item.quantity / piecesPerUnit
            : undefined;

      if (units && item.subtotal) {
        const perUnit = item.subtotal / units;
        if (Number.isFinite(perUnit)) {
          displayUnitPrice = perUnit;
        }
      } else if (piecesPerUnit > 0 && item.unitPrice) {
        displayUnitPrice = item.unitPrice * piecesPerUnit;
      }
    }

    return {
      productCode: item.isManualProduct
        ? item.productCode || '-'
        : item.product?.code || '-',
      productName: item.isManualProduct
        ? item.manualProductName || '-'
        : item.product?.name || '-',
      specification: item.specification || item.product?.specification || '-',
      unit: displayUnit,
      quantity: quantityDisplay,
      piecesPerUnit: item.piecesPerUnit || item.product?.piecesPerUnit || '-',
      unitPrice: displayUnitPrice,
      subtotal: item.subtotal,
      remarks: item.remarks || '',
      batchNumber: item.batchNumber || '-',
      weight: item.manualWeight ?? item.product?.weight ?? 0,
    };
  };

  return (
    <PrintLayout
      size={styleConfig.page.size}
      orientation={styleConfig.page.orientation}
      margin={styleConfig.page.margin}
      borderColor={styleConfig.page.borderColor}
      borderWidth={styleConfig.page.borderWidth}
    >
      {/* 表头 */}
      <PrintHeader
        settings={styleConfig.header}
        subtitle="销售订单"
        orderNumber={order.orderNumber}
      />

      {/* 订单信息区 */}
      <PrintInfoSection
        settings={styleConfig.infoSection}
        printConfig={salesOrderPrintConfig}
        selectedFields={fieldSelection.headerKeys}
        data={headerData}
      />

      {/* 订单明细表格 */}
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
