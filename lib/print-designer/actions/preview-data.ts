/**
 * 打印设计器 - 加载真实订单数据用于预览
 */

'use server';

import { PRODUCT_UNIT_LABELS } from '@/lib/config/product';
import { prisma } from '@/lib/db';
import { systemConfig } from '@/lib/env';
import {
  getSalesOrderDisplayQuantityValue,
  getSalesOrderItemDisplayCode,
  getSalesOrderItemDisplayName,
  getSalesOrderItemQuantityText,
  getSalesOrderItemSpecification,
  getSalesOrderItemWeightKg,
  getSalesOrderNormalizedDisplayUnit,
  getSalesOrderPiecesPerUnit,
  getSalesOrderTotalPieces,
  getSalesOrderTotalQuantitySummary,
  getSalesOrderTotalWeightKg,
} from '@/lib/utils/sales-order-display';

import type { PrintCompanyProfile } from '../company-profile';
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

async function getPrintCompanyProfile(): Promise<PrintCompanyProfile> {
  const fallbackProfile: PrintCompanyProfile = {
    name: systemConfig.companyName,
    address: '',
    phone: '',
    fax: '',
  };

  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        category: 'basic',
        key: {
          in: ['companyName', 'companyAddress', 'companyPhone'],
        },
      },
      select: {
        key: true,
        value: true,
      },
      take: 20,
    });

    const settingMap = new Map(settings.map(setting => [setting.key, setting.value]));

    return {
      name: settingMap.get('companyName')?.trim() || fallbackProfile.name,
      address: settingMap.get('companyAddress')?.trim() || fallbackProfile.address,
      phone: settingMap.get('companyPhone')?.trim() || fallbackProfile.phone,
      fax: fallbackProfile.fax,
    };
  } catch {
    return fallbackProfile;
  }
}

function toSafeInteger(value: unknown): number {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Math.floor(numeric);
}

function toSafeNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundWeightKg(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function calculateLineWeightKg(
  weightPerUnit: unknown,
  quantity: unknown
): number {
  const normalizedWeight = toSafeNumber(weightPerUnit);
  const normalizedQuantity = toSafeNumber(quantity);

  if (normalizedWeight <= 0 || normalizedQuantity <= 0) {
    return 0;
  }

  return roundWeightKg(normalizedWeight * normalizedQuantity);
}

function calculatePieceBackedWeightKg(
  totalPieces: unknown,
  weightPerUnit: unknown,
  piecesPerUnit = 0
): number {
  const normalizedPieces = toSafeNumber(totalPieces);
  const normalizedWeight = toSafeNumber(weightPerUnit);
  const normalizedPiecesPerUnit = toSafeInteger(piecesPerUnit);

  if (normalizedPieces <= 0 || normalizedWeight <= 0) {
    return 0;
  }

  const units =
    normalizedPiecesPerUnit > 1
      ? normalizedPieces / normalizedPiecesPerUnit
      : normalizedPieces;

  return roundWeightKg(units * normalizedWeight);
}

function resolvePiecesPerUnit(...values: unknown[]): number {
  for (const value of values) {
    const numeric = toSafeInteger(value);
    if (numeric > 0) {
      return numeric;
    }
  }

  return 0;
}

function buildUnitBasedQuantityFields(
  quantity: unknown,
  unit: string,
  piecesPerUnit = 0
) {
  const normalizedQuantity = toSafeInteger(quantity);
  const normalizedUnit = unit.trim();
  const boxes = normalizedUnit === '件' ? normalizedQuantity : 0;
  const pieces =
    piecesPerUnit > 1 && normalizedUnit === '件'
      ? normalizedQuantity * piecesPerUnit
      : normalizedQuantity;

  return {
    boxes,
    pieces,
    piecesPerUnit,
  };
}

function buildPieceBackedQuantityFields(
  totalPieces: unknown,
  unit: string,
  piecesPerUnit = 0,
  displayQuantity?: unknown
) {
  const pieces = toSafeInteger(totalPieces);
  const normalizedUnit = unit.trim();
  const rawDisplayQuantity = Number(displayQuantity);
  const boxes =
    normalizedUnit === '件'
      ? Number.isFinite(rawDisplayQuantity) && rawDisplayQuantity > 0
        ? rawDisplayQuantity
        : piecesPerUnit > 1
          ? pieces / piecesPerUnit
          : 0
      : 0;

  return {
    boxes,
    pieces,
    piecesPerUnit,
  };
}

export interface RecentPrintDocumentOption {
  id: string;
  label: string;
  secondary: string;
  description: string;
}

/**
 * 获取销售订单数据用于打印预览
 */
export async function getSalesOrderForPrint(orderId: string) {
  const user = await getAuthUser();
  if (!user) return null;
  const company = await getPrintCompanyProfile();

  const order = await prisma.salesOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      supplier: true,
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
  const normalizedItems = items.map(item => ({
    ...item,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    subtotal: Number(item.subtotal),
    displayQuantity:
      item.displayQuantity === null || item.displayQuantity === undefined
        ? undefined
        : Number(item.displayQuantity),
    weightSnapshot:
      item.weightSnapshot === null || item.weightSnapshot === undefined
        ? undefined
        : Number(item.weightSnapshot),
    manualWeight:
      item.manualWeight === null || item.manualWeight === undefined
        ? undefined
        : Number(item.manualWeight),
    product: item.product
      ? {
          ...item.product,
          weight:
            item.product.weight === null || item.product.weight === undefined
              ? null
              : Number(item.product.weight),
        }
      : undefined,
  }));

  // 转换为打印模板需要的格式
  const mappedItems = normalizedItems.map(displayItem => {
    const name = getSalesOrderItemDisplayName(displayItem);
    const code = getSalesOrderItemDisplayCode(displayItem);
    const spec = getSalesOrderItemSpecification(displayItem);
    const unit = getSalesOrderNormalizedDisplayUnit(displayItem);
    const quantityText = getSalesOrderItemQuantityText(displayItem);
    const itemWeightKg = roundWeightKg(
      getSalesOrderItemWeightKg(displayItem) ?? 0
    );
    const piecesPerUnit = getSalesOrderPiecesPerUnit(displayItem) ?? 0;
    const quantityFields = buildPieceBackedQuantityFields(
      displayItem.quantity,
      unit,
      piecesPerUnit,
      unit === '件' ? getSalesOrderDisplayQuantityValue(displayItem) : undefined
    );

    return {
      // 推荐通用字段（新模板优先使用）
      name,
      code,
      spec,
      unit,
      quantity: quantityText,
      unitPrice: Number(displayItem.unitPrice),
      subtotal: Number(displayItem.subtotal),
      totalPrice: Number(displayItem.subtotal),
      batchNumber: displayItem.batchNumber ?? '',
      colorNo: displayItem.colorCode ?? '',
      remark: displayItem.remarks ?? '',
      remarks: displayItem.remarks ?? '',
      ...quantityFields,

      // 兼容字段（旧模板仍可用）
      productName: name,
      productCode: code,
      specification: spec,

      // 其他补充信息（可选）
      itemWeightKg,
      weight: itemWeightKg,
    };
  });

  const totalWeightKg = roundWeightKg(
    getSalesOrderTotalWeightKg(normalizedItems)
  );

  return {
    order: {
      orderNumber: order.orderNumber,
      createdAt: formatDate(order.orderDate ?? order.createdAt),
      status: order.status,
      transferMode: order.transferMode,
      remark: order.remarks ?? '',
      deliveryDate: '',
    },
    customer: {
      name: order.customer?.name ?? '',
      phone: order.customer?.phone ?? '',
      address: order.customer?.address ?? '',
      contact: '', // Customer 模型没有 contactName
    },
    supplier: {
      name: order.supplier?.name ?? '',
      phone: order.supplier?.phone ?? '',
      address: order.supplier?.address ?? '',
      supplierCode: order.supplier?.supplierCode ?? '',
    },
    items: mappedItems,
    totalAmount: Number(order.totalAmount),
    totalAmountCap: Number(order.totalAmount),
    totalQuantity: getSalesOrderTotalQuantitySummary(normalizedItems),
    totalPieces: getSalesOrderTotalPieces(normalizedItems),
    totalWeight: totalWeightKg,
    totalWeightKg,
    totalBoxes: mappedItems.reduce(
      (sum, item) => sum + toSafeNumber(item.boxes),
      0
    ),
    operator: {
      name: order.user?.name ?? '',
    },
    printDate: todayYmd(),
    company,
  };
}

/**
 * 获取采购订单数据用于打印预览
 */
export async function getPurchaseOrderForPrint(orderId: string) {
  const user = await getAuthUser();
  if (!user) return null;
  const company = await getPrintCompanyProfile();

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
    const quantity = toSafeInteger(item.quantity);
    const piecesPerUnit = resolvePiecesPerUnit(
      item.piecesPerUnit,
      item.product?.piecesPerUnit
    );
    const quantityFields = buildUnitBasedQuantityFields(
      quantity,
      unit,
      piecesPerUnit
    );
    const itemWeightKg = calculateLineWeightKg(
      item.manualWeight ?? item.weight,
      quantity
    );

    return {
      name,
      code,
      spec,
      unit,
      quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.totalPrice),
      totalPrice: Number(item.totalPrice),
      batchNumber: item.batchNumber ?? '',
      supplierName: item.supplier?.name ?? order.supplier?.name ?? '',
      remark: item.remarks ?? '',
      remarks: item.remarks ?? '',
      itemWeightKg,
      weight: itemWeightKg,
      ...quantityFields,

      productName: name,
      productCode: code,
      specification: spec,
    };
  });

  const totalWeightKg = roundWeightKg(
    mappedItems.reduce((sum, item) => sum + item.itemWeightKg, 0)
  );

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
    totalBoxes: mappedItems.reduce((sum, item) => sum + item.boxes, 0),
    totalPieces: mappedItems.reduce((sum, item) => sum + item.pieces, 0),
    totalWeight: totalWeightKg,
    totalWeightKg,
    operator: {
      name: order.user?.name ?? '',
    },
    printDate: todayYmd(),
    company,
  };
}

