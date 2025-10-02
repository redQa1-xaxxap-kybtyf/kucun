/**
 * 产品数据处理工具函数
 * 遵循唯一真理源原则，统一产品数据的处理逻辑
 */

import type { Product } from '@/lib/types/product';
import type {
  ProductCreateFormData,
  ProductUpdateFormData,
} from '@/lib/validations/product';

/**
 * 产品数据转换器
 * 处理前端表单数据与API数据之间的转换
 */
export class ProductDataTransformer {
  /**
   * 将表单数据转换为API创建数据
   */
  static toCreateApiData(
    formData: ProductCreateFormData
  ): ProductCreateFormData {
    const normalizedCategoryId =
      !formData.categoryId || formData.categoryId === 'uncategorized'
        ? undefined
        : formData.categoryId;

    return {
      ...formData,
      categoryId: normalizedCategoryId,
      // 清理规格字段,确保是纯字符串
      specification: ProductDataTransformer.cleanSpecification(
        formData.specification
      ),
      // 处理数值字段：0值转为undefined，避免不必要的存储
      thickness: formData.thickness === 0 ? undefined : formData.thickness,
      // 处理图片字段
      thumbnailUrl: formData.thumbnailUrl || undefined,
      images:
        formData.images && formData.images.length > 0
          ? formData.images
          : undefined,
    };
  }

  /**
   * 将表单数据转换为API更新数据
   */
  static toUpdateApiData(
    formData: ProductUpdateFormData
  ): ProductUpdateFormData {
    const normalizedCategoryId =
      !formData.categoryId || formData.categoryId === 'uncategorized'
        ? undefined
        : formData.categoryId;

    return {
      ...formData,
      categoryId: normalizedCategoryId,
      // 清理规格字段,确保是纯字符串
      specification: ProductDataTransformer.cleanSpecification(
        formData.specification
      ),
      // 处理数值字段：0值转为undefined
      thickness: formData.thickness === 0 ? undefined : formData.thickness,
    };
  }

  /**
   * 清理规格字段
   * 确保规格字段是纯字符串,移除可能的 JSON 格式
   */
  private static cleanSpecification(
    specification: string | undefined
  ): string | undefined {
    if (!specification || specification.trim() === '') {
      return undefined;
    }

    const trimmed = specification.trim();

    // 检查是否是 JSON 格式,如果是则提取有效信息
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);

        // 如果是对象,尝试提取常见的规格字段
        if (typeof parsed === 'object' && parsed !== null) {
          // 尝试提取尺寸信息
          if ('size' in parsed && typeof parsed.size === 'string') {
            return parsed.size.trim() || undefined;
          }
          // 尝试提取规格信息
          if (
            'specification' in parsed &&
            typeof parsed.specification === 'string'
          ) {
            return parsed.specification.trim() || undefined;
          }
          // 如果是数组,取第一个元素
          if (Array.isArray(parsed) && parsed.length > 0) {
            const firstItem = String(parsed[0]).trim();
            return firstItem || undefined;
          }
          // 无法提取有效信息,返回 undefined
          return undefined;
        }

        // 如果解析结果是字符串,直接返回
        if (typeof parsed === 'string') {
          return parsed.trim() || undefined;
        }

        // 其他类型转为字符串
        const stringified = String(parsed).trim();
        return stringified || undefined;
      } catch {
        // JSON 解析失败,返回原始字符串
        return trimmed;
      }
    }

    // 普通字符串,直接返回
    return trimmed;
  }

  /**
   * 将API产品数据转换为表单数据
   */
  static toFormData(
    product: Product
  ): Partial<ProductCreateFormData> & { id?: string } {
    return {
      id: product.id, // 添加 id 字段用于更新操作
      code: product.code,
      name: product.name,
      specification: ProductDataTransformer.normalizeSpecification(
        product.specification
      ),
      description: product.description || '',
      unit: product.unit,
      thickness: product.thickness || undefined,
      status: product.status,
      categoryId:
        product.categoryId === null || product.categoryId === undefined
          ? 'uncategorized'
          : product.categoryId,
      // 处理图片字段
      thumbnailUrl: product.thumbnailUrl || '',
      images: product.images || [],
    };
  }

  /**
   * 规范化规格字段
   * 处理可能的 JSON 格式或其他异常格式
   */
  private static normalizeSpecification(
    specification: string | null | undefined
  ): string {
    // 空值处理
    if (!specification || specification.trim() === '') {
      return '';
    }

    const trimmed = specification.trim();

    // 检查是否是 JSON 格式
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);

        // 如果是对象,尝试提取常见的规格字段
        if (typeof parsed === 'object' && parsed !== null) {
          // 尝试提取尺寸信息
          if ('size' in parsed && typeof parsed.size === 'string') {
            return parsed.size;
          }
          // 尝试提取规格信息
          if (
            'specification' in parsed &&
            typeof parsed.specification === 'string'
          ) {
            return parsed.specification;
          }
          // 如果是数组,取第一个元素
          if (Array.isArray(parsed) && parsed.length > 0) {
            return String(parsed[0]);
          }
          // 无法提取有效信息,返回空字符串
          return '';
        }

        // 如果解析结果是字符串,直接返回
        if (typeof parsed === 'string') {
          return parsed;
        }

        // 其他类型转为字符串
        return String(parsed);
      } catch {
        // JSON 解析失败,返回原始字符串
        return trimmed;
      }
    }

    // 普通字符串,直接返回
    return trimmed;
  }
}

