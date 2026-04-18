import {
  getArrayFieldsForTemplateType,
  getFieldsForTemplateType,
  getTableFieldsForTemplateType,
  type FieldDefinition,
} from '@/lib/print-designer/field-registry';
import {
  createDefaultTableElement,
  createDefaultLineElement,
  createTableColumn,
  type DesignElement,
  type PlaceholderFormat,
  type TableColumn,
  type TemplateType,
  type TextStyle,
} from '@/lib/print-designer/schemas';
import { getTemplateTypeLabel } from '@/lib/print-designer/template-meta';

export type QuickLayoutPresetKey =
  | 'document-header'
  | 'document-info'
  | 'detail-table'
  | 'signature-row';

export interface QuickLayoutPresetDefinition {
  key: QuickLayoutPresetKey;
  label: string;
  description: string;
}

const BASE_TEXT_STYLE: TextStyle = {
  fontFamily: 'Microsoft YaHei',
  fontSize: 10,
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#0f172a',
  textAlign: 'left',
  lineHeight: 1.25,
  letterSpacing: 0,
};

const HEADER_PRESET: QuickLayoutPresetDefinition = {
  key: 'document-header',
  label: '单据抬头',
  description: '标题、公司信息、单号和打印日期一次放好',
};

const INFO_PRESET: QuickLayoutPresetDefinition = {
  key: 'document-info',
  label: '基础信息',
  description: '客户/供应商和单据关键信息两列排好',
};

const TABLE_PRESET: QuickLayoutPresetDefinition = {
  key: 'detail-table',
  label: '明细表格',
  description: '常用列宽和顺序直接可用，后面再微调',
};

const SIGNATURE_PRESET: QuickLayoutPresetDefinition = {
  key: 'signature-row',
  label: '签字栏',
  description: '制单、审核、签收区域先放上，适合中文单据',
};

const SAFE_PLACEHOLDER_FORMATS = new Set<PlaceholderFormat>([
  'text',
  'date_cn',
  'currency',
  'currency_cap',
  'number',
]);

const PRIORITY_TABLE_COLUMNS = [
  'code',
  'name',
  'spec',
  'unit',
  'quantity',
  'unitPrice',
  'subtotal',
  'batchNumber',
  'remark',
];

