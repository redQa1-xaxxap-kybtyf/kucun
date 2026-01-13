/**
 * 打印设计器 - 可绑定字段注册表
 *
 * 定义不同单据类型可绑定的数据字段
 */

// 字段定义
export interface FieldDefinition {
  /** 字段路径 (点分隔) */
  path: string;
  /** 显示名称 */
  label: string;
  /** 分组 */
  group: string;
  /** 数据类型 */
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  /** 建议的格式化方式 */
  suggestedFormat?: string;
}

// 销售订单字段
export const salesOrderFields: FieldDefinition[] = [
  // 订单信息
  { path: 'order.orderNumber', label: '订单编号', group: '订单', type: 'string' },
  { path: 'order.createdAt', label: '订单日期', group: '订单', type: 'date', suggestedFormat: 'date_cn' },
  { path: 'order.status', label: '订单状态', group: '订单', type: 'string' },
  { path: 'order.remark', label: '订单备注', group: '订单', type: 'string' },
  { path: 'order.deliveryDate', label: '交货日期', group: '订单', type: 'date', suggestedFormat: 'date_cn' },

  // 客户信息
  { path: 'customer.name', label: '客户名称', group: '客户', type: 'string' },
  { path: 'customer.phone', label: '客户电话', group: '客户', type: 'string' },
  { path: 'customer.address', label: '客户地址', group: '客户', type: 'string' },
  { path: 'customer.contact', label: '联系人', group: '客户', type: 'string' },

  // 汇总信息
  { path: 'totalAmount', label: '总金额', group: '汇总', type: 'number', suggestedFormat: 'currency' },
  { path: 'totalAmountCap', label: '大写金额', group: '汇总', type: 'number', suggestedFormat: 'currency_cap' },
  { path: 'totalQuantity', label: '总数量', group: '汇总', type: 'number', suggestedFormat: 'number' },
  { path: 'totalWeight', label: '总重量', group: '汇总', type: 'number', suggestedFormat: 'number' },
  { path: 'totalBoxes', label: '总件数', group: '汇总', type: 'number', suggestedFormat: 'number' },

  // 公司信息
  { path: 'company.name', label: '公司名称', group: '公司', type: 'string' },
  { path: 'company.phone', label: '公司电话', group: '公司', type: 'string' },
  { path: 'company.address', label: '公司地址', group: '公司', type: 'string' },
  { path: 'company.fax', label: '公司传真', group: '公司', type: 'string' },

  // 制单信息
  { path: 'operator.name', label: '制单人', group: '制单', type: 'string' },
  { path: 'printDate', label: '打印日期', group: '制单', type: 'date', suggestedFormat: 'date_cn' },
];

// 通用明细字段 (用于表格元素)
const commonItemFields: FieldDefinition[] = [
  { path: 'name', label: '名称', group: '明细', type: 'string' },
  { path: 'code', label: '编码', group: '明细', type: 'string' },
  { path: 'spec', label: '规格', group: '明细', type: 'string' },
  { path: 'unit', label: '单位', group: '明细', type: 'string' },
  { path: 'quantity', label: '数量', group: '明细', type: 'number', suggestedFormat: 'number' },
  { path: 'unitPrice', label: '单价', group: '明细', type: 'number', suggestedFormat: 'currency' },
  { path: 'subtotal', label: '金额', group: '明细', type: 'number', suggestedFormat: 'currency' },
  { path: 'batchNumber', label: '批次号', group: '明细', type: 'string' },
  { path: 'supplierName', label: '供应商', group: '明细', type: 'string' },
  { path: 'remark', label: '备注', group: '明细', type: 'string' },
];

// 兼容字段（旧 key，避免历史模板失效）
const legacyCommonItemFields: FieldDefinition[] = [
  { path: 'productName', label: '产品名称 (兼容)', group: '兼容', type: 'string' },
  { path: 'productCode', label: '产品编码 (兼容)', group: '兼容', type: 'string' },
  { path: 'specification', label: '规格 (兼容)', group: '兼容', type: 'string' },
  { path: 'subtotal', label: '小计 (兼容)', group: '兼容', type: 'number', suggestedFormat: 'currency' },
];

export const salesOrderItemFields: FieldDefinition[] = [
  ...commonItemFields,
  ...legacyCommonItemFields,
];

