import {
  createTableColumn,
  type PlaceholderElement,
  type PlaceholderFormat,
  type PrintTemplate,
  type TableColumn,
  type TableElement,
  type TableStyle,
  type TemplateType,
  type TextElement,
  type TextStyle,
} from './schemas';

export const SYSTEM_TEMPLATE_RELEASED_AT = '2026-03-15T00:00:00.000Z';

type SystemTemplateType = Exclude<TemplateType, 'custom'>;

const SYSTEM_TEMPLATE_NUMBERS: Record<SystemTemplateType, number> = {
  'sales-order': 101,
  'purchase-order': 102,
  'factory-shipment': 103,
  'delivery-note': 104,
  'inbound-record': 105,
  'return-order': 106,
  'finance-monthly-report': 107,
  'finance-annual-report': 108,
  'finance-profit-loss-report': 109,
};

export const SYSTEM_TEMPLATE_TYPES = Object.keys(
  SYSTEM_TEMPLATE_NUMBERS
) as SystemTemplateType[];

export const SYSTEM_TEMPLATE_IDS: Record<SystemTemplateType, string> =
  Object.fromEntries(
    SYSTEM_TEMPLATE_TYPES.map(type => [
      type,
      stableUuid(SYSTEM_TEMPLATE_NUMBERS[type]),
    ])
  ) as Record<SystemTemplateType, string>;

const BASE_TEXT_STYLE: TextStyle = {
  fontFamily: 'Microsoft YaHei',
  fontSize: 10,
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#111827',
  textAlign: 'left',
  lineHeight: 1.25,
  letterSpacing: 0,
};

const BASE_TABLE_STYLE: TableStyle = {
  headerBgColor: '#f3f4f6',
  headerTextColor: '#111827',
  headerFontSize: 9,
  bodyFontSize: 8.5,
  borderColor: '#d1d5db',
  borderWidth: 0.5,
  rowHeight: 8,
  stripedRows: true,
  stripedColor: '#fafafa',
};

function stableUuid(value: number): string {
  return `00000000-0000-0000-0000-${String(value).padStart(12, '0')}`;
}

function createTextElement(
  id: number,
  content: string,
  x: number,
  y: number,
  width: number,
  height: number,
  style: Partial<TextStyle> = {}
): TextElement {
  return {
    id: stableUuid(id),
    type: 'text',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    content,
    style: {
      ...BASE_TEXT_STYLE,
      ...style,
    },
  };
}

function createPlaceholderElement(
  id: number,
  field: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  format: PlaceholderFormat = 'text',
  style: Partial<TextStyle> = {},
  fallback = '-'
): PlaceholderElement {
  return {
    id: stableUuid(id),
    type: 'placeholder',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    field,
    label,
    format,
    fallback,
    style: {
      ...BASE_TEXT_STYLE,
      ...style,
    },
  };
}

function createTableElement(
  id: number,
  dataSource: string,
  x: number,
  y: number,
  width: number,
  height: number,
  columns: TableColumn[],
  overrides: Partial<
    Pick<TableElement, 'minRows' | 'showSummary' | 'summaryColumns' | 'style'>
  > = {}
): TableElement {
  return {
    id: stableUuid(id),
    type: 'table',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex: 0,
    locked: false,
    visible: true,
    dataSource,
    columns,
    style: {
      ...BASE_TABLE_STYLE,
      ...(overrides.style ?? {}),
    },
    showSummary: overrides.showSummary ?? false,
    summaryColumns: overrides.summaryColumns,
    minRows: overrides.minRows,
  };
}

function createColumn(
  id: string,
  key: string,
  label: string,
  width: number,
  align: TableColumn['align'] = 'left',
  format: TableColumn['format'] = 'text'
): TableColumn {
  return createTableColumn({
    id,
    key,
    label,
    width,
    widthUnit: '%',
    align,
    format,
  });
}

