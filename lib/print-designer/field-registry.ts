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
  {
    path: 'order.orderNumber',
    label: '订单编号',
    group: '订单',
    type: 'string',
  },
  {
    path: 'order.createdAt',
    label: '订单日期',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  { path: 'order.status', label: '订单状态', group: '订单', type: 'string' },
  {
    path: 'order.isSampleOrder',
    label: '是否样品单',
    group: '订单',
    type: 'boolean',
  },
  {
    path: 'order.sampleSettlementType',
    label: '样品结算方式',
    group: '订单',
    type: 'string',
  },
  { path: 'order.remark', label: '订单备注', group: '订单', type: 'string' },
  {
    path: 'order.deliveryDate',
    label: '交货日期',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },

  // 客户信息
  { path: 'customer.name', label: '客户名称', group: '客户', type: 'string' },
  { path: 'customer.phone', label: '客户电话', group: '客户', type: 'string' },
  {
    path: 'customer.address',
    label: '客户地址',
    group: '客户',
    type: 'string',
  },
  { path: 'customer.contact', label: '联系人', group: '客户', type: 'string' },

  // 汇总信息
  {
    path: 'totalAmount',
    label: '总金额',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'totalAmountCap',
    label: '大写金额',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'currency_cap',
  },
  {
    path: 'totalQuantity',
    label: '总数量',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'totalWeight',
    label: '总重量',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'totalBoxes',
    label: '总件数',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'number',
  },

  // 公司信息
  { path: 'company.name', label: '公司名称', group: '公司', type: 'string' },
  { path: 'company.phone', label: '公司电话', group: '公司', type: 'string' },
  { path: 'company.address', label: '公司地址', group: '公司', type: 'string' },
  { path: 'company.fax', label: '公司传真', group: '公司', type: 'string' },

  // 制单信息
  { path: 'operator.name', label: '制单人', group: '制单', type: 'string' },
  {
    path: 'printDate',
    label: '打印日期',
    group: '制单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
];

// 通用明细字段 (用于表格元素)
const commonItemFields: FieldDefinition[] = [
  { path: 'name', label: '名称', group: '明细', type: 'string' },
  { path: 'code', label: '编码', group: '明细', type: 'string' },
  { path: 'spec', label: '规格', group: '明细', type: 'string' },
  { path: 'unit', label: '单位', group: '明细', type: 'string' },
  {
    path: 'quantity',
    label: '数量',
    group: '明细',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'unitPrice',
    label: '单价',
    group: '明细',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'subtotal',
    label: '金额',
    group: '明细',
    type: 'number',
    suggestedFormat: 'currency',
  },
  { path: 'batchNumber', label: '批次号', group: '明细', type: 'string' },
  { path: 'supplierName', label: '供应商', group: '明细', type: 'string' },
  { path: 'remark', label: '备注', group: '明细', type: 'string' },
];

// 兼容字段（旧 key，避免历史模板失效）
const legacyCommonItemFields: FieldDefinition[] = [
  {
    path: 'productName',
    label: '产品名称 (兼容)',
    group: '兼容',
    type: 'string',
  },
  {
    path: 'productCode',
    label: '产品编码 (兼容)',
    group: '兼容',
    type: 'string',
  },
  {
    path: 'specification',
    label: '规格 (兼容)',
    group: '兼容',
    type: 'string',
  },
  {
    path: 'subtotal',
    label: '小计 (兼容)',
    group: '兼容',
    type: 'number',
    suggestedFormat: 'currency',
  },
];

export const salesOrderItemFields: FieldDefinition[] = [
  ...commonItemFields,
  ...legacyCommonItemFields,
];

// 采购订单字段
export const purchaseOrderFields: FieldDefinition[] = [
  {
    path: 'order.orderNumber',
    label: '采购单号',
    group: '订单',
    type: 'string',
  },
  {
    path: 'order.createdAt',
    label: '采购日期',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  { path: 'order.status', label: '订单状态', group: '订单', type: 'string' },
  {
    path: 'order.containerNumber',
    label: '集装箱号',
    group: '订单',
    type: 'string',
  },
  {
    path: 'order.shippingCompany',
    label: '船运公司',
    group: '订单',
    type: 'string',
  },
  {
    path: 'order.shipmentDate',
    label: '发货日期',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  {
    path: 'order.estimatedArrival',
    label: '预计到港',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  {
    path: 'order.arrivalDate',
    label: '到港日期',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  { path: 'order.remark', label: '订单备注', group: '订单', type: 'string' },

  {
    path: 'supplier.name',
    label: '供应商名称',
    group: '供应商',
    type: 'string',
  },
  {
    path: 'supplier.phone',
    label: '供应商电话',
    group: '供应商',
    type: 'string',
  },
  {
    path: 'supplier.address',
    label: '供应商地址',
    group: '供应商',
    type: 'string',
  },
  {
    path: 'supplier.supplierCode',
    label: '供应商编码',
    group: '供应商',
    type: 'string',
  },

  {
    path: 'totalAmount',
    label: '采购总额',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'totalQuantity',
    label: '总数量',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'number',
  },

  { path: 'operator.name', label: '制单人', group: '制单', type: 'string' },
  {
    path: 'printDate',
    label: '打印日期',
    group: '制单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },

  { path: 'company.name', label: '公司名称', group: '公司', type: 'string' },
  { path: 'company.phone', label: '公司电话', group: '公司', type: 'string' },
  { path: 'company.address', label: '公司地址', group: '公司', type: 'string' },
];

// 厂家发货字段
export const factoryShipmentFields: FieldDefinition[] = [
  {
    path: 'order.orderNumber',
    label: '发货单号',
    group: '订单',
    type: 'string',
  },
  {
    path: 'order.createdAt',
    label: '创建日期',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  { path: 'order.status', label: '订单状态', group: '订单', type: 'string' },
  {
    path: 'order.containerNumber',
    label: '集装箱号',
    group: '订单',
    type: 'string',
  },
  {
    path: 'order.shippingCompany',
    label: '船运公司',
    group: '订单',
    type: 'string',
  },
  {
    path: 'order.shipmentDate',
    label: '发货日期',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  {
    path: 'order.estimatedArrival',
    label: '预计到港',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  {
    path: 'order.arrivalDate',
    label: '到港日期',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  {
    path: 'order.deliveryDate',
    label: '提货日期',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  { path: 'order.remark', label: '订单备注', group: '订单', type: 'string' },

  { path: 'customer.name', label: '客户名称', group: '客户', type: 'string' },
  { path: 'customer.phone', label: '客户电话', group: '客户', type: 'string' },
  {
    path: 'customer.address',
    label: '客户地址',
    group: '客户',
    type: 'string',
  },

  {
    path: 'totalAmount',
    label: '总金额',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'totalQuantity',
    label: '总数量',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'number',
  },

  { path: 'operator.name', label: '制单人', group: '制单', type: 'string' },
  {
    path: 'printDate',
    label: '打印日期',
    group: '制单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },

  { path: 'company.name', label: '公司名称', group: '公司', type: 'string' },
  { path: 'company.phone', label: '公司电话', group: '公司', type: 'string' },
  { path: 'company.address', label: '公司地址', group: '公司', type: 'string' },
];

// 发货单字段
export const deliveryNoteFields: FieldDefinition[] = [
  {
    path: 'order.orderNumber',
    label: '发货单号',
    group: '订单',
    type: 'string',
  },
  {
    path: 'order.createdAt',
    label: '出库日期',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  { path: 'order.status', label: '出库类型', group: '订单', type: 'string' },
  {
    path: 'order.sourceOrderNumber',
    label: '来源订单号',
    group: '订单',
    type: 'string',
  },
  { path: 'order.remark', label: '备注', group: '订单', type: 'string' },

  { path: 'customer.name', label: '客户名称', group: '客户', type: 'string' },
  { path: 'customer.phone', label: '客户电话', group: '客户', type: 'string' },
  {
    path: 'customer.address',
    label: '客户地址',
    group: '客户',
    type: 'string',
  },

  {
    path: 'totalAmount',
    label: '出库金额',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'totalQuantity',
    label: '出库数量',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'number',
  },

  { path: 'operator.name', label: '操作人', group: '制单', type: 'string' },
  {
    path: 'printDate',
    label: '打印日期',
    group: '制单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },

  { path: 'company.name', label: '公司名称', group: '公司', type: 'string' },
  { path: 'company.phone', label: '公司电话', group: '公司', type: 'string' },
  { path: 'company.address', label: '公司地址', group: '公司', type: 'string' },
  { path: 'company.fax', label: '公司传真', group: '公司', type: 'string' },
];

// 入库记录（仓库进货）字段
export const inboundRecordFields: FieldDefinition[] = [
  {
    path: 'order.orderNumber',
    label: '入库单号',
    group: '入库',
    type: 'string',
  },
  {
    path: 'order.createdAt',
    label: '入库日期',
    group: '入库',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  { path: 'order.reason', label: '入库原因', group: '入库', type: 'string' },
  { path: 'order.location', label: '库位', group: '入库', type: 'string' },
  { path: 'order.remark', label: '备注', group: '入库', type: 'string' },

  {
    path: 'supplier.name',
    label: '供应商名称',
    group: '供应商',
    type: 'string',
  },
  {
    path: 'supplier.phone',
    label: '供应商电话',
    group: '供应商',
    type: 'string',
  },
  {
    path: 'supplier.address',
    label: '供应商地址',
    group: '供应商',
    type: 'string',
  },

  { path: 'product.code', label: '产品编码', group: '产品', type: 'string' },
  { path: 'product.name', label: '产品名称', group: '产品', type: 'string' },
  { path: 'product.spec', label: '规格', group: '产品', type: 'string' },
  { path: 'product.unit', label: '单位', group: '产品', type: 'string' },
  {
    path: 'product.batchNumber',
    label: '批次号',
    group: '产品',
    type: 'string',
  },

  {
    path: 'quantity',
    label: '入库数量',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'number',
  },

  { path: 'operator.name', label: '操作人', group: '制单', type: 'string' },
  {
    path: 'printDate',
    label: '打印日期',
    group: '制单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },

  { path: 'company.name', label: '公司名称', group: '公司', type: 'string' },
];

// 退货订单字段
export const returnOrderFields: FieldDefinition[] = [
  {
    path: 'order.orderNumber',
    label: '退货单号',
    group: '订单',
    type: 'string',
  },
  {
    path: 'order.createdAt',
    label: '创建日期',
    group: '订单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  { path: 'order.status', label: '订单状态', group: '订单', type: 'string' },
  { path: 'order.type', label: '退货类型', group: '订单', type: 'string' },
  {
    path: 'order.processType',
    label: '处理方式',
    group: '订单',
    type: 'string',
  },
  { path: 'order.reason', label: '退货原因', group: '订单', type: 'string' },
  { path: 'order.remark', label: '备注', group: '订单', type: 'string' },

  { path: 'customer.name', label: '客户名称', group: '客户', type: 'string' },
  { path: 'customer.phone', label: '客户电话', group: '客户', type: 'string' },
  {
    path: 'customer.address',
    label: '客户地址',
    group: '客户',
    type: 'string',
  },

  {
    path: 'salesOrder.orderNumber',
    label: '原销售订单号',
    group: '关联',
    type: 'string',
  },

  {
    path: 'totalAmount',
    label: '退货总额',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'refundAmount',
    label: '退款金额',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'currency',
  },

  { path: 'operator.name', label: '制单人', group: '制单', type: 'string' },
  {
    path: 'printDate',
    label: '打印日期',
    group: '制单',
    type: 'date',
    suggestedFormat: 'date_cn',
  },

  { path: 'company.name', label: '公司名称', group: '公司', type: 'string' },
];

// 月度报表字段
export const monthlyReportFields: FieldDefinition[] = [
  { path: 'period.label', label: '统计周期', group: '报表', type: 'string' },
  {
    path: 'reportMeta.exportDate',
    label: '导出日期',
    group: '报表',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  {
    path: 'reportMeta.year',
    label: '报表年度',
    group: '报表',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'reportMeta.month',
    label: '报表月份',
    group: '报表',
    type: 'number',
    suggestedFormat: 'number',
  },

  {
    path: 'revenue.salesRevenue',
    label: '销售收入',
    group: '收入',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'sample.sampleRevenue',
    label: '样品费',
    group: '样品',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'sample.sampleQuantity',
    label: '样品数量',
    group: '样品',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'sample.sampleCost',
    label: '样品成本',
    group: '样品',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'sample.customerCount',
    label: '样品客户数',
    group: '样品',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'revenue.orderCount',
    label: '订单数量',
    group: '收入',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'revenue.completedOrders',
    label: '已完成订单',
    group: '收入',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'revenue.pendingOrders',
    label: '待处理订单',
    group: '收入',
    type: 'number',
    suggestedFormat: 'number',
  },

  {
    path: 'costs.totalCost',
    label: '营业总成本',
    group: '成本',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'expenses.totalExpenses',
    label: '期间费用',
    group: '费用',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'expenses.byType.shipping',
    label: '运费',
    group: '费用',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'expenses.byType.labor',
    label: '工资',
    group: '费用',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'expenses.byType.operating',
    label: '营业费',
    group: '费用',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'expenses.byType.management',
    label: '管理费',
    group: '费用',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'expenses.byType.loading_unloading',
    label: '装卸费',
    group: '费用',
    type: 'number',
    suggestedFormat: 'currency',
  },

  {
    path: 'profit.grossProfit',
    label: '毛利润',
    group: '利润',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'profit.netProfit',
    label: '净利润',
    group: '利润',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'profit.profitMargin',
    label: '利润率',
    group: '利润',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'profit.grossProfitMargin',
    label: '毛利率',
    group: '利润',
    type: 'number',
    suggestedFormat: 'number',
  },

  {
    path: 'receivables.receivableBalance',
    label: '应收余额',
    group: '往来',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'receivables.payableBalance',
    label: '应付余额',
    group: '往来',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'inventoryTurnover.turnoverDays',
    label: '库存周转天数',
    group: '库存',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'inventoryTurnover.turnoverRate',
    label: '库存周转率',
    group: '库存',
    type: 'number',
    suggestedFormat: 'number',
  },

  {
    path: 'comparison.revenue.changeRate',
    label: '收入环比',
    group: '对比',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'comparison.profit.changeRate',
    label: '利润环比',
    group: '对比',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'comparison.expenses.changeRate',
    label: '费用环比',
    group: '对比',
    type: 'number',
    suggestedFormat: 'number',
  },
];

// 年度报表字段
export const annualReportFields: FieldDefinition[] = [
  { path: 'period.label', label: '统计年度', group: '报表', type: 'string' },
  {
    path: 'reportMeta.exportDate',
    label: '导出日期',
    group: '报表',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  {
    path: 'summary.totalRevenue',
    label: '年度收入',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'summary.totalProfit',
    label: '年度利润',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'summary.totalCost',
    label: '年度成本',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'summary.totalExpenses',
    label: '年度费用',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'summary.profitMargin',
    label: '年度利润率',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'summary.orderCount',
    label: '订单总数',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'summary.averageMonthlyRevenue',
    label: '月均收入',
    group: '汇总',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'sample.sampleRevenue',
    label: '样品费',
    group: '样品',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'sample.sampleQuantity',
    label: '样品数量',
    group: '样品',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'sample.sampleCost',
    label: '样品成本',
    group: '样品',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'sample.customerCount',
    label: '样品客户数',
    group: '样品',
    type: 'number',
    suggestedFormat: 'number',
  },

  {
    path: 'inventoryTurnover.turnoverRate',
    label: '库存周转率',
    group: '库存',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'inventoryTurnover.turnoverDays',
    label: '库存周转天数',
    group: '库存',
    type: 'number',
    suggestedFormat: 'number',
  },

  {
    path: 'yearOverYear.revenue.changeRate',
    label: '收入同比',
    group: '同比',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'yearOverYear.profit.changeRate',
    label: '利润同比',
    group: '同比',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'yearOverYear.expenses.changeRate',
    label: '费用同比',
    group: '同比',
    type: 'number',
    suggestedFormat: 'number',
  },
];

// 盈亏分析字段
export const profitLossFields: FieldDefinition[] = [
  { path: 'period.label', label: '统计周期', group: '报表', type: 'string' },
  {
    path: 'reportMeta.exportDate',
    label: '导出日期',
    group: '报表',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  {
    path: 'reportMeta.startDate',
    label: '开始日期',
    group: '报表',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  {
    path: 'reportMeta.endDate',
    label: '结束日期',
    group: '报表',
    type: 'date',
    suggestedFormat: 'date_cn',
  },
  { path: 'status', label: '盈亏状态', group: '报表', type: 'string' },

  {
    path: 'revenue.totalRevenue',
    label: '总收入',
    group: '收入',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'sample.sampleRevenue',
    label: '样品费',
    group: '样品',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'sample.sampleQuantity',
    label: '样品数量',
    group: '样品',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'sample.sampleCost',
    label: '样品成本',
    group: '样品',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'costs.totalCost',
    label: '总成本',
    group: '成本',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'costs.costRate',
    label: '成本率',
    group: '成本',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'expenses.totalExpenses',
    label: '总费用',
    group: '费用',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'expenses.shipping',
    label: '运费',
    group: '费用',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'expenses.labor',
    label: '工资',
    group: '费用',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'expenses.operating',
    label: '营业费',
    group: '费用',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'expenses.management',
    label: '管理费',
    group: '费用',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'profit.netProfit',
    label: '净利润',
    group: '利润',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'profit.netProfitMargin',
    label: '净利率',
    group: '利润',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'profit.grossProfitMargin',
    label: '毛利率',
    group: '利润',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'factoryShipmentProfit.customerProfit',
    label: '直发利润',
    group: '直发',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'factoryShipmentProfit.percentageOfTotal',
    label: '利润贡献占比',
    group: '直发',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'comparison.revenue.changeRate',
    label: '收入变化率',
    group: '对比',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'comparison.profit.changeRate',
    label: '利润变化率',
    group: '对比',
    type: 'number',
    suggestedFormat: 'number',
  },
];

const reportAlertFields: FieldDefinition[] = [
  { path: 'type', label: '提醒级别', group: '提醒', type: 'string' },
  { path: 'title', label: '提醒标题', group: '提醒', type: 'string' },
  { path: 'message', label: '提醒内容', group: '提醒', type: 'string' },
];

const sampleCustomerFields: FieldDefinition[] = [
  {
    path: 'customerName',
    label: '客户名称',
    group: '样品客户',
    type: 'string',
  },
  {
    path: 'orderCount',
    label: '样品单数',
    group: '样品客户',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'sampleQuantity',
    label: '样品数量',
    group: '样品客户',
    type: 'number',
    suggestedFormat: 'number',
  },
  {
    path: 'sampleRevenue',
    label: '样品费',
    group: '样品客户',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'sampleCost',
    label: '样品成本',
    group: '样品客户',
    type: 'number',
    suggestedFormat: 'currency',
  },
];

const annualTrendFields: FieldDefinition[] = [
  { path: 'monthLabel', label: '月份', group: '月度趋势', type: 'string' },
  {
    path: 'revenue',
    label: '收入',
    group: '月度趋势',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'cost',
    label: '成本',
    group: '月度趋势',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'expenses',
    label: '费用',
    group: '月度趋势',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'profit',
    label: '利润',
    group: '月度趋势',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'orderCount',
    label: '订单数',
    group: '月度趋势',
    type: 'number',
    suggestedFormat: 'number',
  },
  { path: 'quarterLabel', label: '季度', group: '季度数据', type: 'string' },
  {
    path: 'profitMargin',
    label: '利润率',
    group: '季度数据',
    type: 'number',
    suggestedFormat: 'number',
  },
];

const profitLossTrendFields: FieldDefinition[] = [
  { path: 'dateLabel', label: '时间', group: '趋势', type: 'string' },
  {
    path: 'revenue',
    label: '收入',
    group: '趋势',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'cost',
    label: '成本',
    group: '趋势',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'expense',
    label: '费用',
    group: '趋势',
    type: 'number',
    suggestedFormat: 'currency',
  },
  {
    path: 'profit',
    label: '利润',
    group: '趋势',
    type: 'number',
    suggestedFormat: 'currency',
  },
];

const arrayFieldRegistry: Record<string, FieldDefinition[]> = {
  'sales-order': [
    { path: 'items', label: '订单明细', group: '表格数据源', type: 'array' },
  ],
  'purchase-order': [
    { path: 'items', label: '采购明细', group: '表格数据源', type: 'array' },
  ],
  'factory-shipment': [
    { path: 'items', label: '发货明细', group: '表格数据源', type: 'array' },
  ],
  'delivery-note': [
    { path: 'items', label: '发货明细', group: '表格数据源', type: 'array' },
  ],
  'inbound-record': [
    { path: 'items', label: '入库明细', group: '表格数据源', type: 'array' },
  ],
  'return-order': [
    { path: 'items', label: '退货明细', group: '表格数据源', type: 'array' },
  ],
  'finance-monthly-report': [
    { path: 'alerts', label: '风险提醒', group: '表格数据源', type: 'array' },
  ],
  'finance-annual-report': [
    {
      path: 'monthlyTrend',
      label: '月度趋势',
      group: '表格数据源',
      type: 'array',
    },
    {
      path: 'quarterlyData',
      label: '季度表现',
      group: '表格数据源',
      type: 'array',
    },
    {
      path: 'sample.topCustomers',
      label: '样品客户排行',
      group: '表格数据源',
      type: 'array',
    },
    { path: 'alerts', label: '风险提醒', group: '表格数据源', type: 'array' },
  ],
  'finance-profit-loss-report': [
    { path: 'trend', label: '趋势明细', group: '表格数据源', type: 'array' },
    { path: 'alerts', label: '经营提醒', group: '表格数据源', type: 'array' },
  ],
};

// 字段注册表 (按模板类型)
export const fieldRegistry: Record<string, FieldDefinition[]> = {
  'sales-order': salesOrderFields,
  'purchase-order': purchaseOrderFields,
  'factory-shipment': factoryShipmentFields,
  'delivery-note': deliveryNoteFields,
  'inbound-record': inboundRecordFields,
  'return-order': returnOrderFields,
  'finance-monthly-report': monthlyReportFields,
  'finance-annual-report': annualReportFields,
  'finance-profit-loss-report': profitLossFields,
};

// 表格列字段注册表
export const tableFieldRegistry: Record<string, FieldDefinition[]> = {
  'sales-order': salesOrderItemFields,
  'purchase-order': salesOrderItemFields,
  'factory-shipment': salesOrderItemFields,
  'delivery-note': salesOrderItemFields,
  'inbound-record': salesOrderItemFields,
  'return-order': [
    ...commonItemFields,
    {
      path: 'returnQuantity',
      label: '退货数量',
      group: '退货',
      type: 'number',
      suggestedFormat: 'number',
    },
    {
      path: 'damagedQuantity',
      label: '破损数量',
      group: '退货',
      type: 'number',
      suggestedFormat: 'number',
    },
    {
      path: 'originalQuantity',
      label: '原数量',
      group: '退货',
      type: 'number',
      suggestedFormat: 'number',
    },
    { path: 'reason', label: '退货原因', group: '退货', type: 'string' },
    ...legacyCommonItemFields,
  ],
  'finance-monthly-report': reportAlertFields,
  'finance-annual-report': [
    ...annualTrendFields,
    ...sampleCustomerFields,
    ...reportAlertFields,
  ],
  'finance-profit-loss-report': [
    ...profitLossTrendFields,
    ...reportAlertFields,
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
 * 获取表格数据源字段
 */
export function getArrayFieldsForTemplateType(type: string): FieldDefinition[] {
  return (
    arrayFieldRegistry[type] ?? [
      { path: 'items', label: '明细', group: '表格数据源', type: 'array' },
    ]
  );
}

/**
 * 按组分类字段
 */
export function groupFields(
  fields: FieldDefinition[]
): Record<string, FieldDefinition[]> {
  const groups: Record<string, FieldDefinition[]> = {};
  fields.forEach(f => {
    if (!groups[f.group]) groups[f.group] = [];
    groups[f.group].push(f);
  });
  return groups;
}