/**
 * 产品数据验证器
 * 提供运行时数据验证和类型守卫
 */
export class ProductDataValidator {
  /**
   * 验证产品对象是否有效
   */
  static isValidProduct(data: any): data is Product {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.id === 'string' &&
      typeof data.code === 'string' &&
      typeof data.name === 'string' &&
      typeof data.unit === 'string' &&
      typeof data.status === 'string' &&
      typeof data.createdAt === 'string' &&
      typeof data.updatedAt === 'string'
    );
  }

  /**
   * 验证产品数组是否有效
   */
  static isValidProductArray(data: any): data is Product[] {
    return Array.isArray(data) && data.every(item => this.isValidProduct(item));
  }
}

/**
 * 产品数据格式化器
 * 提供统一的数据显示格式化
 */
export class ProductDataFormatter {
  /**
   * 格式化产品重量显示
   */
  static formatWeight(weight?: number): string {
    if (!weight || weight === 0) {return '-';}
    return `${weight.toFixed(2)} kg`;
  }

  /**
   * 格式化产品厚度显示
   */
  static formatThickness(thickness?: number): string {
    if (!thickness || thickness === 0) {return '-';}
    return `${thickness.toFixed(1)} mm`;
  }

  /**
   * 格式化产品规格显示
   * 处理可能的 JSON 格式或其他异常格式
   */
  static formatSpecification(specification?: string | null): string {
    if (!specification || specification.trim() === '') {return '-';}

    const trimmed = specification.trim();

    // 检查是否是 JSON 格式
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);

        // 如果是对象,尝试提取常见的规格字段
        if (typeof parsed === 'object' && parsed !== null) {
          // 尝试提取尺寸信息
          if ('size' in parsed && typeof parsed.size === 'string') {
            return parsed.size;
          }
          // 尝试提取规格信息
          if (
            'specification' in parsed &&
            typeof parsed.specification === 'string'
          ) {
            return parsed.specification;
          }
          // 如果是数组,取第一个元素
          if (Array.isArray(parsed) && parsed.length > 0) {
            return String(parsed[0]);
          }
          // 无法提取有效信息,返回"规格详情"
          return '规格详情';
        }

        // 如果解析结果是字符串,直接返回
        if (typeof parsed === 'string') {
          return parsed;
        }

        // 其他类型转为字符串
        return String(parsed);
      } catch {
        // JSON 解析失败,截断显示
        return trimmed.length > 20 ? `${trimmed.slice(0, 20)}...` : trimmed;
      }
    }

    // 普通字符串,直接返回
    return trimmed;
  }

  /**
   * 格式化产品完整显示名称
   */
  static formatProductDisplayName(product: Product): string {
    const parts = [product.name];

    if (product.specification) {
      parts.push(`(${product.specification})`);
    }

    return parts.join(' ');
  }

  /**
   * 格式化产品编码显示
   */
  static formatProductCode(code: string): string {
    return code.toUpperCase();
  }
}

/**
 * 产品数据默认值提供器
 * 提供统一的默认值处理
 */
export class ProductDataDefaults {
  /**
   * 获取创建产品的默认值
   */
  static getCreateDefaults(): Partial<ProductCreateFormData> {
    return {
      code: '',
      name: '',
      specification: '',
      description: '',
      unit: 'piece',
      status: 'active',
      thickness: undefined,
      images: [],
      categoryId: 'uncategorized',
    };
  }

  /**
   * 获取更新产品的默认值
   */
  static getUpdateDefaults(): Partial<ProductUpdateFormData> {
    return {
      specification: '',
      description: '',
      thickness: undefined,
    };
  }
}

/**
 * 产品数据工具函数集合
 * 提供便捷的数据处理函数
 */
export const ProductDataUtils = {
  transformer: ProductDataTransformer,
  validator: ProductDataValidator,
  formatter: ProductDataFormatter,
  defaults: ProductDataDefaults,
} as const;