function createLabeledField(
  idBase: number,
  label: string,
  field: string,
  x: number,
  y: number,
  valueWidth: number,
  options: {
    format?: PlaceholderFormat;
    labelWidth?: number;
    valueHeight?: number;
    fallback?: string;
    valueStyle?: Partial<TextStyle>;
    labelStyle?: Partial<TextStyle>;
  } = {}
) {
  const labelWidth = options.labelWidth ?? 20;
  const valueHeight = options.valueHeight ?? 5;

  return [
    createTextElement(idBase, `${label}:`, x, y, labelWidth, valueHeight, {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#4b5563',
      ...(options.labelStyle ?? {}),
    }),
    createPlaceholderElement(
      idBase + 1,
      field,
      label,
      x + labelWidth,
      y,
      valueWidth,
      valueHeight,
      options.format ?? 'text',
      {
        fontSize: 9.5,
        color: '#111827',
        ...(options.valueStyle ?? {}),
      },
      options.fallback ?? '-'
    ),
  ];
}

function createMetricCard(
  idBase: number,
  label: string,
  field: string,
  x: number,
  y: number,
  width: number,
  format: PlaceholderFormat = 'currency'
) {
  return [
    createTextElement(idBase, label, x, y, width, 5, {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#4b5563',
    }),
    createPlaceholderElement(
      idBase + 1,
      field,
      label,
      x,
      y + 5,
      width,
      8,
      format,
      {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111827',
      }
    ),
  ];
}

interface BusinessTemplateConfig {
  type: SystemTemplateType;
  name: string;
  description: string;
  title: string;
  counterpartyFields: Array<{
    label: string;
    field: string;
    format?: PlaceholderFormat;
  }>;
  headerFields: Array<{
    label: string;
    field: string;
    format?: PlaceholderFormat;
  }>;
  tableColumns: TableColumn[];
  footerMetrics: Array<{
    label: string;
    field: string;
    format?: PlaceholderFormat;
  }>;
  remarkField?: string;
}

function createBusinessTemplate(config: BusinessTemplateConfig): PrintTemplate {
  const templateNumber = SYSTEM_TEMPLATE_NUMBERS[config.type] * 100;
  let cursor = templateNumber;
  const elements: PrintTemplate['elements'] = [];

  elements.push(
    createPlaceholderElement(
      cursor++,
      'company.name',
      '公司名称',
      12,
      10,
      80,
      8,
      'text',
      {
        fontFamily: 'SimHei',
        fontSize: 15,
        fontWeight: 'bold',
      }
    )
  );
  elements.push(
    createPlaceholderElement(
      cursor++,
      'company.address',
      '公司地址',
      12,
      19,
      110,
      5,
      'text',
      {
        fontSize: 9,
        color: '#4b5563',
      },
      ''
    )
  );
  elements.push(
    createPlaceholderElement(
      cursor++,
      'company.phone',
      '公司电话',
      12,
      24,
      44,
      5,
      'text',
      {
        fontSize: 9,
        color: '#4b5563',
      },
      ''
    )
  );
  elements.push(
    createPlaceholderElement(
      cursor++,
      'company.fax',
      '公司传真',
      58,
      24,
      44,
      5,
      'text',
      {
        fontSize: 9,
        color: '#4b5563',
      },
      ''
    )
  );
  elements.push(
    createTextElement(cursor++, config.title, 68, 12, 74, 10, {
      fontFamily: 'SimHei',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      color: '#111827',
    })
  );

  config.headerFields.forEach((item, index) => {
    elements.push(
      ...createLabeledField(
        cursor,
        item.label,
        item.field,
        138,
        12 + index * 6.2,
        40,
        {
          format: item.format,
          labelWidth: 18,
          fallback: '',
        }
      )
    );
    cursor += 2;
  });

  config.counterpartyFields.forEach((item, index) => {
    elements.push(
      ...createLabeledField(
        cursor,
        item.label,
        item.field,
        12,
        40 + index * 6.2,
        92,
        {
          format: item.format,
          labelWidth: 22,
          fallback: '',
        }
      )
    );
    cursor += 2;
  });

  elements.push(
    createTableElement(cursor++, 'items', 12, 70, 186, 118, config.tableColumns, {
      minRows: 8,
      showSummary: true,
      summaryColumns: Array.from(
        new Set(
          config.tableColumns
            .filter(column =>
              ['number', 'currency'].includes(column.format ?? 'text')
            )
            .map(column => column.key)
            .filter(key =>
              ['quantity', 'returnQuantity', 'damagedQuantity', 'subtotal'].includes(
                key
              )
            )
        )
      ),
    })
  );

  config.footerMetrics.forEach((item, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = 12 + column * 62;
    const y = 194 + row * 7;

    elements.push(
      ...createLabeledField(cursor, item.label, item.field, x, y, 38, {
        format: item.format,
        labelWidth: 20,
        valueStyle: {
          fontSize: 10,
          fontWeight: 'bold',
        },
      })
    );
    cursor += 2;
  });

  if (config.remarkField) {
    elements.push(
      ...createLabeledField(cursor, '备注说明', config.remarkField, 12, 212, 160, {
        labelWidth: 20,
        valueHeight: 14,
        fallback: '',
        valueStyle: {
          fontSize: 9,
          lineHeight: 1.35,
        },
      })
    );
    cursor += 2;
  }

  elements.push(
    ...createLabeledField(cursor, '制单人', 'operator.name', 12, 232, 40, {
      labelWidth: 18,
      fallback: '',
    })
  );
  cursor += 2;
  elements.push(
    ...createLabeledField(cursor, '打印日期', 'printDate', 74, 232, 44, {
      labelWidth: 18,
      format: 'date_cn',
      fallback: '',
    })
  );
  cursor += 2;
  elements.push(
    createTextElement(cursor++, '客户签收：________________', 136, 232, 62, 5, {
      fontSize: 9,
      fontWeight: 'bold',
      textAlign: 'left',
    })
  );

  return {
    id: SYSTEM_TEMPLATE_IDS[config.type],
    version: 1,
    name: config.name,
    description: config.description,
    type: config.type,
    pageSettings: {
      size: 'A4',
      width: 210,
      height: 297,
      orientation: 'portrait',
      padding: [8, 8, 8, 8],
    },
    elements,
    createdAt: SYSTEM_TEMPLATE_RELEASED_AT,
    updatedAt: SYSTEM_TEMPLATE_RELEASED_AT,
  };
}

