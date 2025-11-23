/**
 * 采购订单打印字段配置
 *
 * 定义采购订单的可打印字段
 * 用于字段选择器和打印模板
 */

import type {
  PrintConfig,
  PrintFieldDefinition,
} from '@/lib/types/print-config';

/**
 * 采购订单表头字段
 */
const purchaseOrderHeaderFields: PrintFieldDefinition[] = [
  {
    key: 'orderNumber',
    label: '订单编号',
    type: 'header',
    width: '150px',
    align: 'left',
    defaultVisible: true,
    required: true,
    group: '基本信息',
  },
  {
    key: 'containerNumber',
    label: '柜号',
    type: 'header',
    width: '120px',
    align: 'left',
    defaultVisible: true,
    group: '基本信息',
  },
  {
    key: 'status',
    label: '订单状态',
    type: 'header',
    width: '100px',
    align: 'center',
    defaultVisible: false,
    group: '基本信息',
    format: value => {
      const statusMap: Record<string, string> = {
        draft: '草稿',
        ordered: '已下单',
        shipped: '已发货',
        in_transit: '运输中',
        arrived: '已到货',
        completed: '已完成',
        cancelled: '已取消',
      };
      return statusMap[value as string] || (value as string);
    },
  },
  {
    key: 'orderDate',
    label: '下单日期',
    type: 'header',
    width: '120px',
    align: 'left',
    defaultVisible: true,
    group: '日期信息',
    format: value => {
      if (!value) return '-';
      return new Date(value as string).toLocaleDateString('zh-CN');
    },
  },
  {
    key: 'shipmentDate',
    label: '发货日期',
    type: 'header',
    width: '120px',
    align: 'left',
    defaultVisible: true,
    group: '日期信息',
    format: value => {
      if (!value) return '-';
      return new Date(value as string).toLocaleDateString('zh-CN');
    },
  },
  {
    key: 'estimatedArrival',
    label: '预计到货',
    type: 'header',
    width: '120px',
    align: 'left',
    defaultVisible: true,
    group: '日期信息',
    format: value => {
      if (!value) return '-';
      return new Date(value as string).toLocaleDateString('zh-CN');
    },
  },
  {
    key: 'arrivalDate',
    label: '实际到货',
    type: 'header',
    width: '120px',
    align: 'left',
    defaultVisible: false,
    group: '日期信息',
    format: value => {
      if (!value) return '-';
      return new Date(value as string).toLocaleDateString('zh-CN');
    },
  },
  {
    key: 'shippingCompany',
    label: '物流公司',
    type: 'header',
    width: '150px',
    align: 'left',
    defaultVisible: true,
    group: '物流信息',
  },
  {
    key: 'createdAt',
    label: '创建日期',
    type: 'header',
    width: '120px',
    align: 'left',
    defaultVisible: false,
    group: '日期信息',
    format: value => {
      if (!value) return '-';
      return new Date(value as string).toLocaleDateString('zh-CN');
    },
  },
  {
    key: 'remarks',
    label: '订单备注',
    type: 'header',
    width: '300px',
    align: 'left',
    defaultVisible: false,
    group: '其他信息',
  },
];

/**
 * 采购订单明细字段
 */