// 采购订单字段
export const purchaseOrderFields: FieldDefinition[] = [
  { path: 'order.orderNumber', label: '采购单号', group: '订单', type: 'string' },
  { path: 'order.createdAt', label: '采购日期', group: '订单', type: 'date', suggestedFormat: 'date_cn' },
  { path: 'order.status', label: '订单状态', group: '订单', type: 'string' },
  { path: 'order.containerNumber', label: '集装箱号', group: '订单', type: 'string' },
  { path: 'order.shippingCompany', label: '船运公司', group: '订单', type: 'string' },
  { path: 'order.shipmentDate', label: '发货日期', group: '订单', type: 'date', suggestedFormat: 'date_cn' },
  { path: 'order.estimatedArrival', label: '预计到港', group: '订单', type: 'date', suggestedFormat: 'date_cn' },
  { path: 'order.arrivalDate', label: '到港日期', group: '订单', type: 'date', suggestedFormat: 'date_cn' },
  { path: 'order.remark', label: '订单备注', group: '订单', type: 'string' },

  { path: 'supplier.name', label: '供应商名称', group: '供应商', type: 'string' },
  { path: 'supplier.phone', label: '供应商电话', group: '供应商', type: 'string' },
  { path: 'supplier.address', label: '供应商地址', group: '供应商', type: 'string' },
  { path: 'supplier.supplierCode', label: '供应商编码', group: '供应商', type: 'string' },

  { path: 'totalAmount', label: '采购总额', group: '汇总', type: 'number', suggestedFormat: 'currency' },
  { path: 'totalQuantity', label: '总数量', group: '汇总', type: 'number', suggestedFormat: 'number' },

  { path: 'operator.name', label: '制单人', group: '制单', type: 'string' },
  { path: 'printDate', label: '打印日期', group: '制单', type: 'date', suggestedFormat: 'date_cn' },

  { path: 'company.name', label: '公司名称', group: '公司', type: 'string' },
  { path: 'company.phone', label: '公司电话', group: '公司', type: 'string' },
  { path: 'company.address', label: '公司地址', group: '公司', type: 'string' },
];

// 厂家发货字段
export const factoryShipmentFields: FieldDefinition[] = [
  { path: 'order.orderNumber', label: '发货单号', group: '订单', type: 'string' },
  { path: 'order.createdAt', label: '创建日期', group: '订单', type: 'date', suggestedFormat: 'date_cn' },
  { path: 'order.status', label: '订单状态', group: '订单', type: 'string' },
  { path: 'order.containerNumber', label: '集装箱号', group: '订单', type: 'string' },
  { path: 'order.shippingCompany', label: '船运公司', group: '订单', type: 'string' },
  { path: 'order.shipmentDate', label: '发货日期', group: '订单', type: 'date', suggestedFormat: 'date_cn' },
  { path: 'order.estimatedArrival', label: '预计到港', group: '订单', type: 'date', suggestedFormat: 'date_cn' },
  { path: 'order.arrivalDate', label: '到港日期', group: '订单', type: 'date', suggestedFormat: 'date_cn' },
  { path: 'order.deliveryDate', label: '提货日期', group: '订单', type: 'date', suggestedFormat: 'date_cn' },
  { path: 'order.remark', label: '订单备注', group: '订单', type: 'string' },

  { path: 'customer.name', label: '客户名称', group: '客户', type: 'string' },
  { path: 'customer.phone', label: '客户电话', group: '客户', type: 'string' },
  { path: 'customer.address', label: '客户地址', group: '客户', type: 'string' },

  { path: 'totalAmount', label: '总金额', group: '汇总', type: 'number', suggestedFormat: 'currency' },
  { path: 'totalQuantity', label: '总数量', group: '汇总', type: 'number', suggestedFormat: 'number' },

  { path: 'operator.name', label: '制单人', group: '制单', type: 'string' },
  { path: 'printDate', label: '打印日期', group: '制单', type: 'date', suggestedFormat: 'date_cn' },

  { path: 'company.name', label: '公司名称', group: '公司', type: 'string' },
  { path: 'company.phone', label: '公司电话', group: '公司', type: 'string' },
  { path: 'company.address', label: '公司地址', group: '公司', type: 'string' },
];

