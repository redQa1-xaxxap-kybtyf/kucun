import {
  getRecommendedFieldsForTemplateType,
  getTableFieldsForTemplateType,
  type FieldDefinition,
} from './field-registry';
import {
  createTableColumn,
  type RowNumberMode,
  type TableColumn,
} from './schemas';

export interface TableColumnPreset {
  key: 'recommended' | 'compact' | 'standard' | 'warehouse';
  label: string;
  description: string;
  columns: TableColumn[];
}

export interface TableColumnQuickInsertPreset {
  key: string;
  label: string;
  description: string;
  fields: FieldDefinition[];
}

export const TABLE_ROW_NUMBER_KEY = '__rowNumber';
export type TableColumnLabelMode = 'canonical' | 'piece' | 'item';
export type TableDocumentLabelPresetKey =
  | 'delivery-note'
  | 'statement'
  | 'loading-list';

export interface TableDocumentLabelPreset {
  key: TableDocumentLabelPresetKey;
  label: string;
  description: string;
}

interface PresetSeed {
  key: Exclude<TableColumnPreset['key'], 'recommended'>;
  label: string;
  description: string;
  candidatePaths: string[];
  minColumns: number;
}

interface QuickInsertSeed {
  key: string;
  label: string;
  description: string;
  candidatePaths: string[];
  minColumns: number;
}

const SUPPORTED_COLUMN_FORMATS = new Set<TableColumn['format']>([
  'text',
  'number',
  'currency',
  'date_cn',
]);

const WIDTH_WEIGHT_BY_KEY: Record<string, number> = {
  code: 12,
  sku: 12,
  no: 10,
  rownumber: 7,
  sequence: 8,
  name: 24,
  title: 22,
  message: 30,
  spec: 16,
  model: 16,
  unit: 8,
  type: 12,
  level: 12,
  quantity: 11,
  piecesperunit: 12,
  subtotal: 15,
  totalprice: 15,
  total: 15,
  totalamount: 15,
  amount: 15,
  unitprice: 13,
  price: 13,
  monthlabel: 14,
  quarterlabel: 14,
  batchnumber: 14,
  warehousename: 14,
  locationname: 12,
  colorno: 12,
  grade: 10,
  suppliername: 18,
  customername: 18,
  returnquantity: 11,
  damagedquantity: 11,
  originalquantity: 11,
  remark: 18,
  remarks: 18,
  reason: 18,
  note: 18,
  weight: 12,
  area: 12,
  content: 26,
};

const COLUMN_PLACEMENT_PRIORITY_BY_KEY: Record<string, number> = {
  rownumber: 0,
  code: 10,
  productcode: 10,
  sku: 10,
  name: 20,
  productname: 20,
  title: 22,
  spec: 30,
  specification: 30,
  model: 31,
  colorno: 32,
  grade: 33,
  unit: 34,
  quantity: 50,
  totalquantity: 50,
  boxes: 52,
  totalboxes: 52,
  pieces: 54,
  sheets: 54,
  piecesperunit: 56,
  batchpiecesperunit: 56,
  area: 58,
  weight: 60,
  returnquantity: 62,
  damagedquantity: 64,
  originalquantity: 66,
  batchnumber: 70,
  warehousename: 72,
  locationname: 74,
  suppliername: 76,
  customername: 76,
  unitprice: 80,
  price: 80,
  subtotal: 82,
  totalprice: 82,
  amount: 82,
  totalamount: 82,
  total: 82,
  remark: 90,
  remarks: 90,
  note: 90,
  reason: 92,
  message: 94,
};

const SUMMARY_LABEL_KEYWORDS = [
  '数量',
  '金额',
  '合计',
  '总额',
  '件数',
  '片数',
  '重量',
  '箱数',
  '平方',
];

const SUMMARY_KEY_KEYWORDS = [
  'quantity',
  'subtotal',
  'total',
  'amount',
  'boxes',
  'pieces',
  'sheets',
  'weight',
  'area',
];

