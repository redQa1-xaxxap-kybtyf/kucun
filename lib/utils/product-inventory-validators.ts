/**
 * 产品和库存验证工具类
 * 提供统一的产品和库存相关验证方法
 * 遵循全局约定规范和唯一真理原则
 */

import { prisma } from '@/lib/db';

/**
 * 产品删除检查结果
 */
export interface ProductDeletionCheck {
  canDelete: boolean;
  reason?: string;
  relatedCounts: {
    inventory: number;
    salesOrderItems: number;
    inboundRecords: number;
    outboundRecords: number;
    inventoryAdjustments: number;
    batchSpecifications: number;
    factoryShipmentOrderItems: number;
    returnOrderItems: number;
  };
}

/**
 * 变体删除检查结果
 */
export interface VariantDeletionCheck {
  canDelete: boolean;
  reason?: string;
  hasInventory: boolean;
  hasReservedQuantity: boolean;
  relatedCounts: {
    inboundRecords: number;
    outboundRecords: number;
    inventoryAdjustments: number;
  };
}

/**
 * 产品和库存验证器
 */
export class ProductInventoryValidator {
  /**
   * 验证产品状态是否允许库存操作
   * @param productId 产品ID
   * @throws 如果产品不存在或状态不允许操作
   */
  static async validateProductStatus(productId: string): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { status: true, name: true },
    });

    if (!product) {
      throw new Error('产品不存在');
    }

    if (product.status !== 'active') {
      throw new Error(`产品"${product.name}"已停用,无法进行库存操作`);
    }
  }

  /**
   * 验证产品变体状态是否允许库存操作
   * @param variantId 变体ID
   * @throws 如果变体不存在或状态不允许操作
   */
  static async validateVariantStatus(variantId: string): Promise<void> {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        status: true,
        colorCode: true,
        product: { select: { name: true } },
      },
    });

    if (!variant) {
      throw new Error('产品变体不存在');
    }

    if (variant.status !== 'active') {
      throw new Error(
        `产品"${variant.product.name}"的变体"${variant.colorCode}"已停用,无法进行库存操作`
      );
    }
  }

  /**
   * 验证产品和变体的匹配关系
   * @param productId 产品ID
   * @param variantId 变体ID(可选)
   * @throws 如果变体不属于指定产品
   */
  static async validateProductVariantMatch(
    productId: string,
    variantId?: string
  ): Promise<void> {
    if (!variantId) return;

    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      select: { productId: true, colorCode: true },
    });

    if (!variant) {
      throw new Error('产品变体不存在');
    }

    if (variant.productId !== productId) {
      throw new Error(
        `产品变体"${variant.colorCode}"不属于指定产品,请检查参数`
      );
    }
  }

  /**
   * 检查产品是否可以删除
   * @param productId 产品ID
   * @returns 删除检查结果
   */
  static async canDeleteProduct(
    productId: string
  ): Promise<ProductDeletionCheck> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        _count: {
          select: {
            variants: true,
            inventory: true,
            salesOrderItems: true,
            inboundRecords: true,
            outboundRecords: true,
            inventoryAdjustments: true,
            batchSpecifications: true,
            factoryShipmentOrderItems: true,
            returnOrderItems: true,
          },
        },
      },
    });

    if (!product) {
      throw new Error('产品不存在');
    }

    const counts = product._count;
    const relatedCounts = {
      inventory: counts.inventory,
      salesOrderItems: counts.salesOrderItems,
      inboundRecords: counts.inboundRecords,
      outboundRecords: counts.outboundRecords,
      inventoryAdjustments: counts.inventoryAdjustments,
      batchSpecifications: counts.batchSpecifications,
      factoryShipmentOrderItems: counts.factoryShipmentOrderItems,
      returnOrderItems: counts.returnOrderItems,
    };

    const hasRelatedData = Object.values(relatedCounts).some(
      count => count > 0
    );

    if (hasRelatedData) {
      const reasons: string[] = [];
      if (counts.inventory > 0) reasons.push(`库存记录(${counts.inventory}条)`);
      if (counts.salesOrderItems > 0)
        reasons.push(`销售订单项(${counts.salesOrderItems}条)`);
      if (counts.inboundRecords > 0)
        reasons.push(`入库记录(${counts.inboundRecords}条)`);
      if (counts.outboundRecords > 0)
        reasons.push(`出库记录(${counts.outboundRecords}条)`);
      if (counts.inventoryAdjustments > 0)
        reasons.push(`库存调整记录(${counts.inventoryAdjustments}条)`);
      if (counts.batchSpecifications > 0)
        reasons.push(`批次规格(${counts.batchSpecifications}条)`);
      if (counts.factoryShipmentOrderItems > 0)
        reasons.push(`工厂发货单项(${counts.factoryShipmentOrderItems}条)`);
      if (counts.returnOrderItems > 0)
        reasons.push(`退货单项(${counts.returnOrderItems}条)`);

      return {
        canDelete: false,
        reason: `该产品存在关联记录: ${reasons.join('、')}。如需停用请修改产品状态为inactive。`,
        relatedCounts,
      };
    }

    return {
      canDelete: true,
      relatedCounts,
    };
  }

  /**
   * 检查产品变体是否可以删除
   * @param variantId 变体ID
   * @returns 删除检查结果
   */
  static async canDeleteVariant(
    variantId: string
  ): Promise<VariantDeletionCheck> {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        inventory: {
          select: {
            id: true,
            quantity: true,
            reservedQuantity: true,
          },
        },
        _count: {
          select: {
            inboundRecords: true,
            outboundRecords: true,
            inventoryAdjustments: true,
          },
        },
      },
    });

    if (!variant) {
      throw new Error('产品变体不存在');
    }

    // 检查库存
    const hasInventory = variant.inventory.some(inv => inv.quantity > 0);
    const hasReservedQuantity = variant.inventory.some(
      inv => inv.reservedQuantity > 0
    );

    const counts = variant._count;
    const relatedCounts = {
      inboundRecords: counts.inboundRecords,
      outboundRecords: counts.outboundRecords,
      inventoryAdjustments: counts.inventoryAdjustments,
    };

    const hasRecords = Object.values(relatedCounts).some(count => count > 0);

    if (hasInventory || hasReservedQuantity || hasRecords) {
      const reasons: string[] = [];
      if (hasInventory) reasons.push('存在库存');
      if (hasReservedQuantity) reasons.push('存在预留库存');
      if (counts.inboundRecords > 0)
        reasons.push(`入库记录(${counts.inboundRecords}条)`);
      if (counts.outboundRecords > 0)
        reasons.push(`出库记录(${counts.outboundRecords}条)`);
      if (counts.inventoryAdjustments > 0)
        reasons.push(`库存调整记录(${counts.inventoryAdjustments}条)`);

      return {
        canDelete: false,
        reason: `该变体${reasons.join('、')},无法删除。如需停用请修改变体状态为inactive。`,
        hasInventory,
        hasReservedQuantity,
        relatedCounts,
      };
    }

    return {
      canDelete: true,
      hasInventory: false,
      hasReservedQuantity: false,
      relatedCounts,
    };
  }

  /**
   * 验证产品单位是否可以修改
   * @param productId 产品ID
   * @param newUnit 新单位
   * @param newPiecesPerUnit 新的每件片数
   * @throws 如果产品有库存且单位或每件片数发生变化
   */
  static async validateProductUnitChange(
    productId: string,
    newUnit?: string,
    newPiecesPerUnit?: number
  ): Promise<void> {
    if (!newUnit && !newPiecesPerUnit) return;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        unit: true,
        piecesPerUnit: true,
        name: true,
      },
    });

    if (!product) {
      throw new Error('产品不存在');
    }

    // 检查是否有变化
    const unitChanged = newUnit && newUnit !== product.unit;
    const piecesPerUnitChanged =
      newPiecesPerUnit !== undefined &&
      newPiecesPerUnit !== product.piecesPerUnit;

    if (!unitChanged && !piecesPerUnitChanged) {
      return; // 没有变化,无需检查
    }

    // 检查是否有库存
    const inventoryCount = await prisma.inventory.count({
      where: {
        productId,
        quantity: { gt: 0 },
      },
    });

    if (inventoryCount > 0) {
      throw new Error(
        `产品"${product.name}"已有${inventoryCount}条库存记录,无法修改单位或每件片数。` +
          '如需修改,请先清空库存或联系管理员。'
      );
    }
  }

  /**
   * 综合验证库存操作前的所有条件
   * @param productId 产品ID
   * @param variantId 变体ID(可选)
   * @throws 如果任何验证失败
   */
  static async validateInventoryOperation(
    productId: string,
    variantId?: string
  ): Promise<void> {
    // 1. 验证产品状态
    await this.validateProductStatus(productId);

    // 2. 如果有变体,验证变体状态和匹配关系
    if (variantId) {
      await this.validateVariantStatus(variantId);
      await this.validateProductVariantMatch(productId, variantId);
    }
  }
}
