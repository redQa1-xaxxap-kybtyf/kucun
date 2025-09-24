/**
 * 产品相关类型定义
 * 遵循全栈项目统一约定规范：前端使用 camelCase
 *
 * 这是产品模块的唯一真理源，所有产品相关的类型定义都应该在此文件中
 * 与 Prisma Schema 保持同步，确保类型安全
 */

/**
 * 瓷砖行业特有规格信息类型
 * 用于存储瓷砖产品的详细规格参数
 */
export interface TileSpecifications {
  /** 颜色描述，如"米白色"、"深灰色" */
  color?: string;
  /** 表面处理工艺，如"抛光"、"哑光"、"仿古" */
  surface?: string;
  /** 尺寸规格，如"600x600mm"、"800x800mm" */
  size?: string;
  /** 厚度，单位：毫米(mm) */
  thickness?: number;
  /** 花纹描述，如"木纹"、"石纹"、"布纹" */
  pattern?: string;
  /** 产品等级，如"优等品"、"一等品" */
  grade?: string;
  /** 产地信息，如"广东佛山"、"山东淄博" */
  origin?: string;
  /** 产品系列名称，如"现代简约系列" */
  series?: string;
  /** 允许扩展字段，支持未来新增规格参数 */
  [key: string]: string | number | undefined;
}

/**
 * 产品计量单位枚举
 * 定义了系统支持的所有产品计量单位
 */
export type ProductUnit = 'piece' | 'sheet' | 'strip' | 'box' | 'square_meter';

/**
 * 产品状态枚举
 * 定义了产品的生命周期状态
 */
export type ProductStatus = 'active' | 'inactive';

/**
 * 产品分类信息
 * 用于产品的分类管理和层级结构
 */
export interface ProductCategory {
  /** 分类唯一标识符 */
  id: string;
  /** 分类名称 */
  name: string;
  /** 分类编码 */
  code: string;
}

/**
 * 产品库存汇总信息
 * 包含产品的总库存、预留库存和可用库存
 */
export interface ProductInventory {
  /** 总库存数量 */
  totalQuantity: number;
  /** 预留库存数量（已分配给订单但未出库） */
  reservedQuantity: number;
  /** 可用库存数量（总库存 - 预留库存） */
  availableQuantity: number;
}

/**
 * 产品统计信息
 * 包含产品相关的各种统计数据
 */
export interface ProductStatistics {
  /** 库存记录数量 */
  inventoryRecordsCount: number;
  /** 销售订单项目数量 */
  salesOrderItemsCount: number;
  /** 入库记录数量 */
  inboundRecordsCount: number;
}

/**
 * 产品主体信息
 * 系统中产品的完整数据结构，与 Prisma Product 模型保持同步
 */
export interface Product {
  /** 产品唯一标识符 */
  id: string;
  /** 产品编码，用于业务识别和查询 */
  code: string;
  /** 产品名称 */
  name: string;
  /** 产品规格描述（文本格式） */
  specification?: string;
  /** 产品详细规格信息（结构化数据） */
  specifications?: TileSpecifications;
  /** 产品计量单位 */
  unit: ProductUnit;
  /** 每件包含的片数，用于单位换算 */
  piecesPerUnit: number;
  /** 产品重量，单位：千克(kg) */
  weight?: number;
  /** 产品厚度，单位：毫米(mm) */
  thickness?: number;
  /** 产品状态 */
  status: ProductStatus;
  /** 所属分类ID */
  categoryId?: string;
  /** 所属分类信息（关联查询时包含） */
  category?: ProductCategory;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 库存汇总信息（来自API响应） */
  inventory?: ProductInventory;
  /** 统计信息（来自API响应） */
  statistics?: ProductStatistics;
}

// 产品变体类型定义
export interface ProductVariant {
  id: string;
  productId: string;
  colorCode: string;
  colorName?: string;
  colorValue?: string;
  sku: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  // 关联数据
  product?: Product;
  // 库存汇总信息
  totalInventory?: number;
  reservedInventory?: number;
  availableInventory?: number;
}

export interface ProductCreateInput {
  code: string;
  name: string;
  specification?: string;
  specifications?: TileSpecifications;
  unit?: ProductUnit;
  piecesPerUnit?: number;
  weight?: number;
  thickness?: number; // 产品厚度(mm)，可选字段
  // 初始变体信息（可选）
  variants?: ProductVariantCreateInput[];
}

// 产品变体创建输入
export interface ProductVariantCreateInput {
  colorCode: string;
  colorName?: string;
  colorValue?: string;
  sku?: string; // 如果不提供，将自动生成
}

// 产品变体更新输入
export interface ProductVariantUpdateInput {
  id: string;
  colorCode?: string;
  colorName?: string;
  colorValue?: string;
  sku?: string;
  status?: ProductStatus;
}

// ProductUpdateInput 已移除 - 使用 lib/validations/product.ts 中的 ProductUpdateFormData 作为唯一真理源

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: ProductStatus;
  unit?: ProductUnit;
  categoryId?: string;
}

export interface ProductListResponse {
  success: boolean;
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductResponse {
  success: boolean;
  data: Product;
}

export interface ProductErrorResponse {
  success: false;
  error: string;
  details?: string[];
}

// 批量删除相关类型
export interface BatchDeleteProductsInput {
  productIds: string[];
}

export interface BatchDeleteResult {
  success: boolean;
  deletedCount: number;
  failedCount: number;
  failedProducts?: {
    id: string;
    name: string;
    reason: string;
  }[];
  message: string;
}

// 新增类型定义以匹配页面需求
export type CreateProductData = ProductCreateInput;
// UpdateProductData 现在从 lib/validations/product.ts 导入，遵循唯一真理源原则

// 产品单位显示名称映射
export const PRODUCT_UNIT_LABELS: Record<string, string> = {
  piece: '件',
  sheet: '片',
  strip: '条',
  box: '箱',
  square_meter: '平方米',
};

// 产品单位选项（用于表单）
export const PRODUCT_UNIT_OPTIONS = [
  { value: 'piece', label: '件' },
  { value: 'sheet', label: '片' },
  { value: 'strip', label: '条' },
  { value: 'box', label: '箱' },
  { value: 'square_meter', label: '平方米' },
];

// 产品状态显示名称映射
export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  active: '启用',
  inactive: '停用',
};

// 产品状态选项（用于表单）
export const PRODUCT_STATUS_OPTIONS = [
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '停用' },
];

// 产品状态颜色映射（用于Badge组件）
export const PRODUCT_STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  inactive: 'secondary',
};