const SUMMARY_EXCLUDED_KEYWORDS = ['unitprice', 'price'];
const SUMMARY_EXCLUDED_LABELS = ['单价', '均价'];
const CANONICAL_LABEL_BY_KEY: Record<string, string> = {
  rownumber: '序号',
  code: '编码',
  productcode: '编码',
  sku: '编码',
  name: '名称',
  productname: '名称',
  title: '标题',
  spec: '规格',
  specification: '规格',
  model: '型号',
  unit: '单位',
  quantity: '数量',
  totalquantity: '总数量',
  piecesperunit: '每件片数',
  batchpiecesperunit: '每件片数',
  unitprice: '单价',
  price: '单价',
  subtotal: '金额',
  totalprice: '金额',
  amount: '金额',
  totalamount: '金额',
  total: '金额',
  batchnumber: '批次号',
  warehousename: '仓库',
  locationname: '库位',
  colorno: '色号',
  grade: '等级',
  suppliername: '供应商',
  customername: '客户',
  returnquantity: '退货数量',
  damagedquantity: '破损数量',
  originalquantity: '原数量',
  remark: '备注',
  remarks: '备注',
  reason: '原因',
  note: '备注',
  type: '类型',
  level: '级别',
  message: '内容',
  monthlabel: '月份',
  quarterlabel: '季度',
  boxes: '件数',
  totalboxes: '件数',
  pieces: '片数',
  sheets: '片数',
  weight: '重量',
  area: '面积',
};

const TABLE_DOCUMENT_LABEL_PRESETS: TableDocumentLabelPreset[] = [
  {
    key: 'delivery-note',
    label: '送货单列头',
    description: '更适合送货、发货、签收类单据',
  },
  {
    key: 'statement',
    label: '对账单列头',
    description: '更适合对账、结算、往来明细',
  },
  {
    key: 'loading-list',
    label: '装车单列头',
    description: '更适合装车、配货、出库装载明细',
  },
];

const DOCUMENT_LABEL_BY_PRESET: Record<
  TableDocumentLabelPresetKey,
  Partial<Record<string, string>>
> = {
  'delivery-note': {
    rownumber: '序号',
    code: '货号',
    productcode: '货号',
    name: '品名',
    productname: '品名',
    spec: '规格',
    specification: '规格',
    unit: '单位',
    quantity: '数量',
    totalquantity: '数量',
    unitprice: '单价',
    price: '单价',
    subtotal: '金额',
    amount: '金额',
    totalamount: '金额',
    total: '金额',
    batchnumber: '批次',
    remark: '备注',
    note: '备注',
  },
  statement: {
    rownumber: '序号',
    code: '产品编码',
    productcode: '产品编码',
    name: '对账品名',
    productname: '对账品名',
    spec: '规格型号',
    specification: '规格型号',
    unit: '单位',
    quantity: '对账数量',
    totalquantity: '对账数量',
    unitprice: '对账单价',
    price: '对账单价',
    subtotal: '对账金额',
    amount: '对账金额',
    totalamount: '对账金额',
    total: '对账金额',
    remark: '对账备注',
    note: '对账备注',
  },
  'loading-list': {
    rownumber: '序号',
    code: '货号',
    productcode: '货号',
    name: '装车品名',
    productname: '装车品名',
    spec: '规格',
    specification: '规格',
    unit: '单位',
    quantity: '装车数量',
    totalquantity: '装车数量',
    unitprice: '装车单价',
    price: '装车单价',
    subtotal: '装车金额',
    amount: '装车金额',
    totalamount: '装车金额',
    total: '装车金额',
    batchnumber: '装车批次',
    remark: '装车备注',
    note: '装车备注',
  },
};

const PRESET_SEEDS: PresetSeed[] = [
  {
    key: 'compact',
    label: '精简明细',
    description: '名称、数量、单价、金额直接排好',
    candidatePaths: ['name', 'quantity', 'unitPrice', 'subtotal'],
    minColumns: 3,
  },
  {
    key: 'standard',
    label: '标准明细',
    description: '编码、名称、规格、单位、数量、单价、金额',
    candidatePaths: [
      'code',
      'name',
      'spec',
      'unit',
      'quantity',
      'unitPrice',
      'subtotal',
    ],
    minColumns: 4,
  },
  {
    key: 'warehouse',
    label: '仓库明细',
    description: '更适合出入库、批次和备注单据',
    candidatePaths: [
      'code',
      'name',
      'spec',
      'unit',
      'quantity',
      'batchNumber',
      'remark',
    ],
    minColumns: 4,
  },
];