function createReportTemplate(
  type: Extract<
    SystemTemplateType,
    | 'finance-monthly-report'
    | 'finance-annual-report'
    | 'finance-profit-loss-report'
  >,
  name: string,
  description: string,
  title: string,
  metricGroups: Array<{
    x: number;
    y: number;
    items: Array<{
      label: string;
      field: string;
      format?: PlaceholderFormat;
      width?: number;
    }>;
  }>,
  tables: Array<{
    title: string;
    dataSource: string;
    x: number;
    y: number;
    width: number;
    height: number;
    columns: TableColumn[];
    minRows?: number;
  }>,
  topFields: Array<{
    label: string;
    field: string;
    format?: PlaceholderFormat;
  }>
): PrintTemplate {
  const templateNumber = SYSTEM_TEMPLATE_NUMBERS[type] * 100;
  let cursor = templateNumber;
  const elements: PrintTemplate['elements'] = [];

  elements.push(
    createTextElement(cursor++, title, 76, 10, 145, 10, {
      fontFamily: 'SimHei',
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
    })
  );

  topFields.forEach((item, index) => {
    elements.push(
      ...createLabeledField(cursor, item.label, item.field, 14 + index * 68, 24, 40, {
        labelWidth: 18,
        format: item.format,
        fallback: '',
      })
    );
    cursor += 2;
  });

  metricGroups.forEach(group => {
    group.items.forEach((item, index) => {
      const x = group.x + index * (item.width ?? 64);
      elements.push(
        ...createMetricCard(
          cursor,
          item.label,
          item.field,
          x,
          group.y,
          (item.width ?? 64) - 6,
          item.format ?? 'currency'
        )
      );
      cursor += 2;
    });
  });

  tables.forEach(table => {
    elements.push(
      createTextElement(cursor++, table.title, table.x, table.y - 6, 80, 4.5, {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#4b5563',
      })
    );
    elements.push(
      createTableElement(
        cursor++,
        table.dataSource,
        table.x,
        table.y,
        table.width,
        table.height,
        table.columns,
        {
          minRows: table.minRows,
          showSummary: false,
        }
      )
    );
  });

  return {
    id: SYSTEM_TEMPLATE_IDS[type],
    version: 1,
    name,
    description,
    type,
    pageSettings: {
      size: 'A4',
      width: 297,
      height: 210,
      orientation: 'landscape',
      padding: [10, 10, 10, 10],
    },
    elements,
    createdAt: SYSTEM_TEMPLATE_RELEASED_AT,
    updatedAt: SYSTEM_TEMPLATE_RELEASED_AT,
  };
}

