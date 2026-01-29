/**
 * 打印设计器 - 加载真实订单数据用于预览
 */

'use server';

import { PRODUCT_UNIT_LABELS } from '@/lib/config/product';
import { prisma } from '@/lib/db';

import type { TemplateType } from '../schemas';

import { getAuthUser } from './auth';

function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

function resolveUnitLabel(unit: string | null | undefined): string {
  if (!unit) return '';
  return (PRODUCT_UNIT_LABELS as Record<string, string>)[unit] ?? unit;
}

function todayYmd(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * 获取销售订单数据用于打印预览
 */
export async function getSalesOrderForPrint(orderId: string) {
  const user = await getAuthUser();
  if (!user) return null;

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      user: { select: { name: true } },
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) return null;

  const items = order.items;

  // 转换为打印模板需要的格式
  const mappedItems = items.map(item => {
    const name = item.product?.name ?? item.manualProductName ?? '';
    const code = item.product?.code ?? item.productCode ?? '';
    const spec =
      item.specification ??
      item.manualSpecification ??
      item.product?.specification ??
      '';
    const unit = resolveUnitLabel(
      item.displayUnit ?? item.manualUnit ?? item.product?.unit ?? 'sheet'
    );

    return {
      // 推荐通用字段（新模板优先使用）
      name,
      code,
      spec,
      unit,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
      batchNumber: item.batchNumber ?? '',
      remark: item.remarks ?? '',

      // 兼容字段（旧模板仍可用）
      productName: name,
      productCode: code,
      specification: spec,

      // 其他补充信息（可选）
      weight: Number(item.manualWeight ?? 0),
      boxes: 0,
    };
  });

  return {
    order: {
      orderNumber: order.orderNumber,
      createdAt: formatDate(order.createdAt),
      status: order.status,
      remark: order.remarks ?? '',
      deliveryDate: '',
    },
    customer: {
      name: order.customer?.name ?? '',
      phone: order.customer?.phone ?? '',
      address: order.customer?.address ?? '',
      contact: '', // Customer 模型没有 contactName
    },
    items: mappedItems,
    totalAmount: Number(order.totalAmount),
    totalAmountCap: Number(order.totalAmount),
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    totalWeight: items.reduce((sum, i) => sum + Number(i.manualWeight ?? 0), 0),
    totalBoxes: 0,
    operator: {
      name: order.user?.name ?? '',
    },
    printDate: todayYmd(),
    company: {
      name: '天津豪星陶瓷有限公司', // TODO: 从系统配置获取
      phone: '',
      address: '',
      fax: '',
    },
  };
}

/**
 * 获取采购订单数据用于打印预览
 */
export async function getPurchaseOrderForPrint(orderId: string) {
  const user = await getAuthUser();
  if (!user) return null;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    include: {
      supplier: true,
      user: { select: { name: true } },
      items: {
        include: {
          product: true,
          supplier: true,
        },
      },
    },
  });

  if (!order) return null;

  const mappedItems = order.items.map(item => {
    const name =
      item.displayName ?? item.product?.name ?? item.manualProductName ?? '';
    const code = item.productCode ?? item.product?.code ?? '';
    const spec =
      item.specification ??
      item.manualSpecification ??
      item.product?.specification ??
      '';
    const unit = resolveUnitLabel(
      item.manualUnit ?? item.unit ?? item.product?.unit ?? 'sheet'
    );

    return {
      name,
      code,
      spec,
      unit,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.totalPrice),
      batchNumber: item.batchNumber ?? '',
      supplierName: item.supplier?.name ?? order.supplier?.name ?? '',
      remark: item.remarks ?? '',

      productName: name,
      productCode: code,
      specification: spec,
    };
  });

  return {
    order: {
      orderNumber: order.orderNumber,
      createdAt: formatDate(order.createdAt),
      status: order.status,
      containerNumber: order.containerNumber ?? '',
      shippingCompany: order.shippingCompany ?? '',
      shipmentDate: formatDate(order.shipmentDate),
      estimatedArrival: formatDate(order.estimatedArrival),
      arrivalDate: formatDate(order.arrivalDate),
      remark: order.remarks ?? '',
    },
    supplier: {
      name: order.supplier?.name ?? '',
      phone: order.supplier?.phone ?? '',
      address: order.supplier?.address ?? '',
      supplierCode: order.supplier?.supplierCode ?? '',
    },
    items: mappedItems,
    totalAmount: Number(order.totalAmount),
    totalQuantity: order.items.reduce((sum, i) => sum + i.quantity, 0),
    operator: {
      name: order.user?.name ?? '',
    },
    printDate: todayYmd(),
    company: {
      name: '天津豪星陶瓷有限公司', // TODO: 从系统配置获取
      phone: '',
      address: '',
      fax: '',
    },
  };
}