const QUICK_INSERT_SEEDS: QuickInsertSeed[] = [
  {
    key: 'name-spec-quantity',
    label: '品名+规格+数量',
    description: '补上最常见的基础列，适合先把明细表搭出来。',
    candidatePaths: ['name', 'spec', 'quantity'],
    minColumns: 3,
  },
  {
    key: 'tile-piece-count',
    label: '品名+规格+件数+片数',
    description: '更适合瓷砖行业，同时把件数和片数带上。',
    candidatePaths: ['name', 'spec', 'boxes', 'pieces'],
    minColumns: 3,
  },
  {
    key: 'code-name-batch',
    label: '货号+品名+批次',
    description: '适合仓库核对、批次追溯和装车清单。',
    candidatePaths: ['code', 'name', 'batchNumber'],
    minColumns: 3,
  },
  {
    key: 'name-location-quantity',
    label: '品名+仓库+数量',
    description: '适合出入库、调拨和现场核对。',
    candidatePaths: ['name', 'warehouseName', 'locationName', 'quantity'],
    minColumns: 3,
  },
];

function roundTo(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeLookupKey(value: string): string {
  return value.toLowerCase().replace(/[\s._-]/g, '');
}

function stripLabelDecorations(label: string): string {
  const firstLine = label
    .split('\n')
    .map(part => part.trim())
    .filter(Boolean)[0];
  if (!firstLine) return '';

  return firstLine.replace(/\s*[（(].*?[)）]\s*$/g, '').trim();
}

function replaceLabelBase(label: string, nextBaseLabel: string): string {
  const lines = label
    .split('\n')
    .map(part => part.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return nextBaseLabel;
  }

  return [nextBaseLabel, ...lines.slice(1)].join('\n');
}

function getColumnSemanticKey(
  column: Pick<TableColumn, 'key' | 'label'>
): string {
  if (isRowNumberColumn(column)) {
    return 'rownumber';
  }

  const segments = column.key
    .split('.')
    .map(segment => normalizeLookupKey(segment))
    .filter(Boolean);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (CANONICAL_LABEL_BY_KEY[segment]) {
      return segment;
    }
  }

  const normalizedLabel = normalizeLookupKey(
    stripLabelDecorations(column.label)
  );
  return normalizedLabel || normalizeLookupKey(column.key);
}

function getColumnPlacementPriority(
  column: Pick<TableColumn, 'key' | 'label'>
): number {
  const semanticKey = getColumnSemanticKey(column);
  return COLUMN_PLACEMENT_PRIORITY_BY_KEY[semanticKey] ?? 60;
}

function getWidthWeight(pathOrLabel: string): number {
  const segments = pathOrLabel
    .split('.')
    .map(segment => normalizeLookupKey(segment))
    .filter(Boolean);

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (WIDTH_WEIGHT_BY_KEY[segment]) {
      return WIDTH_WEIGHT_BY_KEY[segment];
    }
  }

  const normalized = normalizeLookupKey(pathOrLabel);
  return WIDTH_WEIGHT_BY_KEY[normalized] ?? 12;
}

function normalizeWidths(weights: number[]): number[] {
  if (weights.length === 0) return [];

  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    const evenWidth = roundTo(100 / weights.length, 1);
    return weights.map((_, index) =>
      index === weights.length - 1
        ? roundTo(100 - evenWidth * (weights.length - 1), 1)
        : evenWidth
    );
  }

  let allocated = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return roundTo(100 - allocated, 1);
    }

    const nextWidth = roundTo((weight / total) * 100, 1);
    allocated += nextWidth;
    return nextWidth;
  });
}

function resolveColumnAlign(
  field: Pick<FieldDefinition, 'type'>
): TableColumn['align'] {
  switch (field.type) {
    case 'number':
      return 'right';
    case 'date':
    case 'boolean':
      return 'center';
    default:
      return 'left';
  }
}

function resolveColumnFormat(
  field: Pick<FieldDefinition, 'suggestedFormat'>
): TableColumn['format'] {
  if (
    field.suggestedFormat &&
    SUPPORTED_COLUMN_FORMATS.has(field.suggestedFormat as TableColumn['format'])
  ) {
    return field.suggestedFormat as TableColumn['format'];
  }

  return 'text';
}

