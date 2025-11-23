/**
 * 厂家发货单打印字段配置
 *
 * 定义厂家发货单的可打印字段
 * 用于字段选择器和打印模板
 */

import type {
  PrintConfig,
  PrintFieldDefinition,
} from '@/lib/types/print-config';

/**
 * 厂家发货单表头字段
 */
const factoryShipmentHeaderFields: PrintFieldDefinition[] = [
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
    required: true,
    group: '基本信息',
  },
  {
    key: 'customerName',
    label: '客户名称',
    type: 'header',
    width: '150px',
    align: 'left',
    defaultVisible: true,
    required: true,
    group: '基本信息',
  },
  {
    key: 'customerPhone',
    label: '客户电话',
    type: 'header',
    width: '120px',
    align: 'left',
    defaultVisible: false,
    group: '基本信息',
  },
  {
    key: 'customerAddress',
    label: '客户地址',
    type: 'header',
    width: '200px',
    align: 'left',
    defaultVisible: false,
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
        confirmed: '已确认',
        pending_shipment: '待发货',
        shipped: '已发货',
        in_transit: '运输中',
        arrived: '到港',
        cancelled: '已取消',
      };
      return statusMap[value as string] || (value as string);
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
    key: 'deliveryDate',
    label: '交付日期',
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
 * 厂家发货单明细字段
 */
const factoryShipmentItemFields: PrintFieldDefinition[] = [
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
    key: 'ownership',
    label: '货物归属',
    type: 'item',
    width: '100px',
    align: 'center',
    defaultVisible: true,
    format: value => {
      const ownershipMap: Record<string, string> = {
        customer: '客户货',
        self: '自有货',
      };
      return ownershipMap[value as string] || (value as string);
    },
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
    key: 'unitCost',
    label: '单位成本',
    type: 'item',
    width: '100px',
    align: 'right',
    defaultVisible: false,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
  {
    key: 'allocatedExpense',
    label: '分摊费用',
    type: 'item',
    width: '100px',
    align: 'right',
    defaultVisible: false,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
  {
    key: 'profitAmount',
    label: '利润金额',
    type: 'item',
    width: '100px',
    align: 'right',
    defaultVisible: false,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
  {
    key: 'profitMargin',
    label: '利润率',
    type: 'item',
    width: '80px',
    align: 'right',
    defaultVisible: false,
    format: value => (typeof value === 'number' ? `${value.toFixed(1)}%` : '-'),
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
 * 厂家发货单汇总字段
 */
const factoryShipmentSummaryFields: PrintFieldDefinition[] = [
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
    key: 'customerOwnedAmount',
    label: '客户货金额',
    type: 'summary',
    width: '150px',
    align: 'right',
    defaultVisible: true,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
  {
    key: 'selfOwnedAmount',
    label: '自有货金额',
    type: 'summary',
    width: '150px',
    align: 'right',
    defaultVisible: true,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
  {
    key: 'totalAmount',
    label: '总金额',
    type: 'summary',
    width: '150px',
    align: 'right',
    defaultVisible: true,
    required: true,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
  {
    key: 'totalAmountChinese',
    label: '总金额（大写）',
    type: 'summary',
    width: '400px',
    align: 'left',
    defaultVisible: true,
  },
  {
    key: 'totalWeight',
    label: '总重量',
    type: 'summary',
    width: '150px',
    align: 'right',
    defaultVisible: false,
    format: value =>
      typeof value === 'number' ? `${value.toFixed(1)}吨` : '-',
  },
  {
    key: 'costAmount',
    label: '总成本',
    type: 'summary',
    width: '150px',
    align: 'right',
    defaultVisible: false,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
  {
    key: 'expenseAmount',
    label: '总费用',
    type: 'summary',
    width: '150px',
    align: 'right',
    defaultVisible: false,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
  {
    key: 'profitAmount',
    label: '总利润',
    type: 'summary',
    width: '150px',
    align: 'right',
    defaultVisible: false,
    format: value => (typeof value === 'number' ? `¥${value.toFixed(2)}` : '-'),
  },
];

/**
 * 厂家发货单完整字段配置
 */
export const factoryShipmentPrintConfig: PrintConfig = {
  documentType: 'factory-shipment',
  title: '厂家发货单',
  fields: [
    ...factoryShipmentHeaderFields,
    ...factoryShipmentItemFields,
    ...factoryShipmentSummaryFields,
  ],
  headerFields: factoryShipmentHeaderFields,
  itemFields: factoryShipmentItemFields,
  summaryFields: factoryShipmentSummaryFields,
};

/**
 * 获取厂家发货单默认可见字段
 */
export function getFactoryShipmentDefaultFields(): {
  headerKeys: string[];
  itemKeys: string[];
  summaryKeys: string[];
} {
  return {
    headerKeys: factoryShipmentHeaderFields
      .filter(f => f.defaultVisible)
      .map(f => f.key),
    itemKeys: factoryShipmentItemFields
      .filter(f => f.defaultVisible)
      .map(f => f.key),
    summaryKeys: factoryShipmentSummaryFields
      .filter(f => f.defaultVisible)
      .map(f => f.key),
  };
}

/**
 * 获取厂家发货单必填字段
 */
export function getFactoryShipmentRequiredFields(): {
  headerKeys: string[];
  itemKeys: string[];
  summaryKeys: string[];
} {
  return {
    headerKeys: factoryShipmentHeaderFields
      .filter(f => f.required)
      .map(f => f.key),
    itemKeys: factoryShipmentItemFields.filter(f => f.required).map(f => f.key),
    summaryKeys: factoryShipmentSummaryFields
      .filter(f => f.required)
      .map(f => f.key),
  };
}