/**
 * 获取厂家发货订单数据用于打印预览
 */
export async function getFactoryShipmentForPrint(orderId: string) {
  const user = await getAuthUser();
  if (!user) return null;
  const company = await getPrintCompanyProfile();

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
    const quantity = toSafeInteger(item.quantity);
    const piecesPerUnit = resolvePiecesPerUnit(
      item.piecesPerUnit,
      item.product?.piecesPerUnit
    );
    const quantityFields = buildUnitBasedQuantityFields(
      quantity,
      unit,
      piecesPerUnit
    );
    const itemWeightKg = calculateLineWeightKg(
      item.manualWeight ?? item.weight,
      quantity
    );

    return {
      name,
      code,
      spec,
      unit,
      quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.totalPrice),
      totalPrice: Number(item.totalPrice),
      batchNumber: item.batchNumber ?? '',
      supplierName: item.supplier?.name ?? '',
      remark: item.remarks ?? '',
      remarks: item.remarks ?? '',
      itemWeightKg,
      weight: itemWeightKg,
      ...quantityFields,

      productName: name,
      productCode: code,
      specification: spec,
    };
  });

  const totalWeightKg = roundWeightKg(
    mappedItems.reduce((sum, item) => sum + item.itemWeightKg, 0)
  );

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
    totalBoxes: mappedItems.reduce((sum, item) => sum + item.boxes, 0),
    totalPieces: mappedItems.reduce((sum, item) => sum + item.pieces, 0),
    totalWeight: totalWeightKg,
    totalWeightKg,
    operator: {
      name: order.user?.name ?? '',
    },
    printDate: todayYmd(),
    company,
  };
}

/**
 * 获取出库发货单数据用于打印预览
 *
 * 注意：出库详情路由使用 recordNumber，这里也以 recordNumber 查询。
 */