function pickFieldsByPaths(
  fields: FieldDefinition[],
  candidatePaths: string[]
): FieldDefinition[] {
  const used = new Set<string>();

  return candidatePaths
    .map(path => fields.find(field => field.path === path))
    .filter((field): field is FieldDefinition => Boolean(field))
    .filter(field => {
      if (used.has(field.path)) return false;
      used.add(field.path);
      return true;
    });
}

function createColumnsFromFields(fields: FieldDefinition[]): TableColumn[] {
  const widths = normalizeWidths(
    fields.map(field => getWidthWeight(field.path || field.label))
  );

  return fields.map((field, index) =>
    createTableColumn({
      key: field.path,
      label: field.label,
      width: Math.max(5, widths[index] ?? 10),
      widthUnit: '%',
      align: resolveColumnAlign(field),
      format: resolveColumnFormat(field),
    })
  );
}

export function createTableColumnFromField(field: FieldDefinition): TableColumn {
  return createTableColumn({
    key: field.path,
    label: field.label,
    width: Math.max(5, getWidthWeight(field.path || field.label)),
    widthUnit: '%',
    align: resolveColumnAlign(field),
    format: resolveColumnFormat(field),
  });
}

function insertColumnAtSuggestedPosition(
  columns: TableColumn[],
  column: TableColumn
): TableColumn[] {
  const nextColumns = [...columns];
  const columnPriority = getColumnPlacementPriority(column);
  let insertAfterIndex = -1;

  for (let index = nextColumns.length - 1; index >= 0; index -= 1) {
    const current = nextColumns[index];
    if (!current) {
      continue;
    }

    if (getColumnPlacementPriority(current) <= columnPriority) {
      insertAfterIndex = index;
      break;
    }
  }

  nextColumns.splice(insertAfterIndex + 1, 0, column);
  return nextColumns;
}

export function createRowNumberTableColumn(): TableColumn {
  return createTableColumn({
    key: TABLE_ROW_NUMBER_KEY,
    label: '序号',
    width: 8,
    widthUnit: '%',
    align: 'center',
    format: 'text',
  });
}

export function isRowNumberColumn(
  column: Pick<TableColumn, 'key'> | string
): boolean {
  const key = typeof column === 'string' ? column : column.key;
  return key === TABLE_ROW_NUMBER_KEY;
}

export function hasRowNumberColumn(columns: TableColumn[]): boolean {
  return columns.some(column => isRowNumberColumn(column));
}

export function formatTableRowNumber(
  rowIndex: number,
  mode: RowNumberMode = 'numeric'
): string {
  const value = rowIndex + 1;

  if (mode === 'zero-pad-2') {
    return String(value).padStart(2, '0');
  }

  return String(value);
}

export function getCanonicalTableColumnLabel(
  column: Pick<TableColumn, 'key' | 'label'>
): string {
  const semanticKey = getColumnSemanticKey(column);
  return (
    CANONICAL_LABEL_BY_KEY[semanticKey] ??
    stripLabelDecorations(column.label) ??
    column.label
  );
}

export function getTableColumnDisplayLabel(
  column: Pick<TableColumn, 'key' | 'label'>,
  mode: TableColumnLabelMode = 'canonical'
): string {
  const semanticKey = getColumnSemanticKey(column);
  const canonicalLabel = getCanonicalTableColumnLabel(column);

  if (mode === 'piece') {
    switch (semanticKey) {
      case 'quantity':
      case 'totalquantity':
        return '数量\n(片)';
      case 'unitprice':
      case 'price':
        return '单价\n(元/片)';
      case 'piecesperunit':
      case 'batchpiecesperunit':
        return '每件片数\n(片/件)';
      case 'subtotal':
      case 'totalprice':
      case 'amount':
      case 'totalamount':
      case 'total':
        return '金额\n(元)';
      case 'pieces':
      case 'sheets':
        return '片数\n(片)';
      case 'boxes':
      case 'totalboxes':
        return '件数\n(件)';
      case 'area':
        return '面积\n(㎡)';
      case 'weight':
        return '重量\n(kg)';
      default:
        return canonicalLabel;
    }
  }

  if (mode === 'item') {
    switch (semanticKey) {
      case 'quantity':
      case 'totalquantity':
        return '数量\n(件)';
      case 'unitprice':
      case 'price':
        return '单价\n(元/件)';
      case 'piecesperunit':
      case 'batchpiecesperunit':
        return '每件片数\n(片/件)';
      case 'subtotal':
      case 'totalprice':
      case 'amount':
      case 'totalamount':
      case 'total':
        return '金额\n(元)';
      case 'pieces':
      case 'sheets':
        return '片数\n(片)';
      case 'boxes':
      case 'totalboxes':
        return '件数\n(件)';
      case 'area':
        return '面积\n(㎡)';
      case 'weight':
        return '重量\n(kg)';
      default:
        return canonicalLabel;
    }
  }

  return canonicalLabel;
}

