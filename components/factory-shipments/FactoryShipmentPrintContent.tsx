/**
 * FactoryShipmentPrintContent - 厂家发货单打印内容组件（重构版）
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
 * - 单一职责：仅负责渲染厂家发货单打印内容
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
import { factoryShipmentPrintConfig } from '@/lib/config/print-fields/factory-shipment-fields';
import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';
import type { FieldSelection } from '@/lib/types/print-config';
import type { PrintStyleConfig } from '@/lib/types/print-style';
import {
  numberToChinese,
  calculateTotalWeight,
  calculateTotalQuantity,
} from '@/lib/utils/print-helpers';

/**
 * 组件属性
 */
export interface FactoryShipmentPrintContentProps {
  /**
   * 订单数据
   */
  order: FactoryShipmentOrder;

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
 * FactoryShipmentPrintContent 组件（重构版）
 *
 * @example
 * ```tsx
 * <FactoryShipmentPrintContent
 *   order={order}
 *   styleConfig={styleConfig}
 *   fieldSelection={fieldSelection}
 * />
 * ```
 */
export function FactoryShipmentPrintContent({
  order,
  styleConfig,
  fieldSelection,
}: FactoryShipmentPrintContentProps) {
  // 计算汇总数据
  const summaryData = useMemo(() => {
    const items = order.items ?? [];
    const totalQuantity = calculateTotalQuantity(items);

    const customerOwnedAmount =
      order.fulfillmentSummary?.customerOwnedAmount ??
      items
        .filter(item => item.ownership === 'customer')
        .reduce((sum, item) => sum + item.totalPrice, 0);

    const selfOwnedAmount =
      order.fulfillmentSummary?.selfOwnedAmount ??
      items
        .filter(item => item.ownership === 'self')
        .reduce((sum, item) => sum + item.totalPrice, 0);

    const totalAmount = order.totalAmount ?? 0;
    const totalWeight = calculateTotalWeight(items);
    const totalAmountChinese = numberToChinese(totalAmount);
    const costAmount = order.costAmount ?? 0;
    const expenseAmount = order.expenseAmount ?? 0;
    const profitAmount = order.profitAmount ?? 0;

    return {
      totalQuantity,
      customerOwnedAmount,
      selfOwnedAmount,
      totalAmount,
      totalWeight,
      totalAmountChinese,
      costAmount,
      expenseAmount,
      profitAmount,
    };
  }, [
    order.items,
    order.totalAmount,
    order.fulfillmentSummary,
    order.costAmount,
    order.expenseAmount,
    order.profitAmount,
  ]);

  // 准备表头数据
  const headerData = useMemo(
    () => ({
      orderNumber: order.orderNumber,
      containerNumber: order.containerNumber,
      customerName: order.customer?.name || '未知客户',
      customerPhone: order.customer?.phone || '-',
      customerAddress: order.customer?.address || '-',
      status: order.status,
      shipmentDate: order.shipmentDate,
      estimatedArrival: order.estimatedArrival,
      arrivalDate: order.arrivalDate,
      deliveryDate: order.deliveryDate,
      shippingCompany: order.shippingCompany || '-',
      createdAt: order.createdAt,
      remarks: order.remarks || '-',
    }),
    [order]
  );

  // 行数据映射函数
  const rowDataMapper = (item: FactoryShipmentOrder['items'][number]) => ({
    productCode: item.productCode || '-',
    productName: item.isManualProduct
      ? item.manualProductName || '-'
      : item.product?.name || item.displayName || '-',
    specification: item.specification || item.product?.specification || '-',
    unit: item.unit || item.product?.unit || '-',
    quantity: item.quantity,
    piecesPerUnit: item.piecesPerUnit || '-',
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    ownership: item.ownership,
    remarks: item.remarks || '',
    batchNumber: item.batchNumber || '-',
    weight: item.manualWeight ?? item.weight ?? 0,
    supplierName: item.supplier?.name || '-',
    unitCost: item.unitCost ?? 0,
    allocatedExpense: item.allocatedExpense ?? 0,
    profitAmount: item.profitAmount ?? 0,
    profitMargin: item.profitMargin ?? 0,
  });

  return (
    <PrintLayout
      size={styleConfig.page.size}
      orientation={styleConfig.page.orientation}
      margin={styleConfig.page.margin}
      borderColor={styleConfig.page.borderColor}
      borderWidth={styleConfig.page.borderWidth}
    >
      {/* 表头 */}
      <PrintHeader settings={styleConfig.header} subtitle="厂家发货单" />

      {/* 订单信息区 */}
      <PrintInfoSection
        settings={styleConfig.infoSection}
        printConfig={factoryShipmentPrintConfig}
        selectedFields={fieldSelection.headerKeys}
        data={headerData}
      />

      {/* 订单明细表格 */}
      <PrintTable
        settings={styleConfig.table}
        printConfig={factoryShipmentPrintConfig}
        selectedColumns={fieldSelection.itemKeys}
        data={order.items ?? []}
        rowDataMapper={rowDataMapper}
      />

      {/* 汇总区 */}
      <PrintSummary
        settings={styleConfig.summary}
        printConfig={factoryShipmentPrintConfig}
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
