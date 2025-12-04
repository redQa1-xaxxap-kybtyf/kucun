/**
 * PurchaseOrderPrintContent - 采购订单打印内容组件（重构版）
 *
 * 重构说明：
 * - 使用统一的打印工具函数（lib/utils/print-helpers.ts）
 * - 使用通用打印组件（components/print/common）
 * - 消除重复代码，提高可维护性
 *
 * 功能：
 * - 支持DIY样式配置
 * - 支持字段选择
 * - 保留原有数据处理逻辑
 *
 * 设计原则：
 * - DRY：复用工具函数和组件
 * - KISS：简化代码逻辑
 * - 单一职责：仅负责渲染采购订单打印内容
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
import { purchaseOrderPrintConfig } from '@/lib/config/print-fields/purchase-order-fields';
import type { FieldSelection } from '@/lib/types/print-config';
import type { PrintStyleConfig } from '@/lib/types/print-style';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';
import {
  numberToChinese,
  calculateTotalWeight,
  calculateTotalQuantity,
} from '@/lib/utils/print-helpers';

import type { PurchaseOrderDetailData } from './purchase-order-detail.types';

/**
 * 组件属性
 */
export interface PurchaseOrderPrintContentProps {
  /**
   * 订单数据
   */
  order: PurchaseOrderDetailData;

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
 * PurchaseOrderPrintContent 组件（重构版）
 *
 * @example
 * ```tsx
 * <PurchaseOrderPrintContent
 *   order={order}
 *   styleConfig={styleConfig}
 *   fieldSelection={fieldSelection}
 * />
 * ```
 */
export function PurchaseOrderPrintContent({
  order,
  styleConfig,
  fieldSelection,
}: PurchaseOrderPrintContentProps) {
  // 计算汇总数据
  const summaryData = useMemo(() => {
    const items = order.items ?? [];

    return {
      totalQuantity: calculateTotalQuantity(items),
      totalAmount: order.totalAmount ?? 0,
      totalWeight: calculateTotalWeight(items),
      totalAmountChinese: numberToChinese(order.totalAmount ?? 0),
    };
  }, [order.items, order.totalAmount]);

  // 准备表头数据
  const headerData = useMemo(
    () => ({
      orderNumber: order.orderNumber,
      containerNumber: order.containerNumber || '-',
      status: order.status,
      orderDate: order.orderDate,
      shipmentDate: order.shipmentDate,
      estimatedArrival: order.estimatedArrival,
      arrivalDate: order.arrivalDate,
      shippingCompany: order.shippingCompany || '-',
      createdAt: order.createdAt,
      remarks: order.remarks || '-',
    }),
    [order]
  );

  // 行数据映射函数
  const rowDataMapper = (item: PurchaseOrderDetailData['items'][number]) => {
    // 数量格式化（保留业务逻辑）
    const qty = Math.floor(item.quantity ?? 0);
    const ppu = item.piecesPerUnit || item.product?.piecesPerUnit || 0;
    const quantityFormatted =
      ppu > 0
        ? formatPieceSummary(qty, ppu, { fallbackUnit: '片' })
        : `${qty}片`;

    return {
      productCode: item.productCode || '-',
      productName: item.isManualProduct
        ? item.manualProductName || '-'
        : item.product?.name || item.displayName || '-',
      specification: item.specification || item.product?.specification || '-',
      unit: item.unit || item.product?.unit || '-',
      quantity: quantityFormatted,
      piecesPerUnit: item.piecesPerUnit || item.product?.piecesPerUnit || '-',
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      remarks: item.remarks || '',
      batchNumber: item.batchNumber || '-',
      weight: item.manualWeight ?? item.weight ?? 0,
      supplierName: item.supplier?.name || '-',
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
      <PrintHeader settings={styleConfig.header} subtitle="采购订单" />

      {/* 订单信息区 */}
      <PrintInfoSection
        settings={styleConfig.infoSection}
        printConfig={purchaseOrderPrintConfig}
        selectedFields={fieldSelection.headerKeys}
        data={headerData}
      />

      {/* 订单明细表格 */}
      <PrintTable
        settings={styleConfig.table}
        printConfig={purchaseOrderPrintConfig}
        selectedColumns={fieldSelection.itemKeys}
        data={order.items ?? []}
        rowDataMapper={rowDataMapper}
      />

      {/* 汇总区 */}
      <PrintSummary
        settings={styleConfig.summary}
        printConfig={purchaseOrderPrintConfig}
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
