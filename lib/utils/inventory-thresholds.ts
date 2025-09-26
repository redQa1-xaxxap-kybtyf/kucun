/**
 * 库存阈值配置管理工具
 * 实现产品级别的库存阈值配置，优先使用产品特定的最小/最大库存值
 */

import { INVENTORY_THRESHOLDS } from '@/lib/types/inventory-status';

// 产品库存阈值配置接口
export interface ProductInventoryThresholds {
  productId: string;
  minQuantity?: number; // 最小库存（安全库存）
  maxQuantity?: number; // 最大库存
  criticalQuantity?: number; // 紧急库存阈值
  overstockMultiplier?: number; // 库存过多倍数
}

// 产品信息接口（简化版）
export interface ProductInfo {
  id: string;
  name: string;
  code: string;
  minStock?: number; // 产品表中的最小库存字段
  maxStock?: number; // 产品表中的最大库存字段
  safetyStock?: number; // 安全库存字段
}

// 库存阈值配置管理器
export class InventoryThresholdManager {
  private static instance: InventoryThresholdManager;
  private productThresholds: Map<string, ProductInventoryThresholds> =
    new Map();

  private constructor() {}

  public static getInstance(): InventoryThresholdManager {
    if (!InventoryThresholdManager.instance) {
      InventoryThresholdManager.instance = new InventoryThresholdManager();
    }
    return InventoryThresholdManager.instance;
  }

  /**
   * 设置产品库存阈值
   */
  public setProductThresholds(
    productId: string,
    thresholds: Omit<ProductInventoryThresholds, 'productId'>
  ): void {
    this.productThresholds.set(productId, {
      productId,
      ...thresholds,
    });
  }

  /**
   * 获取产品库存阈值
   */
  public getProductThresholds(
    productId: string
  ): ProductInventoryThresholds | null {
    return this.productThresholds.get(productId) || null;
  }

  /**
   * 清除产品库存阈值
   */
  public clearProductThresholds(productId: string): void {
    this.productThresholds.delete(productId);
  }

  /**
   * 清除所有产品库存阈值
   */
  public clearAllThresholds(): void {
    this.productThresholds.clear();
  }
}

// 库存阈值计算工具
export const inventoryThresholdUtils = {
  /**
   * 获取产品的最小库存阈值
   * 优先级：产品特定配置 > 产品表字段 > 系统默认值
   */
  getMinQuantity: (
    productId: string,
    productInfo?: ProductInfo,
    customThresholds?: ProductInventoryThresholds
  ): number => {
    // 1. 优先使用自定义阈值
    if (customThresholds?.minQuantity !== undefined) {
      return customThresholds.minQuantity;
    }

    // 2. 使用阈值管理器中的配置
    const manager = InventoryThresholdManager.getInstance();
    const productThresholds = manager.getProductThresholds(productId);
    if (productThresholds?.minQuantity !== undefined) {
      return productThresholds.minQuantity;
    }

    // 3. 使用产品表中的字段
    if (productInfo?.safetyStock !== undefined && productInfo.safetyStock > 0) {
      return productInfo.safetyStock;
    }
    if (productInfo?.minStock !== undefined && productInfo.minStock > 0) {
      return productInfo.minStock;
    }

    // 4. 使用系统默认值
    return INVENTORY_THRESHOLDS.DEFAULT_MIN_QUANTITY;
  },

  /**
   * 获取产品的最大库存阈值
   * 优先级：产品特定配置 > 产品表字段 > 系统默认值
   */
  getMaxQuantity: (
    productId: string,
    productInfo?: ProductInfo,
    customThresholds?: ProductInventoryThresholds
  ): number => {
    // 1. 优先使用自定义阈值
    if (customThresholds?.maxQuantity !== undefined) {
      return customThresholds.maxQuantity;
    }

    // 2. 使用阈值管理器中的配置
    const manager = InventoryThresholdManager.getInstance();
    const productThresholds = manager.getProductThresholds(productId);
    if (productThresholds?.maxQuantity !== undefined) {
      return productThresholds.maxQuantity;
    }

    // 3. 使用产品表中的字段
    if (productInfo?.maxStock !== undefined && productInfo.maxStock > 0) {
      return productInfo.maxStock;
    }

    // 4. 使用系统默认值（基于最小库存的倍数）
    const minQuantity = inventoryThresholdUtils.getMinQuantity(
      productId,
      productInfo,
      customThresholds
    );
    return minQuantity * 50; // 默认最大库存为最小库存的50倍
  },

  /**
   * 获取产品的紧急库存阈值
   */
  getCriticalQuantity: (
    productId: string,
    productInfo?: ProductInfo,
    customThresholds?: ProductInventoryThresholds
  ): number => {
    // 1. 优先使用自定义阈值
    if (customThresholds?.criticalQuantity !== undefined) {
      return customThresholds.criticalQuantity;
    }

    // 2. 使用阈值管理器中的配置
    const manager = InventoryThresholdManager.getInstance();
    const productThresholds = manager.getProductThresholds(productId);
    if (productThresholds?.criticalQuantity !== undefined) {
      return productThresholds.criticalQuantity;
    }

    // 3. 使用系统默认值
    return INVENTORY_THRESHOLDS.CRITICAL_MIN_QUANTITY;
  },

  /**
   * 获取库存过多阈值
   */
  getOverstockThreshold: (
    productId: string,
    productInfo?: ProductInfo,
    customThresholds?: ProductInventoryThresholds
  ): number => {
    const minQuantity = inventoryThresholdUtils.getMinQuantity(
      productId,
      productInfo,
      customThresholds
    );

    // 获取库存过多倍数
    let multiplier = INVENTORY_THRESHOLDS.OVERSTOCK_MULTIPLIER;

    if (customThresholds?.overstockMultiplier !== undefined) {
      multiplier = customThresholds.overstockMultiplier;
    } else {
      const manager = InventoryThresholdManager.getInstance();
      const productThresholds = manager.getProductThresholds(productId);
      if (productThresholds?.overstockMultiplier !== undefined) {
        multiplier = productThresholds.overstockMultiplier;
      }
    }

    return minQuantity * multiplier;
  },

  /**
   * 获取产品的完整阈值配置
   */
  getCompleteThresholds: (
    productId: string,
    productInfo?: ProductInfo,
    customThresholds?: ProductInventoryThresholds
  ) => ({
    minQuantity: inventoryThresholdUtils.getMinQuantity(
      productId,
      productInfo,
      customThresholds
    ),
    maxQuantity: inventoryThresholdUtils.getMaxQuantity(
      productId,
      productInfo,
      customThresholds
    ),
    criticalQuantity: inventoryThresholdUtils.getCriticalQuantity(
      productId,
      productInfo,
      customThresholds
    ),
    overstockThreshold: inventoryThresholdUtils.getOverstockThreshold(
      productId,
      productInfo,
      customThresholds
    ),
  }),

  /**
   * 从产品信息创建阈值配置
   */
  createThresholdsFromProduct: (
    productInfo: ProductInfo
  ): ProductInventoryThresholds => ({
    productId: productInfo.id,
    minQuantity: productInfo.safetyStock || productInfo.minStock,
    maxQuantity: productInfo.maxStock,
  }),

  /**
   * 批量设置产品阈值
   */
  setBatchThresholds: (products: ProductInfo[]): void => {
    const manager = InventoryThresholdManager.getInstance();

    products.forEach(product => {
      const thresholds =
        inventoryThresholdUtils.createThresholdsFromProduct(product);
      manager.setProductThresholds(product.id, thresholds);
    });
  },
};

// 导出单例实例
export const thresholdManager = InventoryThresholdManager.getInstance();