const purchaseOrderItemFields: PrintFieldDefinition[] = [
  {
    key: 'productCode',
    label: '产品编码',
    type: 'item',
    width: '120px',
    align: 'center',
    defaultVisible: true,
    required: true,
  },
  {
    key: 'productName',
    label: '产品名称',
    type: 'item',
    width: '200px',
    align: 'left',
    defaultVisible: true,
    required: true,
  },
  {
    key: 'specification',
    label: '规格型号',
    type: 'item',
    width: '150px',
    align: 'center',
    defaultVisible: true,
  },
  {
    key: 'unit',
    label: '单位',
    type: 'item',
    width: '60px',
    align: 'center',
    defaultVisible: true,
    required: true,
  },
  {
    key: 'quantity',
    label: '数量',
    type: 'item',
    width: '80px',
    align: 'center',
    defaultVisible: true,
    required: true,
  },
  {
    key: 'piecesPerUnit',
    label: '每件片数',
    type: 'item',
    width: '80px',
    align: 'center',
    defaultVisible: true,
  },
  {
    key: 'unitPrice',
    label: '单价',
    type: 'item',
    width: '100px',
    align: 'right',
    defaultVisible: true,
    required: true,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
  {
    key: 'totalPrice',
    label: '金额',
    type: 'item',
    width: '120px',
    align: 'right',
    defaultVisible: true,
    required: true,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
  {
    key: 'batchNumber',
    label: '批次号',
    type: 'item',
    width: '120px',
    align: 'center',
    defaultVisible: false,
  },
  {
    key: 'weight',
    label: '重量',
    type: 'item',
    width: '80px',
    align: 'right',
    defaultVisible: false,
    format: value =>
      typeof value === 'number' ? `${value.toFixed(2)}kg` : '-',
  },
  {
    key: 'supplierName',
    label: '供应商',
    type: 'item',
    width: '150px',
    align: 'left',
    defaultVisible: true,
  },
  {
    key: 'remarks',
    label: '备注',
    type: 'item',
    width: '200px',
    align: 'left',
    defaultVisible: false,
  },
];

/**
 * 采购订单汇总字段
 */
const purchaseOrderSummaryFields: PrintFieldDefinition[] = [
  {
    key: 'totalQuantity',
    label: '合计数量',
    type: 'summary',
    width: '150px',
    align: 'right',
    defaultVisible: true,
    required: true,
  },
  {
    key: 'totalWeight',
    label: '总重量',
    type: 'summary',
    width: '150px',
    align: 'right',
    defaultVisible: true,
    format: value =>
      typeof value === 'number' ? `${value.toFixed(1)}吨` : '-',
  },
  {
    key: 'totalAmount',
    label: '合计金额',
    type: 'summary',
    width: '150px',
    align: 'right',
    defaultVisible: true,
    required: true,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
  {
    key: 'totalAmountChinese',
    label: '合计金额（大写）',
    type: 'summary',
    width: '400px',
    align: 'left',
    defaultVisible: true,
  },
];

/**
 * 采购订单完整字段配置
 */
export const purchaseOrderPrintConfig: PrintConfig = {
  documentType: 'purchase-order',
  title: '采购订单',
  fields: [
    ...purchaseOrderHeaderFields,
    ...purchaseOrderItemFields,
    ...purchaseOrderSummaryFields,
  ],
  headerFields: purchaseOrderHeaderFields,
  itemFields: purchaseOrderItemFields,
  summaryFields: purchaseOrderSummaryFields,
};

/**
 * 获取采购订单默认可见字段
 */
export function getPurchaseOrderDefaultFields(): {
  headerKeys: string[];
  itemKeys: string[];
  summaryKeys: string[];
} {
  return {
    headerKeys: purchaseOrderHeaderFields
      .filter(f => f.defaultVisible)
      .map(f => f.key),
    itemKeys: purchaseOrderItemFields
      .filter(f => f.defaultVisible)
      .map(f => f.key),
    summaryKeys: purchaseOrderSummaryFields
      .filter(f => f.defaultVisible)
      .map(f => f.key),
  };
}

/**
 * 获取采购订单必填字段
 */
export function getPurchaseOrderRequiredFields(): {
  headerKeys: string[];
  itemKeys: string[];
  summaryKeys: string[];
} {
  return {
    headerKeys: purchaseOrderHeaderFields
      .filter(f => f.required)
      .map(f => f.key),
    itemKeys: purchaseOrderItemFields.filter(f => f.required).map(f => f.key),
    summaryKeys: purchaseOrderSummaryFields
      .filter(f => f.required)
      .map(f => f.key),
  };
}