function buildSalesOrderTemplate() {
  return createBusinessTemplate({
    type: 'sales-order',
    name: '系统默认销售订单模板',
    description: '适合销售订单打印与图片导出的标准版式。',
    title: '销售订单',
    counterpartyFields: [
      { label: '客户名称', field: 'customer.name' },
      { label: '联系电话', field: 'customer.phone' },
      { label: '送货地址', field: 'customer.address' },
      { label: '联系人', field: 'customer.contact' },
    ],
    headerFields: [
      { label: '单据编号', field: 'order.orderNumber' },
      { label: '订单日期', field: 'order.createdAt', format: 'date_cn' },
      { label: '订单状态', field: 'order.status' },
      { label: '交货日期', field: 'order.deliveryDate', format: 'date_cn' },
    ],
    tableColumns: [
      createColumn('so-name', 'name', '产品名称', 24),
      createColumn('so-code', 'code', '编码', 14),
      createColumn('so-spec', 'spec', '规格', 18),
      createColumn('so-unit', 'unit', '单位', 8, 'center'),
      createColumn('so-qty', 'quantity', '数量', 10, 'right', 'number'),
      createColumn('so-price', 'unitPrice', '单价', 12, 'right', 'currency'),
      createColumn('so-subtotal', 'subtotal', '金额', 14, 'right', 'currency'),
    ],
    footerMetrics: [
      { label: '总数量', field: 'totalQuantity', format: 'number' },
      { label: '总重量', field: 'totalWeight', format: 'number' },
      { label: '总件数', field: 'totalBoxes', format: 'number' },
      { label: '总金额', field: 'totalAmount', format: 'currency' },
      { label: '大写金额', field: 'totalAmountCap', format: 'currency_cap' },
    ],
    remarkField: 'order.remark',
  });
}

function buildPurchaseOrderTemplate() {
  return createBusinessTemplate({
    type: 'purchase-order',
    name: '系统默认采购订单模板',
    description: '适合采购下单、到货跟踪与图片导出的标准版式。',
    title: '采购订单',
    counterpartyFields: [
      { label: '供应商名称', field: 'supplier.name' },
      { label: '联系电话', field: 'supplier.phone' },
      { label: '供应商地址', field: 'supplier.address' },
      { label: '供应商编码', field: 'supplier.supplierCode' },
    ],
    headerFields: [
      { label: '单据编号', field: 'order.orderNumber' },
      { label: '采购日期', field: 'order.createdAt', format: 'date_cn' },
      { label: '状态', field: 'order.status' },
      { label: '柜号', field: 'order.containerNumber' },
    ],
    tableColumns: [
      createColumn('po-name', 'name', '产品名称', 26),
      createColumn('po-code', 'code', '编码', 14),
      createColumn('po-spec', 'spec', '规格', 18),
      createColumn('po-unit', 'unit', '单位', 8, 'center'),
      createColumn('po-qty', 'quantity', '数量', 10, 'right', 'number'),
      createColumn('po-price', 'unitPrice', '单价', 12, 'right', 'currency'),
      createColumn('po-subtotal', 'subtotal', '金额', 12, 'right', 'currency'),
    ],
    footerMetrics: [
      { label: '发货日期', field: 'order.shipmentDate', format: 'date_cn' },
      { label: '预计到港', field: 'order.estimatedArrival', format: 'date_cn' },
      { label: '到港日期', field: 'order.arrivalDate', format: 'date_cn' },
      { label: '总数量', field: 'totalQuantity', format: 'number' },
      { label: '采购总额', field: 'totalAmount', format: 'currency' },
    ],
    remarkField: 'order.remark',
  });
}

