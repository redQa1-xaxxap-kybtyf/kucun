// 产品相关类型定义
// 遵循命名约定：前端使用 camelCase

export interface Product {
  id: string;
  code: string;
  name: string;
  specification?: string;
  specifications?: Record<string, any>;
  unit: 'piece' | 'sheet' | 'strip' | 'box' | 'square_meter';
  piecesPerUnit: number;
  weight?: number;
  thickness?: number; // 产品厚度(mm)
  status: 'active' | 'inactive';
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    code: string;
  };
  createdAt: string;
  updatedAt: string;
  // 库存汇总信息（来自API响应）
  inventory?: {
    totalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
  };
  statistics?: {
    inventoryRecordsCount: number;
    salesOrderItemsCount: number;
    inboundRecordsCount: number;
  };
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
  specifications?: Record<string, any>;
  unit?: 'piece' | 'sheet' | 'strip' | 'box' | 'square_meter';
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
  status?: 'active' | 'inactive';
}

export interface ProductUpdateInput {
  id: string;
  code?: string;
  name?: string;
  specification?: string;
  specifications?: Record<string, any>;
  unit?: 'piece' | 'sheet' | 'strip' | 'box' | 'square_meter';
  piecesPerUnit?: number;
  weight?: number;
  thickness?: number; // 产品厚度(mm)，可选字段
  status?: 'active' | 'inactive';
}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: 'active' | 'inactive';
  unit?: 'piece' | 'sheet' | 'strip' | 'box' | 'square_meter';
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
  details?: ValidationError[]; // 修复：使用具体类型替代any
}

// 验证错误类型定义
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
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
export type UpdateProductData = ProductUpdateInput;

// 瓷砖行业特有规格信息类型
export interface TileSpecifications {
  color?: string; // 颜色
  surface?: string; // 表面处理
  thickness?: number; // 厚度(mm)
  size?: string; // 尺寸规格
  pattern?: string; // 花纹
  grade?: string; // 等级
  origin?: string; // 产地
  series?: string; // 系列
  [key: string]: string | number | boolean | undefined; // 修复：使用联合类型替代any
}

// 产品单位显示名称映射
export const PRODUCT_UNIT_LABELS: Record<string, string> = {
  piece: '件',
  sheet: '片',
  strip: '条',
  box: '箱',
  square_meter: '平方米',
};

// 产品单位选项（用于表单）- 修复：使用as const确保类型安全和性能
export const PRODUCT_UNIT_OPTIONS = [
  { value: 'piece', label: '件' },
  { value: 'sheet', label: '片' },
  { value: 'strip', label: '条' },
  { value: 'box', label: '箱' },
  { value: 'square_meter', label: '平方米' },
] as const;

// 产品状态显示名称映射
export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  active: '启用',
  inactive: '停用',
};

// 产品状态选项（用于表单）- 修复：使用as const确保类型安全和性能
export const PRODUCT_STATUS_OPTIONS = [
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '停用' },
] as const;

// 产品状态颜色映射（用于Badge组件）
export const PRODUCT_STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  active: 'default',
  inactive: 'secondary',
};