function createId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `print_preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickField(
  fields: FieldDefinition[],
  candidatePaths: string[]
): FieldDefinition | undefined {
  return candidatePaths
    .map(path => fields.find(field => field.path === path))
    .find((field): field is FieldDefinition => Boolean(field));
}

function pickFields(
  fields: FieldDefinition[],
  candidatePaths: string[],
  limit: number
): FieldDefinition[] {
  const picked: FieldDefinition[] = [];
  const used = new Set<string>();

  candidatePaths.forEach(path => {
    const matchedField = fields.find(field => field.path === path);
    if (matchedField && !used.has(matchedField.path) && picked.length < limit) {
      picked.push(matchedField);
      used.add(matchedField.path);
    }
  });

  return picked;
}

function resolvePlaceholderFormat(field?: FieldDefinition): PlaceholderFormat {
  if (
    field?.suggestedFormat &&
    SAFE_PLACEHOLDER_FORMATS.has(field.suggestedFormat as PlaceholderFormat)
  ) {
    return field.suggestedFormat as PlaceholderFormat;
  }

  return 'text';
}

function createTextElement(
  content: string,
  x: number,
  y: number,
  width: number,
  height: number,
  style: Partial<TextStyle> = {},
  zIndex = 0
): DesignElement {
  return {
    id: createId(),
    type: 'text',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex,
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
  field: FieldDefinition,
  x: number,
  y: number,
  width: number,
  height: number,
  style: Partial<TextStyle> = {},
  format?: PlaceholderFormat,
  fallback = '',
  zIndex = 0
): DesignElement {
  return {
    id: createId(),
    type: 'placeholder',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex,
    locked: false,
    visible: true,
    field: field.path,
    label: field.label,
    format: format ?? resolvePlaceholderFormat(field),
    fallback,
    style: {
      ...BASE_TEXT_STYLE,
      ...style,
    },
  };
}

function createLabeledFieldElements(
  field: FieldDefinition,
  x: number,
  y: number,
  width: number,
  labelWidth = 18
): DesignElement[] {
  return [
    createTextElement(`${field.label}：`, x, y, labelWidth, 5, {
      fontSize: 9,
      fontWeight: 'bold',
      color: '#475569',
    }),
    createPlaceholderElement(
      field,
      x + labelWidth,
      y,
      Math.max(10, width - labelWidth),
      5,
      {
        fontSize: 9.5,
      },
      undefined,
      ''
    ),
  ];
}

function createSignatureLineElement(
  x: number,
  y: number,
  width: number
): DesignElement {
  const lineElement = createDefaultLineElement(createId(), { x, y });
  lineElement.size = { width, height: 2 };
  lineElement.style = {
    color: '#64748b',
    strokeWidth: 0.6,
    dashStyle: 'solid',
  };

  return lineElement;
}

function getInfoPresetFields(templateType: TemplateType): FieldDefinition[] {
  const fields = getFieldsForTemplateType(templateType);

  return pickFields(
    fields,
    [
      'customer.name',
      'supplier.name',
      'customer.phone',
      'supplier.phone',
      'customer.address',
      'supplier.address',
      'order.createdAt',
      'order.deliveryDate',
      'order.status',
      'order.containerNumber',
      'order.location',
      'salesOrder.orderNumber',
      'totalAmount',
      'totalQuantity',
      'refundAmount',
      'period.label',
      'reportMeta.exportDate',
      'summary.totalRevenue',
      'summary.totalProfit',
    ],
    6
  );
}

function getSignatureLabels(templateType: TemplateType): string[] {
  if (templateType.startsWith('finance-')) {
    return ['制表', '审核', '负责人'];
  }

  if (templateType === 'inbound-record') {
    return ['制单', '收货确认', '仓库确认'];
  }

  if (templateType === 'purchase-order') {
    return ['制单', '采购确认', '仓库确认'];
  }

  return ['制单', '业务确认', '客户签收'];
}

function buildDocumentHeaderPreset(
  templateType: TemplateType
): DesignElement[] {
  const fields = getFieldsForTemplateType(templateType);
  const templateLabel = getTemplateTypeLabel(templateType);
  const companyNameField = pickField(fields, ['company.name']);
  const companyPhoneField = pickField(fields, ['company.phone']);
  const companyAddressField = pickField(fields, ['company.address']);
  const orderNumberField = pickField(fields, [
    'order.orderNumber',
    'period.label',
  ]);
  const statusField = pickField(fields, ['order.status']);
  const printDateField = pickField(fields, [
    'printDate',
    'reportMeta.exportDate',
    'order.createdAt',
  ]);

  const elements: DesignElement[] = [
    createTextElement(templateLabel, 48, 0, 94, 10, {
      fontSize: 16,
      fontWeight: 'bold',
      textAlign: 'center',
      color: '#111827',
    }),
  ];

  if (companyNameField) {
    elements.push(
      createPlaceholderElement(companyNameField, 0, 0, 86, 6, {
        fontSize: 12,
        fontWeight: 'bold',
      })
    );
  }

  if (companyPhoneField) {
    elements.push(
      ...createLabeledFieldElements(companyPhoneField, 0, 7, 72, 16)
    );
  }

  if (companyAddressField) {
    elements.push(
      ...createLabeledFieldElements(companyAddressField, 0, 13, 108, 16)
    );
  }

  if (orderNumberField) {
    elements.push(
      ...createLabeledFieldElements(orderNumberField, 126, 2, 64, 20)
    );
  }

  if (statusField) {
    elements.push(...createLabeledFieldElements(statusField, 126, 8, 64, 20));
  }

  if (printDateField) {
    elements.push(
      ...createLabeledFieldElements(printDateField, 126, 14, 64, 20)
    );
  }

  return elements;
}

function buildDocumentInfoPreset(templateType: TemplateType): DesignElement[] {
  const infoFields = getInfoPresetFields(templateType);
  const elements: DesignElement[] = [];

  infoFields.forEach((field, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = column === 0 ? 0 : 98;
    const y = 28 + row * 7;
    elements.push(...createLabeledFieldElements(field, x, y, 92, 18));
  });

  return elements;
}

function buildDetailTablePreset(templateType: TemplateType): DesignElement[] {
  const dataSourceField = getArrayFieldsForTemplateType(templateType)[0] ?? {
    path: 'items',
    label: '明细',
    group: '表格数据源',
    type: 'array' as const,
  };
  const availableColumns = getTableFieldsForTemplateType(templateType);
  const selectedColumns = pickFields(
    availableColumns,
    PRIORITY_TABLE_COLUMNS,
    6
  );
  const fallbackColumns = availableColumns
    .filter(
      field =>
        !selectedColumns.some(
          selectedField => selectedField.path === field.path
        )
    )
    .slice(0, Math.max(0, 6 - selectedColumns.length));

  const finalColumns = [...selectedColumns, ...fallbackColumns];

  const widthByPath: Record<string, number> = {
    code: 16,
    name: 24,
    spec: 20,
    unit: 8,
    quantity: 10,
    unitPrice: 11,
    subtotal: 11,
    batchNumber: 14,
    remark: 16,
  };

  const alignByType: Record<FieldDefinition['type'], TableColumn['align']> = {
    string: 'left',
    number: 'right',
    date: 'center',
    boolean: 'center',
    array: 'left',
  };

  const tableElement = createDefaultTableElement(createId(), {
    x: 0,
    y: 56,
  });

  tableElement.size = { width: 190, height: 96 };
  tableElement.dataSource = dataSourceField.path;
  tableElement.columns = finalColumns.map(field =>
    createTableColumn({
      key: field.path,
      label: field.label,
      width: widthByPath[field.path] ?? 14,
      widthUnit: '%',
      align: alignByType[field.type],
      format:
        field.suggestedFormat === 'currency' ||
        field.suggestedFormat === 'number' ||
        field.suggestedFormat === 'date_cn'
          ? field.suggestedFormat
          : 'text',
    })
  );
  tableElement.minRows = 8;
  tableElement.showSummary = finalColumns.some(field =>
    ['subtotal', 'totalAmount', 'quantity'].includes(field.path)
  );
  tableElement.summaryColumns = tableElement.columns
    .filter(column => ['quantity', 'subtotal'].includes(column.key))
    .map(column => column.key);

  return [tableElement];
}

function buildSignatureRowPreset(templateType: TemplateType): DesignElement[] {
  const fields = getFieldsForTemplateType(templateType);
  const operatorField = pickField(fields, ['operator.name']);
  const printDateField = pickField(fields, ['printDate']);
  const labels = getSignatureLabels(templateType);
  const elements: DesignElement[] = [];

  labels.forEach((label, index) => {
    const x = index * 62;
    elements.push(
      createTextElement(`${label}：`, x, 160, 22, 6, {
        fontSize: 10,
        fontWeight: 'bold',
      })
    );

    if (index === 0 && operatorField) {
      elements.push(
        createPlaceholderElement(operatorField, x + 18, 160, 34, 6, {
          fontSize: 10,
        })
      );
      return;
    }

    elements.push(createSignatureLineElement(x + 18, 164, 34));
  });

  if (printDateField) {
    elements.push(...createLabeledFieldElements(printDateField, 126, 168, 64));
  }

  return elements;
}

export function getQuickLayoutPresets(
  templateType: TemplateType
): QuickLayoutPresetDefinition[] {
  const fields = getFieldsForTemplateType(templateType);
  const hasInfoPreset = getInfoPresetFields(templateType).length > 0;
  const hasTablePreset =
    getArrayFieldsForTemplateType(templateType).length > 0 &&
    getTableFieldsForTemplateType(templateType).length > 0;
  const hasSignaturePreset =
    Boolean(pickField(fields, ['operator.name', 'printDate'])) ||
    !templateType.startsWith('finance-');

  return [
    HEADER_PRESET,
    ...(hasInfoPreset ? [INFO_PRESET] : []),
    ...(hasTablePreset ? [TABLE_PRESET] : []),
    ...(hasSignaturePreset ? [SIGNATURE_PRESET] : []),
  ];
}

export function createQuickLayoutElements(
  templateType: TemplateType,
  presetKey: QuickLayoutPresetKey
): DesignElement[] {
  switch (presetKey) {
    case 'document-header':
      return buildDocumentHeaderPreset(templateType);
    case 'document-info':
      return buildDocumentInfoPreset(templateType);
    case 'detail-table':
      return buildDetailTablePreset(templateType);
    case 'signature-row':
      return buildSignatureRowPreset(templateType);
    default:
      return [];
  }
}