function buildFactoryShipmentTemplate() {
  return createBusinessTemplate({
    type: 'factory-shipment',
    name: '系统默认厂家发货模板',
    description: '适合厂家发货单、物流跟踪单与图片导出的标准版式。',
    title: '厂家发货单',
    counterpartyFields: [
      { label: '客户名称', field: 'customer.name' },
      { label: '联系电话', field: 'customer.phone' },
      { label: '送货地址', field: 'customer.address' },
    ],
    headerFields: [
      { label: '单据编号', field: 'order.orderNumber' },
      { label: '创建日期', field: 'order.createdAt', format: 'date_cn' },
      { label: '船运公司', field: 'order.shippingCompany' },
      { label: '提货日期', field: 'order.deliveryDate', format: 'date_cn' },
    ],
    tableColumns: [
      createColumn('fs-name', 'name', '产品名称', 26),
      createColumn('fs-code', 'code', '编码', 14),
      createColumn('fs-spec', 'spec', '规格', 18),
      createColumn('fs-unit', 'unit', '单位', 8, 'center'),
      createColumn('fs-qty', 'quantity', '数量', 10, 'right', 'number'),
      createColumn('fs-batch', 'batchNumber', '批次', 12),
      createColumn('fs-subtotal', 'subtotal', '金额', 12, 'right', 'currency'),
    ],
    footerMetrics: [
      { label: '发货日期', field: 'order.shipmentDate', format: 'date_cn' },
      { label: '预计到港', field: 'order.estimatedArrival', format: 'date_cn' },
      { label: '总数量', field: 'totalQuantity', format: 'number' },
      { label: '总金额', field: 'totalAmount', format: 'currency' },
    ],
    remarkField: 'order.remark',
  });
}

function buildDeliveryNoteTemplate() {
  return createBusinessTemplate({
    type: 'delivery-note',
    name: '系统默认发货单模板',
    description: '适合出库发货、司机随货单与图片导出的标准版式。',
    title: '发货单',
    counterpartyFields: [
      { label: '客户名称', field: 'customer.name' },
      { label: '联系电话', field: 'customer.phone' },
      { label: '送货地址', field: 'customer.address' },
    ],
    headerFields: [
      { label: '发货单号', field: 'order.orderNumber' },
      { label: '出库日期', field: 'order.createdAt', format: 'date_cn' },
      { label: '来源订单', field: 'order.sourceOrderNumber' },
      { label: '出库类型', field: 'order.status' },
    ],
    tableColumns: [
      createColumn('dn-name', 'name', '产品名称', 28),
      createColumn('dn-spec', 'spec', '规格', 18),
      createColumn('dn-unit', 'unit', '单位', 8, 'center'),
      createColumn('dn-qty', 'quantity', '数量', 12, 'right', 'number'),
      createColumn('dn-batch', 'batchNumber', '批次', 16),
      createColumn('dn-subtotal', 'subtotal', '金额', 18, 'right', 'currency'),
    ],
    footerMetrics: [
      { label: '总数量', field: 'totalQuantity', format: 'number' },
      { label: '总金额', field: 'totalAmount', format: 'currency' },
    ],
    remarkField: 'order.remark',
  });
}

function buildInboundRecordTemplate() {
  return createBusinessTemplate({
    type: 'inbound-record',
    name: '系统默认入库记录模板',
    description: '适合仓库进货、到货验收与图片导出的标准版式。',
    title: '入库记录',
    counterpartyFields: [
      { label: '供应商名称', field: 'supplier.name' },
      { label: '联系电话', field: 'supplier.phone' },
      { label: '供应商地址', field: 'supplier.address' },
      { label: '库位', field: 'order.location' },
    ],
    headerFields: [
      { label: '入库单号', field: 'order.orderNumber' },
      { label: '入库日期', field: 'order.createdAt', format: 'date_cn' },
      { label: '入库原因', field: 'order.reason' },
      { label: '批次号', field: 'product.batchNumber' },
    ],
    tableColumns: [
      createColumn('ib-name', 'name', '产品名称', 30),
      createColumn('ib-code', 'code', '编码', 14),
      createColumn('ib-spec', 'spec', '规格', 18),
      createColumn('ib-batch', 'batchNumber', '批次', 18),
      createColumn('ib-unit', 'unit', '单位', 8, 'center'),
      createColumn('ib-qty', 'quantity', '数量', 12, 'right', 'number'),
    ],
    footerMetrics: [
      { label: '产品编码', field: 'product.code' },
      { label: '产品名称', field: 'product.name' },
      { label: '入库数量', field: 'quantity', format: 'number' },
    ],
    remarkField: 'order.remark',
  });
}

