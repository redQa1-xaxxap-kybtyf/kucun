import { logger } from '@/lib/logger';
import { generatePurchaseOrderNumber } from '@/lib/services/simple-order-number-generator';

import type { CreateInput, Tx } from './types';

/**
 * 为客户直发销售订单自动创建采购订单
 *
 * 触发条件:
 * - orderType === 'TRANSFER'
 * - transferMode === 'SUPPLIER_ONLY'
 * - status === 'confirmed'
 * - supplierId 存在
 * - costAmount > 0
 *
 * @param tx - Prisma 事务对象
 * @param salesOrderData - 销售订单创建数据
 * @param salesOrder - 已创建的销售订单信息
 * @param userId - 创建人ID
 */
export async function createPurchaseOrderForTransfer(
  tx: Tx,
  salesOrderData: CreateInput,
  salesOrder: { id: string; orderNumber: string },
  userId: string
): Promise<void> {
  // 1. 验证必要条件
  if (!salesOrderData.supplierId) {
    logger.warn('sales-orders', '客户直发订单缺少供应商ID，跳过采购订单创建', {
      salesOrderId: salesOrder.id,
      salesOrderNumber: salesOrder.orderNumber,
    });
    return;
  }

  const costAmount = salesOrderData.costAmount ?? 0;
  if (costAmount <= 0) {
    logger.warn('sales-orders', '客户直发订单成本金额为0，跳过采购订单创建', {
      salesOrderId: salesOrder.id,
      salesOrderNumber: salesOrder.orderNumber,
      costAmount,
    });
    return;
  }

  // 2. 生成采购订单号
  const orderNumber = await generatePurchaseOrderNumber();

  // 3. 构建采购订单明细
  const defaultSupplierId = salesOrderData.supplierId;
  const items = salesOrderData.items.map(item => {
    const quantity = item.quantity ?? 0;
    const unitCost = item.unitCost ?? 0;
    const totalPrice = quantity * unitCost;

    // 确定产品名称
    const displayName = item.isManualProduct
      ? item.manualProductName || ''
      : item.productCode || '';

    // 确定单位
    const unit = item.isManualProduct
      ? item.manualUnit || 'sheet'
      : item.displayUnit || 'sheet';

    return {
      productId: item.productId,
      supplierId: defaultSupplierId || '',
      productCode: item.productCode || '',
      displayName,
      specification: item.specification || item.manualSpecification,
      unit,
      weight: item.manualWeight,
      piecesPerUnit: item.piecesPerUnit,
      quantity,
      unitPrice: unitCost,
      totalPrice,
      batchNumber: item.batchNumber,
      isManualProduct: item.isManualProduct,
      manualProductName: item.manualProductName,
      manualSpecification: item.manualSpecification,
      manualWeight: item.manualWeight,
      manualUnit: item.manualUnit,
      remarks: `关联销售订单: ${salesOrder.orderNumber}`,
    };
  });

  // 4. 获取客户信息（用于备注）
  const customer = await tx.customer.findUnique({
    where: { id: salesOrderData.customerId },
    select: { name: true },
  });

  const customerName = customer?.name || salesOrderData.customerId;

  // 5. 创建采购订单
  await tx.purchaseOrder.create({
    data: {
      orderNumber,
      supplierId: salesOrderData.supplierId,
      userId,
      status: 'confirmed',
      totalAmount: costAmount,
      orderDate: new Date(),
      remarks: [
        '客户直发订单自动生成',
        `关联销售订单: ${salesOrder.orderNumber}`,
        `销售订单ID: ${salesOrder.id}`,
        `客户: ${customerName}`,
      ].join('\n'),
      // TODO: 数据库迁移完成后启用此字段
      // salesOrderId: salesOrder.id,
      items: {
        create: items,
      },
    },
  });

  logger.info('sales-orders', '客户直发采购订单创建成功', {
    salesOrderId: salesOrder.id,
    salesOrderNumber: salesOrder.orderNumber,
    purchaseOrderNumber: orderNumber,
    supplierId: salesOrderData.supplierId,
    totalAmount: costAmount,
    itemCount: items.length,
  });
}