export async function getDeliveryNoteForPrint(recordNumber: string) {
  const user = await getAuthUser();
  if (!user) return null;
  const company = await getPrintCompanyProfile();

  const record = await prisma.outboundRecord.findUnique({
    where: { recordNumber },
    include: {
      product: true,
      variant: true,
      customer: true,
      operator: { select: { name: true } },
      salesOrder: {
        select: {
          orderNumber: true,
          customer: {
            select: {
              name: true,
              phone: true,
              address: true,
            },
          },
        },
      },
    },
  });

  if (!record) return null;

  const variantLabel = [record.variant?.colorCode, record.variant?.colorName]
    .filter(Boolean)
    .join(' · ');
  const baseName = record.product?.name ?? '';
  const name = variantLabel ? `${baseName} - ${variantLabel}` : baseName;
  const code = record.product?.code ?? '';
  const spec = record.product?.specification ?? '';
  const unit = resolveUnitLabel(record.product?.unit ?? 'sheet') || '片';
  const customer = record.customer ?? record.salesOrder?.customer;
  const piecesPerUnit = resolvePiecesPerUnit(record.product?.piecesPerUnit);
  const quantityFields = buildPieceBackedQuantityFields(
    record.quantity,
    unit,
    piecesPerUnit
  );
  const itemWeightKg = calculatePieceBackedWeightKg(
    record.quantity,
    record.product?.weight,
    piecesPerUnit
  );

  const itemRow = {
    name,
    code,
    spec,
    unit,
    quantity: Number(record.quantity),
    unitPrice: Number(record.unitCost ?? 0),
    subtotal: Number(record.totalCost ?? 0),
    totalPrice: Number(record.totalCost ?? 0),
    batchNumber: record.batchNumber ?? '',
    colorNo: record.variant?.colorCode ?? '',
    remark: record.notes ?? '',
    remarks: record.notes ?? '',
    itemWeightKg,
    weight: itemWeightKg,
    ...quantityFields,

    productName: name,
    productCode: code,
    specification: spec,
  };

  return {
    order: {
      orderNumber: record.recordNumber,
      createdAt: formatDate(record.createdAt),
      status: record.reason ?? '',
      sourceOrderNumber: record.salesOrder?.orderNumber ?? '',
      remark: record.notes ?? '',
    },
    customer: {
      name: customer?.name ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      contact: '',
    },
    items: [itemRow],
    totalAmount: Number(record.totalCost ?? 0),
    totalQuantity: Number(record.quantity),
    totalBoxes: itemRow.boxes,
    totalPieces: itemRow.pieces,
    totalWeight: itemWeightKg,
    totalWeightKg: itemWeightKg,
    operator: {
      name: record.operator?.name ?? '',
    },
    printDate: todayYmd(),
    company,
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
  const company = await getPrintCompanyProfile();

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
  const piecesPerUnit = resolvePiecesPerUnit(
    record.batchSpecification?.piecesPerUnit,
    record.product?.piecesPerUnit
  );
  const batchNumber =
    record.batchNumber ?? record.batchSpecification?.batchNumber ?? '';
  const quantityFields = buildPieceBackedQuantityFields(
    record.quantity,
    unit,
    piecesPerUnit
  );
  const itemWeightKg = calculatePieceBackedWeightKg(
    record.quantity,
    record.batchSpecification?.weight ?? record.product?.weight,
    piecesPerUnit
  );

  const itemRow = {
    name,
    code,
    spec,
    unit,
    quantity: record.quantity,
    batchNumber,
    colorNo: record.variant?.colorCode ?? '',
    supplierName: record.supplier?.name ?? '',
    remark: record.remarks ?? '',
    remarks: record.remarks ?? '',
    locationName: record.location ?? '',
    itemWeightKg,
    weight: itemWeightKg,
    ...quantityFields,

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
      supplierCode: record.supplier?.supplierCode ?? '',
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
    totalBoxes: itemRow.boxes,
    totalPieces: itemRow.pieces,
    totalWeight: itemWeightKg,
    totalWeightKg: itemWeightKg,
    operator: {
      name: record.user?.name ?? '',
    },
    printDate: todayYmd(),
    company,
  };
}

/**
 * 获取退货订单数据用于打印预览
 */
export async function getReturnOrderForPrint(orderId: string) {
  const user = await getAuthUser();
  if (!user) return null;
  const company = await getPrintCompanyProfile();

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
    const piecesPerUnit = resolvePiecesPerUnit(
      item.salesOrderItem?.piecesPerUnit,
      item.product?.piecesPerUnit
    );
    const quantityFields = buildPieceBackedQuantityFields(
      item.returnQuantity,
      unit,
      piecesPerUnit
    );
    const itemWeightKg = calculatePieceBackedWeightKg(
      item.returnQuantity,
      item.salesOrderItem?.weightSnapshot ?? item.product?.weight,
      piecesPerUnit
    );

    return {
      name,
      code,
      spec,
      unit,

      quantity: item.returnQuantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
      totalPrice: Number(item.subtotal),
      batchNumber,
      colorNo: item.colorCode ?? '',
      remark: item.reason ?? '',
      remarks: item.reason ?? '',
      itemWeightKg,
      weight: itemWeightKg,
      ...quantityFields,

      returnQuantity: item.returnQuantity,
      damagedQuantity: item.damagedQuantity,
      originalQuantity: item.originalQuantity,
      reason: item.reason ?? '',

      productName: name,
      productCode: code,
      specification: spec,
    };
  });

  const totalWeightKg = roundWeightKg(
    mappedItems.reduce((sum, item) => sum + item.itemWeightKg, 0)
  );

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
    totalBoxes: mappedItems.reduce((sum, item) => sum + item.boxes, 0),
    totalPieces: mappedItems.reduce((sum, item) => sum + item.pieces, 0),
    totalWeight: totalWeightKg,
    totalWeightKg,
    operator: {
      name: order.user?.name ?? '',
    },
    printDate: todayYmd(),
    company,
  };
}