/**
 * 获取厂家发货订单数据用于打印预览
 */
export async function getFactoryShipmentForPrint(orderId: string) {
  const user = await getAuthUser();
  if (!user) return null;

  const order = await prisma.factoryShipmentOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      user: { select: { name: true } },
      items: {
        include: {
          product: true,
          supplier: true,
        },
      },
    },
  });

  if (!order) return null;

  const mappedItems = order.items.map(item => {
    const name =
      item.displayName ?? item.product?.name ?? item.manualProductName ?? '';
    const code = item.productCode ?? item.product?.code ?? '';
    const spec =
      item.specification ??
      item.manualSpecification ??
      item.product?.specification ??
      '';
    const unit = resolveUnitLabel(
      item.manualUnit ?? item.unit ?? item.product?.unit ?? 'sheet'
    );

    return {
      name,
      code,
      spec,
      unit,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.totalPrice),
      batchNumber: item.batchNumber ?? '',
      supplierName: item.supplier?.name ?? '',
      remark: item.remarks ?? '',

      productName: name,
      productCode: code,
      specification: spec,
    };
  });

  return {
    order: {
      orderNumber: order.orderNumber,
      createdAt: formatDate(order.createdAt),
      status: order.status,
      containerNumber: order.containerNumber ?? '',
      shippingCompany: order.shippingCompany ?? '',
      shipmentDate: formatDate(order.shipmentDate),
      estimatedArrival: formatDate(order.estimatedArrival),
      arrivalDate: formatDate(order.arrivalDate),
      deliveryDate: formatDate(order.deliveryDate),
      remark: order.remarks ?? '',
    },
    customer: {
      name: order.customer?.name ?? '',
      phone: order.customer?.phone ?? '',
      address: order.customer?.address ?? '',
      contact: '',
    },
    items: mappedItems,
    totalAmount: Number(order.totalAmount),
    totalQuantity: order.items.reduce((sum, i) => sum + i.quantity, 0),
    operator: {
      name: order.user?.name ?? '',
    },
    printDate: todayYmd(),
    company: {
      name: '天津豪星陶瓷有限公司', // TODO: 从系统配置获取
      phone: '',
      address: '',
      fax: '',
    },
  };
}

/**
 * 获取入库记录数据用于打印预览
 *
 * 注意：入库详情路由使用 recordNumber，这里也以 recordNumber 查询。
 */
export async function getInboundRecordForPrint(recordNumber: string) {
  const user = await getAuthUser();
  if (!user) return null;

  const record = await prisma.inboundRecord.findUnique({
    where: { recordNumber },
    include: {
      product: true,
      variant: true,
      batchSpecification: true,
      supplier: true,
      user: { select: { name: true } },
    },
  });

  if (!record) return null;

  const code = record.product?.code ?? '';
  const name = record.product?.name ?? '';
  const spec = record.product?.specification ?? '';
  const unit = resolveUnitLabel(record.product?.unit ?? 'sheet') || '片';
  const batchNumber =
    record.batchNumber ?? record.batchSpecification?.batchNumber ?? '';

  const itemRow = {
    name,
    code,
    spec,
    unit,
    quantity: record.quantity,
    batchNumber,
    supplierName: record.supplier?.name ?? '',
    remark: record.remarks ?? '',

    productName: name,
    productCode: code,
    specification: spec,
  };

  return {
    order: {
      orderNumber: record.recordNumber,
      createdAt: formatDate(record.createdAt),
      reason: record.reason,
      location: record.location ?? '',
      remark: record.remarks ?? '',
    },
    supplier: {
      name: record.supplier?.name ?? '',
      phone: record.supplier?.phone ?? '',
      address: record.supplier?.address ?? '',
    },
    product: {
      code,
      name,
      spec,
      unit,
      batchNumber,
    },
    quantity: record.quantity,
    items: [itemRow],
    operator: {
      name: record.user?.name ?? '',
    },
    printDate: todayYmd(),
    company: {
      name: '天津豪星陶瓷有限公司', // TODO: 从系统配置获取
      phone: '',
      address: '',
      fax: '',
    },
  };
}