// 入库记录（仓库进货）字段
export const inboundRecordFields: FieldDefinition[] = [
  { path: 'order.orderNumber', label: '入库单号', group: '入库', type: 'string' },
  { path: 'order.createdAt', label: '入库日期', group: '入库', type: 'date', suggestedFormat: 'date_cn' },
  { path: 'order.reason', label: '入库原因', group: '入库', type: 'string' },
  { path: 'order.location', label: '库位', group: '入库', type: 'string' },
  { path: 'order.remark', label: '备注', group: '入库', type: 'string' },

  { path: 'supplier.name', label: '供应商名称', group: '供应商', type: 'string' },
  { path: 'supplier.phone', label: '供应商电话', group: '供应商', type: 'string' },
  { path: 'supplier.address', label: '供应商地址', group: '供应商', type: 'string' },

  { path: 'product.code', label: '产品编码', group: '产品', type: 'string' },
  { path: 'product.name', label: '产品名称', group: '产品', type: 'string' },
  { path: 'product.spec', label: '规格', group: '产品', type: 'string' },
  { path: 'product.unit', label: '单位', group: '产品', type: 'string' },
  { path: 'product.batchNumber', label: '批次号', group: '产品', type: 'string' },

  { path: 'quantity', label: '入库数量', group: '汇总', type: 'number', suggestedFormat: 'number' },

  { path: 'operator.name', label: '操作人', group: '制单', type: 'string' },
  { path: 'printDate', label: '打印日期', group: '制单', type: 'date', suggestedFormat: 'date_cn' },

  { path: 'company.name', label: '公司名称', group: '公司', type: 'string' },
];

// 退货订单字段
export const returnOrderFields: FieldDefinition[] = [
  { path: 'order.orderNumber', label: '退货单号', group: '订单', type: 'string' },
  { path: 'order.createdAt', label: '创建日期', group: '订单', type: 'date', suggestedFormat: 'date_cn' },
  { path: 'order.status', label: '订单状态', group: '订单', type: 'string' },
  { path: 'order.type', label: '退货类型', group: '订单', type: 'string' },
  { path: 'order.processType', label: '处理方式', group: '订单', type: 'string' },
  { path: 'order.reason', label: '退货原因', group: '订单', type: 'string' },
  { path: 'order.remark', label: '备注', group: '订单', type: 'string' },

  { path: 'customer.name', label: '客户名称', group: '客户', type: 'string' },
  { path: 'customer.phone', label: '客户电话', group: '客户', type: 'string' },
  { path: 'customer.address', label: '客户地址', group: '客户', type: 'string' },

  { path: 'salesOrder.orderNumber', label: '原销售订单号', group: '关联', type: 'string' },

  { path: 'totalAmount', label: '退货总额', group: '汇总', type: 'number', suggestedFormat: 'currency' },
  { path: 'refundAmount', label: '退款金额', group: '汇总', type: 'number', suggestedFormat: 'currency' },

  { path: 'operator.name', label: '制单人', group: '制单', type: 'string' },
  { path: 'printDate', label: '打印日期', group: '制单', type: 'date', suggestedFormat: 'date_cn' },

  { path: 'company.name', label: '公司名称', group: '公司', type: 'string' },
];

// 字段注册表 (按模板类型)
export const fieldRegistry: Record<string, FieldDefinition[]> = {
  'sales-order': salesOrderFields,
  'purchase-order': purchaseOrderFields,
  'factory-shipment': factoryShipmentFields,
  'inbound-record': inboundRecordFields,
  'return-order': returnOrderFields,
  // 可以继续添加其他类型...
};

// 表格列字段注册表
export const tableFieldRegistry: Record<string, FieldDefinition[]> = {
  'sales-order': salesOrderItemFields,
  'purchase-order': salesOrderItemFields,
  'factory-shipment': salesOrderItemFields,
  'inbound-record': salesOrderItemFields,
  'return-order': [
    ...commonItemFields,
    { path: 'returnQuantity', label: '退货数量', group: '退货', type: 'number', suggestedFormat: 'number' },
    { path: 'damagedQuantity', label: '破损数量', group: '退货', type: 'number', suggestedFormat: 'number' },
    { path: 'originalQuantity', label: '原数量', group: '退货', type: 'number', suggestedFormat: 'number' },
    { path: 'reason', label: '退货原因', group: '退货', type: 'string' },
    ...legacyCommonItemFields,
  ],
};

/**
 * 根据模板类型获取可绑定字段
 */
export function getFieldsForTemplateType(type: string): FieldDefinition[] {
  return fieldRegistry[type] ?? salesOrderFields;
}

/**
 * 根据模板类型获取表格列字段
 */
export function getTableFieldsForTemplateType(type: string): FieldDefinition[] {
  return tableFieldRegistry[type] ?? salesOrderItemFields;
}

/**
 * 按组分类字段
 */
export function groupFields(
  fields: FieldDefinition[]
): Record<string, FieldDefinition[]> {
  const groups: Record<string, FieldDefinition[]> = {};
  fields.forEach((f) => {
    if (!groups[f.group]) groups[f.group] = [];
    groups[f.group].push(f);
  });
  return groups;
}