export function getTableDocumentLabelPresets(): TableDocumentLabelPreset[] {
  return TABLE_DOCUMENT_LABEL_PRESETS;
}

export function applyTableDocumentLabelPreset(
  columns: TableColumn[],
  preset: TableDocumentLabelPresetKey
): TableColumn[] {
  const labelMap = DOCUMENT_LABEL_BY_PRESET[preset];

  return columns.map(column => {
    const semanticKey = getColumnSemanticKey(column);
    const nextBaseLabel = labelMap[semanticKey];
    if (!nextBaseLabel) {
      return column;
    }

    return {
      ...column,
      label: replaceLabelBase(column.label, nextBaseLabel),
    };
  });
}

export function applyTableColumnLabelMode(
  columns: TableColumn[],
  mode: TableColumnLabelMode
): TableColumn[] {
  return columns.map(column => ({
    ...column,
    label: getTableColumnDisplayLabel(column, mode),
  }));
}

export function getTableColumnLabelQuickOptions(
  column: Pick<TableColumn, 'key' | 'label'>
): string[] {
  const semanticKey = getColumnSemanticKey(column);
  const options = [getCanonicalTableColumnLabel(column)];

  switch (semanticKey) {
    case 'code':
    case 'productcode':
      options.push('产品编码');
      break;
    case 'name':
    case 'productname':
      options.push('产品名称');
      break;
    case 'spec':
    case 'specification':
      options.push('规格型号');
      break;
    case 'quantity':
    case 'totalquantity':
      options.push('数量\n(片)', '数量\n(件)');
      break;
    case 'unitprice':
    case 'price':
      options.push('单价\n(元/片)', '单价\n(元/件)', '单价\n(元)');
      break;
    case 'piecesperunit':
    case 'batchpiecesperunit':
      options.push('每件片数', '每件片数\n(片/件)');
      break;
    case 'subtotal':
    case 'totalprice':
    case 'amount':
    case 'totalamount':
    case 'total':
      options.push('金额\n(元)', '小计\n(元)');
      break;
    case 'pieces':
    case 'sheets':
      options.push('片数\n(片)');
      break;
    case 'boxes':
    case 'totalboxes':
      options.push('件数\n(件)');
      break;
    case 'batchnumber':
      options.push('批次');
      break;
    case 'warehousename':
      options.push('仓库名称');
      break;
    case 'locationname':
      options.push('存放位置');
      break;
    case 'colorno':
      options.push('颜色号');
      break;
    case 'grade':
      options.push('等级品级');
      break;
    case 'remark':
    case 'remarks':
    case 'note':
      options.push('备注说明');
      break;
    case 'weight':
      options.push('重量\n(kg)');
      break;
    case 'area':
      options.push('面积\n(㎡)');
      break;
    case 'rownumber':
      options.push('序号');
      break;
    default:
      break;
  }

  return Array.from(
    new Set(options.map(option => option.trim()).filter(Boolean))
  ).slice(0, 4);
}

export function rebalanceTableColumnWidths(
  columns: TableColumn[]
): TableColumn[] {
  if (columns.length === 0) return columns;

  const widths = normalizeWidths(
    columns.map(column => getWidthWeight(column.key || column.label))
  );

  return columns.map((column, index) => ({
    ...column,
    widthUnit: '%',
    width: Math.max(5, widths[index] ?? column.width),
  }));
}