/**
 * 统一入口：根据模板类型 + 单据 id 获取打印数据
 *
 * - sales-order / purchase-order / factory-shipment / return-order: documentId = 数据库 id
 * - inbound-record / delivery-note: documentId = recordNumber
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
    case 'delivery-note':
      return getDeliveryNoteForPrint(documentId);
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

export async function getRecentDocumentsForTemplate(
  templateType: TemplateType,
  limit = 10
): Promise<RecentPrintDocumentOption[]> {
  const user = await getAuthUser();
  if (!user) return [];

  switch (templateType) {
    case 'sales-order': {
      const orders = await prisma.salesOrder.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      });

      return orders.map(order => ({
        id: order.id,
        label: order.orderNumber,
        secondary: order.customer?.name ?? '未关联客户',
        description: `创建于 ${formatDate(order.createdAt)}`,
      }));
    }

    case 'purchase-order': {
      const orders = await prisma.purchaseOrder.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          supplier: { select: { name: true } },
        },
      });

      return orders.map(order => ({
        id: order.id,
        label: order.orderNumber,
        secondary: order.supplier?.name ?? '未关联供应商',
        description: `创建于 ${formatDate(order.createdAt)}`,
      }));
    }

    case 'factory-shipment': {
      const orders = await prisma.factoryShipmentOrder.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      });

      return orders.map(order => ({
        id: order.id,
        label: order.orderNumber,
        secondary: order.customer?.name ?? '未关联客户',
        description: `创建于 ${formatDate(order.createdAt)}`,
      }));
    }

    case 'delivery-note': {
      const records = await prisma.outboundRecord.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          recordNumber: true,
          createdAt: true,
          customer: { select: { name: true } },
          salesOrder: {
            select: {
              customer: { select: { name: true } },
            },
          },
          product: { select: { name: true } },
        },
      });

      return records.map(record => ({
        id: record.recordNumber,
        label: record.recordNumber,
        secondary:
          record.customer?.name ??
          record.salesOrder?.customer?.name ??
          record.product?.name ??
          '未关联客户/产品',
        description: `出库于 ${formatDate(record.createdAt)}`,
      }));
    }

    case 'inbound-record': {
      const records = await prisma.inboundRecord.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          recordNumber: true,
          createdAt: true,
          product: { select: { name: true } },
          supplier: { select: { name: true } },
        },
      });

      return records.map(record => ({
        id: record.recordNumber,
        label: record.recordNumber,
        secondary:
          record.product?.name ?? record.supplier?.name ?? '未关联商品/供应商',
        description: `入库于 ${formatDate(record.createdAt)}`,
      }));
    }

    case 'return-order': {
      const orders = await prisma.returnOrder.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          returnNumber: true,
          createdAt: true,
          customer: { select: { name: true } },
        },
      });

      return orders.map(order => ({
        id: order.id,
        label: order.returnNumber,
        secondary: order.customer?.name ?? '未关联客户',
        description: `创建于 ${formatDate(order.createdAt)}`,
      }));
    }

    case 'custom':
    default:
      return [];
  }
}
