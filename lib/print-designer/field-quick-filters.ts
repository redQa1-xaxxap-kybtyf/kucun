import {
  getRecommendedFieldsForTemplateType,
  type FieldDefinition,
} from './field-registry';

export type FieldPickerScope = 'template' | 'table';

export interface FieldQuickFilterOption {
  key: string;
  label: string;
}

interface FieldQuickFilterConfig extends FieldQuickFilterOption {
  matches: (field: FieldDefinition) => boolean;
}

function includesAnyKeyword(
  field: FieldDefinition,
  keywords: string[]
): boolean {
  const haystack = `${field.path} ${field.label} ${field.group}`.toLowerCase();
  return keywords.some(keyword => haystack.includes(keyword));
}

const FIELD_QUICK_FILTERS: Record<FieldPickerScope, FieldQuickFilterConfig[]> =
  {
    table: [
      {
        key: 'product',
        label: '产品信息',
        matches: field =>
          includesAnyKeyword(field, [
            'name',
            'code',
            'spec',
            'unit',
            'product',
            '名称',
            '编码',
            '规格',
            '单位',
            '色号',
            '等级',
            'color',
            'grade',
          ]),
      },
      {
        key: 'quantity',
        label: '件片数量',
        matches: field =>
          includesAnyKeyword(field, [
            'quantity',
            'pieces',
            'boxes',
            'piecesperunit',
            'weight',
            'area',
            '数量',
            '件数',
            '片数',
            '每件片数',
            '重量',
            '面积',
            'damaged',
            'return',
            'original',
          ]),
      },
      {
        key: 'amount',
        label: '价格金额',
        matches: field =>
          field.suggestedFormat === 'currency' ||
          includesAnyKeyword(field, [
            'price',
            'subtotal',
            'amount',
            'totalprice',
            'cost',
            'profit',
            '单价',
            '金额',
            '小计',
            '成本',
            '利润',
          ]),
      },
      {
        key: 'stock',
        label: '仓库批次',
        matches: field =>
          includesAnyKeyword(field, [
            'batch',
            'warehouse',
            'location',
            'supplier',
            '批次',
            '仓库',
            '库位',
            '货位',
            '供应商',
          ]),
      },
      {
        key: 'remark',
        label: '备注说明',
        matches: field =>
          includesAnyKeyword(field, [
            'remark',
            'remarks',
            'reason',
            'message',
            'note',
            '备注',
            '说明',
            '原因',
            '内容',
          ]),
      },
    ],
    template: [
      {
        key: 'document',
        label: '单号日期',
        matches: field =>
          includesAnyKeyword(field, [
            'order',
            'printdate',
            'createdat',
            'deliverydate',
            'shipmentdate',
            'arrivaldate',
            '单号',
            '编号',
            '日期',
            '打印',
            '交货',
            '发货',
            '到港',
          ]),
      },
      {
        key: 'party',
        label: '客户供应商',
        matches: field =>
          includesAnyKeyword(field, [
            'customer',
            'supplier',
            'contact',
            'phone',
            'address',
            '客户',
            '供应商',
            '联系人',
            '电话',
            '地址',
          ]),
      },
      {
        key: 'amount',
        label: '金额汇总',
        matches: field =>
          field.suggestedFormat === 'currency' ||
          includesAnyKeyword(field, [
            'amount',
            'quantity',
            'boxes',
            'pieces',
            'weight',
            'refund',
            'profit',
            'cost',
            '费用',
            '金额',
            '数量',
            '件数',
            '片数',
            '重量',
            '利润',
            '成本',
          ]),
      },
      {
        key: 'company',
        label: '公司制单',
        matches: field =>
          includesAnyKeyword(field, [
            'company',
            'operator',
            'fax',
            'company.',
            'operator.',
            '公司',
            '制单',
            '操作人',
            '传真',
          ]),
      },
      {
        key: 'remark',
        label: '备注状态',
        matches: field =>
          includesAnyKeyword(field, [
            'remark',
            'remarks',
            'reason',
            'status',
            'type',
            'message',
            '备注',
            '状态',
            '原因',
            '类型',
            '内容',
          ]),
      },
    ],
  };

function getQuickFilterConfigs(
  scope: FieldPickerScope
): FieldQuickFilterConfig[] {
  return FIELD_QUICK_FILTERS[scope];
}

export function getFieldQuickFilterOptions(
  fields: FieldDefinition[],
  scope: FieldPickerScope
): FieldQuickFilterOption[] {
  return [
    { key: 'all', label: '全部' },
    { key: 'common', label: '常用' },
    ...getQuickFilterConfigs(scope)
      .filter(config => fields.some(field => config.matches(field)))
      .map(config => ({ key: config.key, label: config.label })),
  ];
}

export function filterFieldsByQuickFilter(
  fields: FieldDefinition[],
  templateType: string,
  scope: FieldPickerScope,
  quickFilterKey: string
): FieldDefinition[] {
  if (quickFilterKey === 'all') {
    return fields;
  }

  if (quickFilterKey === 'common') {
    const recommendedPaths = new Set(
      getRecommendedFieldsForTemplateType(templateType, scope).map(
        field => field.path
      )
    );
    return fields.filter(field => recommendedPaths.has(field.path));
  }

  const config = getQuickFilterConfigs(scope).find(
    option => option.key === quickFilterKey
  );

  if (!config) {
    return fields;
  }

  return fields.filter(field => config.matches(field));
}