function buildReturnOrderTemplate() {
  return createBusinessTemplate({
    type: 'return-order',
    name: '系统默认退货订单模板',
    description: '适合退货、退款与售后打印的标准版式。',
    title: '退货订单',
    counterpartyFields: [
      { label: '客户名称', field: 'customer.name' },
      { label: '联系电话', field: 'customer.phone' },
      { label: '客户地址', field: 'customer.address' },
      { label: '关联销售单', field: 'salesOrder.orderNumber' },
    ],
    headerFields: [
      { label: '退货单号', field: 'order.orderNumber' },
      { label: '创建日期', field: 'order.createdAt', format: 'date_cn' },
      { label: '退货类型', field: 'order.type' },
      { label: '处理方式', field: 'order.processType' },
    ],
    tableColumns: [
      createColumn('rt-name', 'name', '产品名称', 22),
      createColumn('rt-spec', 'spec', '规格', 14),
      createColumn('rt-unit', 'unit', '单位', 8, 'center'),
      createColumn(
        'rt-return-qty',
        'returnQuantity',
        '退货数',
        12,
        'right',
        'number'
      ),
      createColumn(
        'rt-damaged-qty',
        'damagedQuantity',
        '破损数',
        12,
        'right',
        'number'
      ),
      createColumn('rt-subtotal', 'subtotal', '金额', 16, 'right', 'currency'),
      createColumn('rt-reason', 'reason', '原因', 16),
    ],
    footerMetrics: [
      { label: '退货总额', field: 'totalAmount', format: 'currency' },
      { label: '退款金额', field: 'refundAmount', format: 'currency' },
      { label: '订单状态', field: 'order.status' },
    ],
    remarkField: 'order.remark',
  });
}

function buildMonthlyReportTemplate() {
  return createReportTemplate(
    'finance-monthly-report',
    '系统默认月度报表模板',
    '适合月度经营汇总、财务复盘与图片导出的标准版式。',
    '月度经营报表',
    [
      {
        x: 14,
        y: 40,
        items: [
          { label: '销售收入', field: 'revenue.salesRevenue' },
          { label: '营业总成本', field: 'costs.totalCost' },
          { label: '期间费用', field: 'expenses.totalExpenses' },
          { label: '净利润', field: 'profit.netProfit' },
        ],
      },
      {
        x: 14,
        y: 58,
        items: [
          {
            label: '利润率(%)',
            field: 'profit.profitMargin',
            format: 'number',
          },
          {
            label: '毛利率(%)',
            field: 'profit.grossProfitMargin',
            format: 'number',
          },
          {
            label: '应收余额',
            field: 'receivables.receivableBalance',
          },
          {
            label: '应付余额',
            field: 'receivables.payableBalance',
          },
        ],
      },
      {
        x: 14,
        y: 76,
        items: [
          { label: '运费', field: 'expenses.byType.shipping' },
          { label: '人工费', field: 'expenses.byType.labor' },
          { label: '装卸费', field: 'expenses.byType.loading_unloading' },
          {
            label: '库存周转天数',
            field: 'inventoryTurnover.turnoverDays',
            format: 'number',
          },
        ],
      },
      {
        x: 14,
        y: 94,
        items: [
          {
            label: '收入环比(%)',
            field: 'comparison.revenue.changeRate',
            format: 'number',
          },
          {
            label: '利润环比(%)',
            field: 'comparison.profit.changeRate',
            format: 'number',
          },
          {
            label: '费用环比(%)',
            field: 'comparison.expenses.changeRate',
            format: 'number',
          },
          {
            label: '订单数',
            field: 'revenue.orderCount',
            format: 'number',
          },
        ],
      },
    ],
    [
      {
        title: '风险与经营提醒',
        dataSource: 'alerts',
        x: 14,
        y: 130,
        width: 269,
        height: 42,
        minRows: 3,
        columns: [
          createColumn('mr-alert-type', 'type', '级别', 12),
          createColumn('mr-alert-title', 'title', '标题', 24),
          createColumn('mr-alert-message', 'message', '内容', 64),
        ],
      },
    ],
    [
      { label: '统计周期', field: 'period.label' },
      { label: '导出日期', field: 'reportMeta.exportDate', format: 'date_cn' },
      { label: '报表年度', field: 'reportMeta.year', format: 'number' },
      { label: '报表月份', field: 'reportMeta.month', format: 'number' },
    ]
  );
}