export function getTableColumnPresets(
  templateType: string
): TableColumnPreset[] {
  const tableFields = getTableFieldsForTemplateType(templateType);
  const presets: TableColumnPreset[] = [];

  const recommendedFields = getRecommendedFieldsForTemplateType(
    templateType,
    'table'
  ).slice(0, 7);

  if (recommendedFields.length > 0) {
    presets.push({
      key: 'recommended',
      label: '推荐列',
      description: '按当前单据常用字段直接排好',
      columns: createColumnsFromFields(recommendedFields),
    });
  }

  PRESET_SEEDS.forEach(seed => {
    const matchedFields = pickFieldsByPaths(tableFields, seed.candidatePaths);
    if (matchedFields.length < seed.minColumns) return;

    presets.push({
      key: seed.key,
      label: seed.label,
      description: seed.description,
      columns: createColumnsFromFields(matchedFields),
    });
  });

  return presets;
}

export function getTableColumnQuickInsertPresets(
  templateType: string
): TableColumnQuickInsertPreset[] {
  const tableFields = getTableFieldsForTemplateType(templateType);

  return QUICK_INSERT_SEEDS.map(seed => {
    const fields = pickFieldsByPaths(tableFields, seed.candidatePaths);
    if (fields.length < seed.minColumns) {
      return null;
    }

    return {
      key: seed.key,
      label: seed.label,
      description: seed.description,
      fields,
    };
  }).filter(
    (preset): preset is TableColumnQuickInsertPreset => Boolean(preset)
  );
}

export function appendTableFieldsAsColumns(
  columns: TableColumn[],
  fields: FieldDefinition[]
): TableColumn[] {
  if (fields.length === 0) {
    return columns;
  }

  const existingKeys = new Set(columns.map(column => column.key));
  let nextColumns = [...columns];
  let hasAddedColumn = false;

  fields.forEach(field => {
    if (existingKeys.has(field.path)) {
      return;
    }

    nextColumns = insertColumnAtSuggestedPosition(
      nextColumns,
      createTableColumnFromField(field)
    );
    existingKeys.add(field.path);
    hasAddedColumn = true;
  });

  return hasAddedColumn ? rebalanceTableColumnWidths(nextColumns) : columns;
}

export function insertTableFieldAsColumn(
  columns: TableColumn[],
  field: FieldDefinition
): TableColumn[] {
  return appendTableFieldsAsColumns(columns, [field]);
}

export function appendRecommendedTableColumns(
  templateType: string,
  columns: TableColumn[]
): TableColumn[] {
  const missingFields = getRecommendedFieldsForTemplateType(
    templateType,
    'table'
  )
    .filter(field => !columns.some(column => column.key === field.path))
    .slice(0, 6);

  if (missingFields.length === 0) {
    return columns;
  }

  return appendTableFieldsAsColumns(columns, missingFields);
}

export function toggleRowNumberColumn(columns: TableColumn[]): TableColumn[] {
  if (hasRowNumberColumn(columns)) {
    return rebalanceTableColumnWidths(
      columns.filter(column => !isRowNumberColumn(column))
    );
  }

  return rebalanceTableColumnWidths([createRowNumberTableColumn(), ...columns]);
}

export function isSummaryEligibleColumn(column: TableColumn): boolean {
  return column.format === 'number' || column.format === 'currency';
}

export function getDefaultSummaryColumnKeys(columns: TableColumn[]): string[] {
  const preferredColumns = columns.filter(column => {
    if (!isSummaryEligibleColumn(column)) return false;

    const normalizedKey = normalizeLookupKey(column.key);
    const matchesExcludedKeyword = SUMMARY_EXCLUDED_KEYWORDS.some(keyword =>
      normalizedKey.includes(keyword)
    );
    const matchesExcludedLabel = SUMMARY_EXCLUDED_LABELS.some(label =>
      column.label.includes(label)
    );
    if (matchesExcludedKeyword || matchesExcludedLabel) {
      return false;
    }

    return (
      SUMMARY_KEY_KEYWORDS.some(keyword => normalizedKey.includes(keyword)) ||
      SUMMARY_LABEL_KEYWORDS.some(label => column.label.includes(label))
    );
  });

  if (preferredColumns.length > 0) {
    return preferredColumns.map(column => column.key);
  }

  return columns
    .filter(column => isSummaryEligibleColumn(column))
    .filter(
      column =>
        !SUMMARY_EXCLUDED_LABELS.some(label => column.label.includes(label))
    )
    .slice(0, 2)
    .map(column => column.key);
}
