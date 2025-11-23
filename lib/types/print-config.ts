/**
 * 打印字段配置类型定义
 *
 * 用于配置各业务单据的可打印字段
 * 遵循单一职责原则：仅定义字段配置相关类型
 */

/**
 * 文档类型
 */
export type DocumentType =
  | 'sales-order'
  | 'purchase-order'
  | 'factory-shipment';

/**
 * 字段类型
 * - header: 表头信息字段（如订单号、客户信息）
 * - item: 明细行字段（如产品名称、数量、单价）
 * - summary: 汇总字段（如总金额、大写金额）
 */
export type FieldType = 'header' | 'item' | 'summary';

/**
 * 对齐方式
 */
export type Alignment = 'left' | 'center' | 'right';

/**
 * 打印字段定义
 */
export interface PrintFieldDefinition {
  /**
   * 字段唯一标识
   * 对应数据对象的属性名
   */
  key: string;

  /**
   * 字段显示标签
   */
  label: string;

  /**
   * 字段类型
   */
  type: FieldType;

  /**
   * 列宽（仅对 item 类型有效）
   * 支持像素值、百分比、auto
   * @example '100px' | '20%' | 'auto'
   */
  width?: string;

  /**
   * 对齐方式
   */
  align?: Alignment;

  /**
   * 格式化函数
   * 用于自定义字段值的显示格式
   */
  format?: (value: unknown) => string;

  /**
   * 默认是否显示
   * true: 默认勾选，false: 默认不勾选
   */
  defaultVisible: boolean;

  /**
   * 是否必须显示（不可取消勾选）
   * @default false
   */
  required?: boolean;

  /**
   * 字段分组（用于 UI 组织）
   * @example 'basic' | 'advanced' | 'custom'
   */
  group?: string;
}

/**
 * 打印配置
 * 包含特定文档类型的所有字段定义
 */
export interface PrintConfig {
  /**
   * 文档类型
   */
  documentType: DocumentType;

  /**
   * 文档标题
   * @example '销售订单'
   */
  title: string;

  /**
   * 所有可打印字段
   */
  fields: PrintFieldDefinition[];

  /**
   * 表头字段（快捷访问）
   */
  headerFields: PrintFieldDefinition[];

  /**
   * 明细字段（快捷访问）
   */
  itemFields: PrintFieldDefinition[];

  /**
   * 汇总字段（快捷访问）
   */
  summaryFields: PrintFieldDefinition[];
}

/**
 * 字段选择状态
 * 记录用户勾选的字段
 */
export interface FieldSelection {
  /**
   * 已选表头字段的 key 集合
   */
  headerKeys: string[];

  /**
   * 已选明细字段的 key 集合
   */
  itemKeys: string[];

  /**
   * 已选汇总字段的 key 集合
   */
  summaryKeys: string[];
}

/**
 * 工具函数：从配置中提取指定类型的字段
 */
export function getFieldsByType(
  config: PrintConfig,
  type: FieldType
): PrintFieldDefinition[] {
  return config.fields.filter(field => field.type === type);
}

/**
 * 工具函数：获取默认选中的字段
 */
export function getDefaultSelectedKeys(config: PrintConfig): FieldSelection {
  return {
    headerKeys: config.headerFields
      .filter(field => field.defaultVisible)
      .map(field => field.key),
    itemKeys: config.itemFields
      .filter(field => field.defaultVisible)
      .map(field => field.key),
    summaryKeys: config.summaryFields
      .filter(field => field.defaultVisible)
      .map(field => field.key),
  };
}

/**
 * 工具函数：验证字段选择是否包含所有必须字段
 */
export function validateFieldSelection(
  config: PrintConfig,
  fieldSelection: FieldSelection
): { valid: boolean; missingRequired: string[] } {
  const allSelectedKeys = [
    ...fieldSelection.headerKeys,
    ...fieldSelection.itemKeys,
    ...fieldSelection.summaryKeys,
  ];

  const requiredFields = config.fields.filter(field => field.required);
  const missingRequired = requiredFields
    .filter(field => !allSelectedKeys.includes(field.key))
    .map(field => field.key);

  return {
    valid: missingRequired.length === 0,
    missingRequired,
  };
}
