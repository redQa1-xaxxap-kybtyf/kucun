/**
 * 产品数据转换工具
 *
 * 职责：
 * 1. 统一所有产品数据转换逻辑
 * 2. 消除重复的转换代码
 * 3. 确保数据格式一致性
 *
 * 设计原则：
 * - DRY：所有转换逻辑集中在此文件
 * - 纯函数：无副作用，可测试
 * - 类型安全：严格的类型约束
 */

import { logger } from '@/lib/logger';
import type {
  Product,
  ProductCategory,
  ProductImage,
} from '@/lib/types/product';

// ==================== 图片JSON解析 ====================

/**
 * 安全解析产品图片JSON
 * 处理各种边界情况，确保返回有效数组
 *
 * @param imagesJson - 图片JSON字符串或null
 * @param productId - 产品ID（用于日志记录）
 * @returns 解析后的图片数组，失败时返回空数组
 */
export function parseProductImages(
  imagesJson: string | null,
  productId?: string
): ProductImage[] {
  if (!imagesJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(
      typeof imagesJson === 'string' ? imagesJson : String(imagesJson)
    );

    if (!Array.isArray(parsed)) {
      logger.warn('products', '产品图片数据不是数组格式', {
        productId,
        type: typeof parsed,
      });
      return [];
    }

    return parsed as ProductImage[];
  } catch (error: unknown) {
    logger.warn('products', '解析产品图片失败，使用空数组作为兜底', {
      productId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// ==================== 分类数据转换 ====================

/**
 * 转换分类数据为ProductCategory格式
 */
export function toCategorySummary(category: {
  id: string;
  name: string;
  code: string;
}): ProductCategory {
  return {
    id: category.id,
    name: category.name,
    code: category.code,
  };
}

// ==================== 数据库到API转换 ====================

/**
 * 转换Prisma产品数据为API响应格式
 *
 * 处理：
 * - Date对象转ISO字符串
 * - 图片JSON解析
 * - 分类数据转换
 *
 * @param dbProduct - Prisma查询结果
 * @returns Product API响应对象
 */
export function toProductResponse(dbProduct: {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  description: string | null;
  unit: string;
  piecesPerUnit: number;
  weight: number | null;
  thickness: number | null;
  status: string;
  categoryId: string | null;
  thumbnailUrl: string | null;
  images: string | null;
  createdAt: Date;
  updatedAt: Date;
  category?: { id: string; name: string; code: string } | null;
}): Product {
  return {
    id: dbProduct.id,
    code: dbProduct.code,
    name: dbProduct.name,
    specification: dbProduct.specification ?? undefined,
    description: dbProduct.description ?? undefined,
    unit: dbProduct.unit as Product['unit'],
    piecesPerUnit: dbProduct.piecesPerUnit,
    weight: dbProduct.weight ?? undefined,
    thickness: dbProduct.thickness ?? undefined,
    status: dbProduct.status as Product['status'],
    categoryId: dbProduct.categoryId ?? undefined,
    thumbnailUrl: dbProduct.thumbnailUrl ?? undefined,
    images: parseProductImages(dbProduct.images, dbProduct.id),
    category: dbProduct.category ? toCategorySummary(dbProduct.category) : null,
    createdAt: dbProduct.createdAt.toISOString(),
    updatedAt: dbProduct.updatedAt.toISOString(),
  };
}

/**
 * 批量转换产品数据
 */
export function toProductResponseList(
  dbProducts: Array<Parameters<typeof toProductResponse>[0]>
): Product[] {
  return dbProducts.map(toProductResponse);
}

// ==================== 序列化/反序列化 ====================

/**
 * 序列化产品用于客户端传输
 * 确保Date对象转换为字符串
 */
export function serializeProduct(product: Product): Product {
  return {
    ...product,
    createdAt:
      typeof product.createdAt === 'string'
        ? product.createdAt
        : new Date(product.createdAt).toISOString(),
    updatedAt:
      typeof product.updatedAt === 'string'
        ? product.updatedAt
        : new Date(product.updatedAt).toISOString(),
  };
}

/**
 * 批量序列化产品数组
 */
export function serializeProductList(products: Product[]): Product[] {
  return products.map(serializeProduct);
}

// ==================== 验证工具 ====================

/**
 * 验证产品数据完整性
 */
export function validateProductData(product: Partial<Product>): boolean {
  // 必填字段检查
  if (!product.id || !product.code || !product.name) {
    return false;
  }

  // 状态值检查
  if (product.status && !['active', 'inactive'].includes(product.status)) {
    return false;
  }

  // 单位值检查
  if (product.unit && !['piece', 'sheet'].includes(product.unit)) {
    return false;
  }

  return true;
}

/**
 * 过滤空值字段
 */
export function removeEmptyFields<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const result: Partial<T> = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      result[key as keyof T] = value as T[keyof T];
    }
  });

  return result;
}