function buildAnnualReportTemplate() {
  return createReportTemplate(
    'finance-annual-report',
    '系统默认年度报表模板',
    '适合年度经营汇总、趋势复盘与图片导出的标准版式。',
    '年度经营报表',
    [
      {
        x: 14,
        y: 40,
        items: [
          { label: '年度收入', field: 'summary.totalRevenue' },
          { label: '年度利润', field: 'summary.totalProfit' },
          { label: '年度成本', field: 'summary.totalCost' },
          { label: '年度费用', field: 'summary.totalExpenses' },
        ],
      },
      {
        x: 14,
        y: 58,
        items: [
          {
            label: '利润率(%)',
            field: 'summary.profitMargin',
            format: 'number',
          },
          {
            label: '订单总数',
            field: 'summary.orderCount',
            format: 'number',
          },
          {
            label: '月均收入',
            field: 'summary.averageMonthlyRevenue',
          },
          {
            label: '库存周转率',
            field: 'inventoryTurnover.turnoverRate',
            format: 'number',
          },
        ],
      },
    ],
    [
      {
        title: '月度趋势',
        dataSource: 'monthlyTrend',
        x: 14,
        y: 90,
        width: 269,
        height: 46,
        minRows: 4,
        columns: [
          createColumn('ar-month', 'monthLabel', '月份', 14),
          createColumn('ar-revenue', 'revenue', '收入', 22, 'right', 'currency'),
          createColumn('ar-cost', 'cost', '成本', 22, 'right', 'currency'),
          createColumn(
            'ar-expenses',
            'expenses',
            '费用',
            18,
            'right',
            'currency'
          ),
          createColumn('ar-profit', 'profit', '利润', 22, 'right', 'currency'),
          createColumn(
            'ar-orders',
            'orderCount',
            '订单数',
            12,
            'right',
            'number'
          ),
        ],
      },
      {
        title: '季度表现',
        dataSource: 'quarterlyData',
        x: 14,
        y: 146,
        width: 269,
        height: 28,
        minRows: 2,
        columns: [
          createColumn('ar-quarter', 'quarterLabel', '季度', 16),
          createColumn('ar-q-revenue', 'revenue', '收入', 24, 'right', 'currency'),
          createColumn('ar-q-profit', 'profit', '利润', 24, 'right', 'currency'),
          createColumn(
            'ar-q-margin',
            'profitMargin',
            '利润率(%)',
            18,
            'right',
            'number'
          ),
          createColumn('ar-q-expenses', 'expenses', '费用', 18, 'right', 'currency'),
        ],
      },
    ],
    [
      { label: '统计年度', field: 'period.label' },
      { label: '导出日期', field: 'reportMeta.exportDate', format: 'date_cn' },
      { label: '同比收入(%)', field: 'yearOverYear.revenue.changeRate', format: 'number' },
      { label: '同比利润(%)', field: 'yearOverYear.profit.changeRate', format: 'number' },
    ]
  );
}

