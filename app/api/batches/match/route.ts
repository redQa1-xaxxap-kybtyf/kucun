// 批次匹配 API
// 用于查询是否存在匹配的现有批次

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import type { BatchMatchResult, ExistingBatch } from '@/lib/types/batch';
import { toNumberOrNull } from '@/lib/utils/number';

// 批次匹配查询参数验证
const batchMatchQuerySchema = z.object({
  productId: z.string().uuid('产品信息格式不正确'),
  productCode: z.string().min(1, '产品编码不能为空'),
  // 供应商ID 改为可选：仅用于补充显示，不再作为过滤条件
  supplierId: z
    .string()
    .uuid('供应商信息格式不正确')
    .optional()
    .or(z.literal('')),
  specification: z.string().optional(),
});

/**
 * GET /api/batches/match
 * 查询匹配的现有批次
 *
 * 查询参数:
 * - productId: 产品ID (必填)
 * - productCode: 产品编码 (必填)
 * - supplierId: 供应商ID (可选，用于补充显示供应商名称)
 * - specification: 规格 (可选)
 *
 * 匹配条件:
 * - 相同产品ID
 * - 相同产品编码
 * - 相同规格(如果提供)
 * - 库存数量 > 0
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      // 解析查询参数
      const { searchParams } = new URL(request.url);
      const queryParams = {
        productId: searchParams.get('productId') || '',
        productCode: searchParams.get('productCode') || '',
        supplierId: searchParams.get('supplierId') || '',
        specification: searchParams.get('specification') || undefined,
      };

      // 验证参数
      const validatedParams = batchMatchQuerySchema.parse(queryParams);

      // 构建查询条件
      const whereCondition: {
        productId: string;
        batchNumber: { not: null };
        quantity: { gt: number };
        product?: {
          code: string;
          specification?: string | null;
        };
      } = {
        productId: validatedParams.productId,
        batchNumber: { not: null }, // 只查询有批次号的库存
        quantity: { gt: 0 }, // 只查询有库存的批次
      };

      // 添加产品编码和规格条件
      whereCondition.product = {
        code: validatedParams.productCode,
      };

      if (validatedParams.specification) {
        whereCondition.product.specification = validatedParams.specification;
      }

      // 查询匹配的批次
      const inventoryBatches = await prisma.inventory.findMany({
        where: whereCondition,
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              specification: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc', // 按最后更新时间倒序
        },
        take: 200,
      });

      // 如果没有找到匹配的批次,直接返回
      if (inventoryBatches.length === 0) {
        const result: BatchMatchResult = {
          hasMatch: false,
          batches: [],
          count: 0,
        };

        return NextResponse.json({
          data: result,
          error: null,
        });
      }

      // 获取批次对应的供应商信息
      // 通过采购订单项查询批次的供应商
      const batchNumbers = inventoryBatches
        .map(inv => inv.batchNumber)
        .filter((bn): bn is string => bn !== null);

      const purchaseOrderItems = await prisma.purchaseOrderItem.findMany({
        where: {
          batchNumber: { in: batchNumbers },
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        distinct: ['batchNumber'],
        take: batchNumbers.length,
      });

      // 创建批次号到供应商的映射
      const batchSupplierMap = new Map(
        purchaseOrderItems.map(item => [
          item.batchNumber,
          {
            supplierId: item.supplierId,
            supplierName: item.supplier.name,
          },
        ])
      );

      // 过滤出匹配供应商的批次
      const matchedBatches: ExistingBatch[] = inventoryBatches.map(inv => {
        const supplierInfo = batchSupplierMap.get(inv.batchNumber || '');
        return {
          batchNumber: inv.batchNumber || '',
          productId: inv.productId,
          productCode: inv.product.code,
          productName: inv.product.name,
          specification: inv.product.specification,
          supplierId: supplierInfo?.supplierId || '',
          supplierName: supplierInfo?.supplierName || '',
          quantity: inv.quantity,
          unitCost: toNumberOrNull(inv.unitCost),
          createdAt: inv.updatedAt, // 使用 updatedAt 作为创建时间的近似值
          updatedAt: inv.updatedAt,
        };
      });

      const result: BatchMatchResult = {
        hasMatch: matchedBatches.length > 0,
        batches: matchedBatches,
        count: matchedBatches.length,
      };

      return NextResponse.json({
        data: result,
        error: null,
      });
    } catch (error) {
      console.error('[批次匹配API] 查询失败:', error);

      // Zod 验证错误
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            data: null,
            error: {
              message: '提交内容有误，请检查后重试',
              details: error.issues,
            },
          },
          { status: 400 }
        );
      }

      // 其他错误
      return NextResponse.json(
        {
          data: null,
          error: {
            message: error instanceof Error ? error.message : '查询批次失败',
          },
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['inventory:view'] }
);
