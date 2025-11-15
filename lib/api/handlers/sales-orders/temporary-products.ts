/**
 * 临时产品自动创建和复用逻辑
 *
 * 功能说明:
 * - 调货销售时,自动根据供应商ID和产品编码查找或创建临时产品记录
 * - 同一供应商+同一编码 → 复用现有记录并更新使用统计
 * - 不同供应商可以有相同编码
 *
 * 使用场景:
 * - 销售订单创建时(TRANSFER 模式)
 * - 厂家发货订单创建时(使用手动输入产品)
 */

import type { PrismaClient } from '@prisma/client';

// Prisma 事务类型
type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * 临时产品数据接口
 */
export interface TemporaryProductData {
  supplierId: string; // 供应商ID (从订单中获取)
  code: string; // 产品编码 (必填)
  name: string; // 产品名称 (必填)
  specification?: string | null; // 规格
  weight?: number | null; // 重量
  unit?: string; // 单位 (默认: "片")
  piecesPerUnit?: number; // 每件片数 (默认: 1)
  createdBy: string; // 创建人ID
}

/**
 * 查找或创建临时产品
 *
 * 逻辑流程:
 * 1. 根据 supplierId + code 查找现有记录
 * 2. 如果找到: 更新 usageCount 和 lastUsedAt
 * 3. 如果未找到: 创建新记录并初始化使用统计
 *
 * @param tx - Prisma 事务对象
 * @param data - 临时产品数据
 * @returns 临时产品记录
 */
export async function findOrCreateTemporaryProduct(
  tx: PrismaTransaction,
  data: TemporaryProductData
) {
  // 1. 尝试查找现有记录 (同一供应商 + 同一编码)
  let tempProduct = await tx.temporaryProduct.findUnique({
    where: {
      supplierId_code: {
        supplierId: data.supplierId,
        code: data.code,
      },
    },
  });

  if (tempProduct) {
    // 2a. 找到现有记录 - 更新使用统计
    tempProduct = await tx.temporaryProduct.update({
      where: { id: tempProduct.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
        // 可选: 更新产品信息为最新输入的值
        name: data.name,
        specification: data.specification ?? tempProduct.specification,
        weight: data.weight ?? tempProduct.weight,
        unit: data.unit ?? tempProduct.unit,
        piecesPerUnit: data.piecesPerUnit ?? tempProduct.piecesPerUnit,
      },
    });
  } else {
    // 2b. 未找到记录 - 创建新临时产品
    tempProduct = await tx.temporaryProduct.create({
      data: {
        supplierId: data.supplierId,
        code: data.code,
        name: data.name,
        specification: data.specification || null,
        weight: data.weight || null,
        unit: data.unit || '片',
        piecesPerUnit: data.piecesPerUnit || 1,
        createdBy: data.createdBy,
        usageCount: 1, // 初始使用次数为 1
        lastUsedAt: new Date(), // 设置首次使用时间
      },
    });
  }

  return tempProduct;
}

/**
 * 从销售订单项数据构建临时产品数据
 *
 * @param item - 销售订单项数据
 * @param supplierId - 供应商ID
 * @param userId - 用户ID
 * @returns 临时产品数据或 null
 */
export function buildTemporaryProductDataFromOrderItem(
  item: {
    isManualProduct?: boolean;
    productCode?: string | null;
    manualProductName?: string | null;
    manualSpecification?: string | null;
    manualWeight?: number | null;
    manualUnit?: string | null;
    piecesPerUnit?: number | null;
  },
  supplierId: string,
  userId: string
): TemporaryProductData | null {
  // 只有手动输入产品且有产品编码和产品名称时才创建临时产品记录
  if (
    !item.isManualProduct ||
    !item.productCode ||
    !item.manualProductName ||
    item.manualProductName.trim() === ''
  ) {
    return null;
  }

  return {
    supplierId,
    code: item.productCode,
    name: item.manualProductName, // 产品名称现在是必填字段
    specification: item.manualSpecification || null,
    weight: item.manualWeight || null,
    unit: item.manualUnit || '片',
    piecesPerUnit: item.piecesPerUnit || 1,
    createdBy: userId,
  };
}