function buildProfitLossTemplate() {
  return createReportTemplate(
    'finance-profit-loss-report',
    '系统默认盈亏分析模板',
    '适合盈亏分析、利润复盘与图片导出的标准版式。',
    '盈亏分析报告',
    [
      {
        x: 14,
        y: 40,
        items: [
          { label: '总收入', field: 'revenue.totalRevenue' },
          { label: '总成本', field: 'costs.totalCost' },
          { label: '总费用', field: 'expenses.totalExpenses' },
          { label: '净利润', field: 'profit.netProfit' },
        ],
      },
      {
        x: 14,
        y: 58,
        items: [
          {
            label: '净利率(%)',
            field: 'profit.netProfitMargin',
            format: 'number',
          },
          {
            label: '毛利率(%)',
            field: 'profit.grossProfitMargin',
            format: 'number',
          },
          {
            label: '直发利润',
            field: 'factoryShipmentProfit.customerProfit',
          },
          {
            label: '利润贡献(%)',
            field: 'factoryShipmentProfit.percentageOfTotal',
            format: 'number',
          },
        ],
      },
      {
        x: 14,
        y: 76,
        items: [
          { label: '运费', field: 'expenses.shipping' },
          { label: '人工费', field: 'expenses.labor' },
          {
            label: '收入变化(%)',
            field: 'comparison.revenue.changeRate',
            format: 'number',
          },
          {
            label: '利润变化(%)',
            field: 'comparison.profit.changeRate',
            format: 'number',
          },
        ],
      },
    ],
    [
      {
        title: '趋势明细',
        dataSource: 'trend',
        x: 14,
        y: 112,
        width: 269,
        height: 32,
        minRows: 3,
        columns: [
          createColumn('pl-date', 'dateLabel', '时间', 14),
          createColumn('pl-revenue', 'revenue', '收入', 22, 'right', 'currency'),
          createColumn('pl-cost', 'cost', '成本', 22, 'right', 'currency'),
          createColumn('pl-expense', 'expense', '费用', 18, 'right', 'currency'),
          createColumn('pl-profit', 'profit', '利润', 22, 'right', 'currency'),
        ],
      },
      {
        title: '经营提醒',
        dataSource: 'alerts',
        x: 14,
        y: 154,
        width: 269,
        height: 22,
        minRows: 2,
        columns: [
          createColumn('pl-alert-type', 'type', '级别', 12),
          createColumn('pl-alert-title', 'title', '标题', 24),
          createColumn('pl-alert-message', 'message', '内容', 64),
        ],
      },
    ],
    [
      { label: '统计周期', field: 'period.label' },
      { label: '导出日期', field: 'reportMeta.exportDate', format: 'date_cn' },
      { label: '起始日期', field: 'reportMeta.startDate', format: 'date_cn' },
      { label: '结束日期', field: 'reportMeta.endDate', format: 'date_cn' },
    ]
  );
}

const SYSTEM_TEMPLATE_BUILDERS: Record<SystemTemplateType, () => PrintTemplate> = {
  'sales-order': buildSalesOrderTemplate,
  'purchase-order': buildPurchaseOrderTemplate,
  'factory-shipment': buildFactoryShipmentTemplate,
  'delivery-note': buildDeliveryNoteTemplate,
  'inbound-record': buildInboundRecordTemplate,
  'return-order': buildReturnOrderTemplate,
  'finance-monthly-report': buildMonthlyReportTemplate,
  'finance-annual-report': buildAnnualReportTemplate,
  'finance-profit-loss-report': buildProfitLossTemplate,
};

export function isSystemTemplateType(type: string): type is SystemTemplateType {
  return SYSTEM_TEMPLATE_TYPES.includes(type as SystemTemplateType);
}

export function isSystemTemplateId(id: string): boolean {
  return Object.values(SYSTEM_TEMPLATE_IDS).includes(id);
}

export function getSystemTemplate(type: string): PrintTemplate | null {
  if (!isSystemTemplateType(type)) {
    return null;
  }

  return SYSTEM_TEMPLATE_BUILDERS[type]();
}

export function getSystemTemplateById(id: string): PrintTemplate | null {
  const entry = Object.entries(SYSTEM_TEMPLATE_IDS).find(
    ([, templateId]) => templateId === id
  );

  if (!entry) {
    return null;
  }

  return getSystemTemplate(entry[0]);
}

export function listSystemTemplates(type?: string): PrintTemplate[] {
  if (type) {
    const template = getSystemTemplate(type);
    return template ? [template] : [];
  }

  return SYSTEM_TEMPLATE_TYPES.map(templateType =>
    SYSTEM_TEMPLATE_BUILDERS[templateType]()
  );
}
