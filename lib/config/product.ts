/**
 * 产品管理模块统一配置
 * 遵循唯一真理源原则，所有枚举值和常量在此统一定义
 */

// 产品状态枚举
export const PRODUCT_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DISCONTINUED: 'discontinued',
} as const;

export type ProductStatus =
  (typeof PRODUCT_STATUSES)[keyof typeof PRODUCT_STATUSES];

// 产品状态中文标签映射
export const PRODUCT_STATUS_LABELS = {
  [PRODUCT_STATUSES.ACTIVE]: '启用',
  [PRODUCT_STATUSES.INACTIVE]: '停用',
  [PRODUCT_STATUSES.DISCONTINUED]: '已停产',
} as const;

// 产品单位枚举
// 瓷砖行业专用：只使用"件"和"片"两种单位
export const PRODUCT_UNITS = {
  PIECE: 'piece', // 件（整件/整箱）
  SHEET: 'sheet', // 片（单片）
} as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[keyof typeof PRODUCT_UNITS];

// 用于Zod验证的数组形式
export const PRODUCT_STATUS_VALUES = Object.values(PRODUCT_STATUSES);
export const PRODUCT_UNIT_VALUES = Object.values(PRODUCT_UNITS);

// 产品单位中文标签映射
export const PRODUCT_UNIT_LABELS = {
  [PRODUCT_UNITS.PIECE]: '件',
  [PRODUCT_UNITS.SHEET]: '片',
} as const;

// 产品排序字段枚举
export const PRODUCT_SORT_FIELDS = {
  NAME: 'name',
  CODE: 'code',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
} as const;

export type ProductSortField =
  (typeof PRODUCT_SORT_FIELDS)[keyof typeof PRODUCT_SORT_FIELDS];

// 产品排序字段中文标签映射
export const PRODUCT_SORT_FIELD_LABELS = {
  [PRODUCT_SORT_FIELDS.NAME]: '产品名称',
  [PRODUCT_SORT_FIELDS.CODE]: '产品编码',
  [PRODUCT_SORT_FIELDS.CREATED_AT]: '创建时间',
  [PRODUCT_SORT_FIELDS.UPDATED_AT]: '更新时间',
} as const;

// 产品状态选项（用于下拉框）
export const PRODUCT_STATUS_OPTIONS = [
  {
    value: PRODUCT_STATUSES.ACTIVE,
    label: PRODUCT_STATUS_LABELS[PRODUCT_STATUSES.ACTIVE],
  },
  {
    value: PRODUCT_STATUSES.INACTIVE,
    label: PRODUCT_STATUS_LABELS[PRODUCT_STATUSES.INACTIVE],
  },
  {
    value: PRODUCT_STATUSES.DISCONTINUED,
    label: PRODUCT_STATUS_LABELS[PRODUCT_STATUSES.DISCONTINUED],
  },
] as const;

// 产品单位选项（用于下拉框）
export const PRODUCT_UNIT_OPTIONS = [
  {
    value: PRODUCT_UNITS.PIECE,
    label: PRODUCT_UNIT_LABELS[PRODUCT_UNITS.PIECE],
  },
  {
    value: PRODUCT_UNITS.SHEET,
    label: PRODUCT_UNIT_LABELS[PRODUCT_UNITS.SHEET],
  },
] as const;

// 分页配置
export const paginationConfig = {
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
  maxPageSize: 100,
} as const;
