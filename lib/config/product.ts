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
export const PRODUCT_UNITS = {
  PIECE: 'piece',
  BOX: 'box',
  SQUARE_METER: 'sqm',
  KILOGRAM: 'kg',
  METER: 'm',
} as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[keyof typeof PRODUCT_UNITS];

// 产品单位中文标签映射
export const PRODUCT_UNIT_LABELS = {
  [PRODUCT_UNITS.PIECE]: '件',
  [PRODUCT_UNITS.BOX]: '箱',
  [PRODUCT_UNITS.SQUARE_METER]: '平方米',
  [PRODUCT_UNITS.KILOGRAM]: '千克',
  [PRODUCT_UNITS.METER]: '米',
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
