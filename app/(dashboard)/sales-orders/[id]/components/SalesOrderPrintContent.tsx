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
  calculateTotalAmount,
} from '@/lib/utils/print-helpers';
import {
  getSalesOrderDisplayUnitPrice,
  getSalesOrderItemQuantityText,
  getSalesOrderItemWeightKg,
  getSalesOrderNormalizedDisplayUnit,
  getSalesOrderTotalQuantitySummary,
  getSalesOrderTotalWeightKg,
} from '@/lib/utils/sales-order-display';

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
      totalQuantity: getSalesOrderTotalQuantitySummary(items),
      totalAmount: calculateTotalAmount(items),
      totalWeight: getSalesOrderTotalWeightKg(items) / 1000,
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
    const displayUnit = getSalesOrderNormalizedDisplayUnit(item);
    const piecesPerUnit =
      item.piecesPerUnit ?? item.batchPiecesPerUnit ?? item.product?.piecesPerUnit ?? '-';
    const quantityDisplay = getSalesOrderItemQuantityText(item);
    const displayUnitPrice = getSalesOrderDisplayUnitPrice(item);
    const itemWeightKg = getSalesOrderItemWeightKg(item);

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
      piecesPerUnit,
      unitPrice: displayUnitPrice,
      subtotal: item.subtotal,
      remarks: item.remarks || '',
      batchNumber: item.batchNumber || '-',
      weight: itemWeightKg,
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
