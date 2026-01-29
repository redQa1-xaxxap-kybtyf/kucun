/**
 * 销售订单打印字段配置
 *
 * 定义销售订单的可打印字段
 * 用于字段选择器和打印模板
 */

import type {
  PrintConfig,
  PrintFieldDefinition,
} from '@/lib/types/print-config';

/**
 * 销售订单表头字段
 */
const salesOrderHeaderFields: PrintFieldDefinition[] = [
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
    key: 'customerName',
    label: '客户名称',
    type: 'header',
    width: '200px',
    align: 'left',
    defaultVisible: true,
    required: true,
    group: '客户信息',
  },
  {
    key: 'customerPhone',
    label: '客户电话',
    type: 'header',
    width: '150px',
    align: 'left',
    defaultVisible: true,
    group: '客户信息',
  },
  {
    key: 'customerAddress',
    label: '客户地址',
    type: 'header',
    width: '300px',
    align: 'left',
    defaultVisible: true,
    group: '客户信息',
  },
  {
    key: 'shippingAddress',
    label: '发货地址',
    type: 'header',
    width: '300px',
    align: 'left',
    defaultVisible: true,
    group: '配送信息',
  },
  {
    key: 'transferMode',
    label: '运输方式',
    type: 'header',
    width: '100px',
    align: 'left',
    defaultVisible: false,
    group: '配送信息',
  },
  {
    key: 'createdAt',
    label: '创建日期',
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
    key: 'status',
    label: '订单状态',
    type: 'header',
    width: '100px',
    align: 'center',
    defaultVisible: false,
    group: '基本信息',
    format: value => {
      const statusMap: Record<string, string> = {
        pending: '草稿',
        draft: '草稿',
        confirmed: '已确认',
        processing: '已确认',
        shipped: '已发货',
        delivered: '已完成',
        completed: '已完成',
        cancelled: '已取消',
      };
      return statusMap[value as string] || (value as string);
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
 * 销售订单明细字段
 */
const salesOrderItemFields: PrintFieldDefinition[] = [
  {
    key: 'productCode',
    label: '产品编号',
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
    defaultVisible: false,
  },
  {
    key: 'specification',
    label: '规格型号',
    type: 'item',
    width: '150px',
    align: 'center',
    defaultVisible: true,
    required: true,
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
    key: 'subtotal',
    label: '金额',
    type: 'item',
    width: '120px',
    align: 'right',
    defaultVisible: true,
    required: true,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
  {
    key: 'remarks',
    label: '备注',
    type: 'item',
    width: '200px',
    align: 'left',
    defaultVisible: true,
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
];

/**
 * 销售订单汇总字段
 */
const salesOrderSummaryFields: PrintFieldDefinition[] = [
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
 * 销售订单完整字段配置
 */
export const salesOrderPrintConfig: PrintConfig = {
  documentType: 'sales-order',
  title: '销售订单',
  fields: [
    ...salesOrderHeaderFields,
    ...salesOrderItemFields,
    ...salesOrderSummaryFields,
  ],
  headerFields: salesOrderHeaderFields,
  itemFields: salesOrderItemFields,
  summaryFields: salesOrderSummaryFields,
};

/**
 * 获取销售订单默认可见字段
 */
export function getSalesOrderDefaultFields(): {
  headerKeys: string[];
  itemKeys: string[];
  summaryKeys: string[];
} {
  return {
    headerKeys: salesOrderHeaderFields
      .filter(f => f.defaultVisible)
      .map(f => f.key),
    itemKeys: salesOrderItemFields
      .filter(f => f.defaultVisible)
      .map(f => f.key),
    summaryKeys: salesOrderSummaryFields
      .filter(f => f.defaultVisible)
      .map(f => f.key),
  };
}

/**
 * 获取销售订单必填字段
 */
export function getSalesOrderRequiredFields(): {
  headerKeys: string[];
  itemKeys: string[];
  summaryKeys: string[];
} {
  return {
    headerKeys: salesOrderHeaderFields.filter(f => f.required).map(f => f.key),
    itemKeys: salesOrderItemFields.filter(f => f.required).map(f => f.key),
    summaryKeys: salesOrderSummaryFields
      .filter(f => f.required)
      .map(f => f.key),
  };
}
