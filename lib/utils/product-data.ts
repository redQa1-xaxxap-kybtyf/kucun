/**
 * 产品数据处理工具函数
 * 遵循唯一真理源原则，统一产品数据的处理逻辑
 */

import type { Product, TileSpecifications } from '@/lib/types/product';
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
    return {
      ...formData,
      // 处理数值字段：0值转为undefined，避免不必要的存储
      weight: formData.weight === 0 ? undefined : formData.weight,
      thickness: formData.thickness === 0 ? undefined : formData.thickness,
      // 确保规格信息的完整性
      specifications: formData.specifications
        ? this.normalizeSpecifications(formData.specifications)
        : undefined,
    };
  }

  /**
   * 将表单数据转换为API更新数据
   */
  static toUpdateApiData(
    formData: ProductUpdateFormData
  ): ProductUpdateFormData {
    return {
      ...formData,
      // 处理数值字段：0值转为undefined
      weight: formData.weight === 0 ? undefined : formData.weight,
      thickness: formData.thickness === 0 ? undefined : formData.thickness,
      // 确保规格信息的完整性
      specifications: formData.specifications
        ? this.normalizeSpecifications(formData.specifications)
        : undefined,
    };
  }

  /**
   * 将API产品数据转换为表单数据
   */
  static toFormData(product: Product): Partial<ProductCreateFormData> {
    return {
      code: product.code,
      name: product.name,
      specification: product.specification || '',
      unit: product.unit,
      piecesPerUnit: product.piecesPerUnit,
      weight: product.weight || undefined,
      thickness: product.thickness || undefined,
      status: product.status,
      categoryId: product.categoryId || undefined,
      specifications: product.specifications
        ? this.normalizeSpecifications(product.specifications)
        : undefined,
    };
  }

  /**
   * 标准化规格信息
   * 确保规格数据的一致性和完整性
   */
  private static normalizeSpecifications(
    specs: TileSpecifications | Record<string, any>
  ): TileSpecifications {
    const normalized: TileSpecifications = {};

    // 标准化已知字段
    if (specs.color) normalized.color = String(specs.color).trim();
    if (specs.surface) normalized.surface = String(specs.surface).trim();
    if (specs.size) normalized.size = String(specs.size).trim();
    if (specs.pattern) normalized.pattern = String(specs.pattern).trim();
    if (specs.grade) normalized.grade = String(specs.grade).trim();
    if (specs.origin) normalized.origin = String(specs.origin).trim();
    if (specs.series) normalized.series = String(specs.series).trim();

    // 处理厚度字段（数值类型）
    if (specs.thickness !== undefined && specs.thickness !== null) {
      const thickness = Number(specs.thickness);
      if (!isNaN(thickness) && thickness > 0) {
        normalized.thickness = thickness;
      }
    }

    // 保留其他自定义字段
    Object.keys(specs).forEach(key => {
      if (
        ![
          'color',
          'surface',
          'size',
          'pattern',
          'grade',
          'origin',
          'series',
          'thickness',
        ].includes(key) &&
        specs[key] !== undefined &&
        specs[key] !== null &&
        specs[key] !== ''
      ) {
        normalized[key] = specs[key];
      }
    });

    return normalized;
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
      typeof data.piecesPerUnit === 'number' &&
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

  /**
   * 验证规格信息是否有效
   */
  static isValidSpecifications(data: any): data is TileSpecifications {
    if (!data || typeof data !== 'object') return false;

    // 检查已知字段的类型
    const validStringFields = [
      'color',
      'surface',
      'size',
      'pattern',
      'grade',
      'origin',
      'series',
    ];
    for (const field of validStringFields) {
      if (data[field] !== undefined && typeof data[field] !== 'string') {
        return false;
      }
    }

    // 检查厚度字段
    if (data.thickness !== undefined && typeof data.thickness !== 'number') {
      return false;
    }

    return true;
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
    if (!weight || weight === 0) return '-';
    return `${weight.toFixed(2)} kg`;
  }

  /**
   * 格式化产品厚度显示
   */
  static formatThickness(thickness?: number): string {
    if (!thickness || thickness === 0) return '-';
    return `${thickness.toFixed(1)} mm`;
  }

  /**
   * 格式化产品规格显示
   */
  static formatSpecification(specification?: string): string {
    if (!specification || specification.trim() === '') return '-';
    return specification.trim();
  }

  /**
   * 格式化规格信息为显示文本
   */
  static formatSpecifications(specs?: TileSpecifications): string {
    if (!specs) return '-';

    const parts: string[] = [];

    if (specs.color) parts.push(`颜色: ${specs.color}`);
    if (specs.surface) parts.push(`表面: ${specs.surface}`);
    if (specs.size) parts.push(`尺寸: ${specs.size}`);
    if (specs.thickness) parts.push(`厚度: ${specs.thickness}mm`);
    if (specs.pattern) parts.push(`花纹: ${specs.pattern}`);
    if (specs.grade) parts.push(`等级: ${specs.grade}`);

    return parts.length > 0 ? parts.join(', ') : '-';
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
      unit: 'piece',
      piecesPerUnit: 1,
      status: 'active',
      specification: '',
      weight: undefined,
      thickness: undefined,
      specifications: {},
    };
  }

  /**
   * 获取更新产品的默认值
   */
  static getUpdateDefaults(): Partial<ProductUpdateFormData> {
    return {
      specification: '',
      weight: undefined,
      thickness: undefined,
      specifications: {},
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