/**
 * 获取退货订单数据用于打印预览
 */
export async function getReturnOrderForPrint(orderId: string) {
  const user = await getAuthUser();
  if (!user) return null;

  const order = await prisma.returnOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      user: { select: { name: true } },
      salesOrder: { select: { orderNumber: true } },
      items: {
        include: {
          product: true,
          salesOrderItem: true,
        },
      },
    },
  });

  if (!order) return null;

  const mappedItems = order.items.map(item => {
    const name = item.product?.name ?? '';
    const code = item.product?.code ?? '';
    const spec = item.product?.specification ?? '';
    const unit = resolveUnitLabel(
      item.salesOrderItem?.displayUnit ??
        item.salesOrderItem?.manualUnit ??
        item.product?.unit ??
        'sheet'
    );
    const batchNumber = item.salesOrderItem?.batchNumber ?? '';

    return {
      name,
      code,
      spec,
      unit,

      quantity: item.returnQuantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
      batchNumber,
      remark: item.reason ?? '',

      returnQuantity: item.returnQuantity,
      damagedQuantity: item.damagedQuantity,
      originalQuantity: item.originalQuantity,
      reason: item.reason ?? '',

      productName: name,
      productCode: code,
      specification: spec,
    };
  });

  return {
    order: {
      orderNumber: order.returnNumber,
      createdAt: formatDate(order.createdAt),
      status: order.status,
      type: order.type,
      processType: order.processType,
      reason: order.reason ?? '',
      remark: order.remarks ?? '',
    },
    customer: {
      name: order.customer?.name ?? '',
      phone: order.customer?.phone ?? '',
      address: order.customer?.address ?? '',
    },
    salesOrder: {
      orderNumber: order.salesOrder?.orderNumber ?? '',
    },
    items: mappedItems,
    totalAmount: Number(order.totalAmount),
    refundAmount: Number(order.refundAmount),
    operator: {
      name: order.user?.name ?? '',
    },
    printDate: todayYmd(),
    company: {
      name: '天津豪星陶瓷有限公司', // TODO: 从系统配置获取
      phone: '',
      address: '',
      fax: '',
    },
  };
}

/**
 * 统一入口：根据模板类型 + 单据 id 获取打印数据
 *
 * - sales-order / purchase-order / factory-shipment / return-order: documentId = 数据库 id
 * - inbound-record: documentId = recordNumber
 */
export async function getPrintDataForTemplate(
  templateType: TemplateType,
  documentId: string
) {
  switch (templateType) {
    case 'sales-order':
      return getSalesOrderForPrint(documentId);
    case 'purchase-order':
      return getPurchaseOrderForPrint(documentId);
    case 'factory-shipment':
      return getFactoryShipmentForPrint(documentId);
    case 'inbound-record':
      return getInboundRecordForPrint(documentId);
    case 'return-order':
      return getReturnOrderForPrint(documentId);
    default:
      return null;
  }
}

/**
 * 获取销售订单列表 (用于选择预览哪个订单)
 */
export async function getRecentSalesOrders(limit = 10) {
  const user = await getAuthUser();
  if (!user) return [];

  const orders = await prisma.salesOrder.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      customerId: true,
    },
  });

  // 获取客户名称
  const customerIds = orders.map(o => o.customerId).filter(Boolean) as string[];
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true },
  });
  const customerMap = new Map(customers.map(c => [c.id, c.name]));

  return orders.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt.toISOString().split('T')[0],
    customerName: o.customerId
      ? (customerMap.get(o.customerId) ?? '未知客户')
      : '未知客户',
  }));
}
