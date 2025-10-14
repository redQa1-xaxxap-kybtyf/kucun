import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import {
  productVariantGenerateSkuSchema,
  productVariantBatchGenerateSkuSchema,
} from '@/lib/validations/product';

interface BatchGenerateSkuItem {
  productCode: string;
  colorCode: string;
  customSuffix?: string;
}

interface BatchGenerateSkuResult {
  productCode: string;
  colorCode: string;
  customSuffix?: string;
  originalSku: string;
  sku: string;
  isGenerated: boolean;
  conflict?:
    | {
        reason: string;
      }
    | undefined;
}

type PreparedSkuItem = BatchGenerateSkuItem & { baseSku: string };

// SKU生成服务
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();

    // 验证输入数据
    const validationResult = productVariantGenerateSkuSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { productCode, colorCode, customSuffix } = validationResult.data;

    // 生成基础SKU
    let baseSku = `${productCode}-${colorCode}`;
    if (customSuffix) {
      baseSku += `-${customSuffix}`;
    }

    // 检查基础SKU是否可用
    const existingBaseSku = await prisma.productVariant.findUnique({
      where: { sku: baseSku },
      select: { id: true },
    });

    if (!existingBaseSku) {
      // 基础SKU可用，直接返回
      return NextResponse.json({
        success: true,
        data: {
          sku: baseSku,
          isGenerated: false,
          suggestions: [baseSku],
        },
      });
    }

    // 基础SKU已存在，生成带序号的SKU
    const suggestions: string[] = [];
    let availableSku: string | null = null;

    // 查找已存在的相似SKU
    const existingSkus = await prisma.productVariant.findMany({
      where: {
        sku: {
          startsWith: baseSku,
        },
      },
      select: { sku: true },
      orderBy: { sku: 'asc' },
    });

    const existingSkuSet = new Set(existingSkus.map(v => v.sku));

    // 生成建议的SKU（带序号）
    for (let i = 1; i <= 99; i++) {
      const numberedSku = `${baseSku}-${i.toString().padStart(2, '0')}`;
      suggestions.push(numberedSku);

      if (!availableSku && !existingSkuSet.has(numberedSku)) {
        availableSku = numberedSku;
      }

      // 最多生成10个建议
      if (suggestions.length >= 10) {
        break;
      }
    }

    // 如果还是没有找到可用的SKU，使用时间戳
    if (!availableSku) {
      const timestamp = Date.now().toString().slice(-6);
      availableSku = `${baseSku}-${timestamp}`;
      suggestions.unshift(availableSku);
    }

    return NextResponse.json({
      success: true,
      data: {
        sku: availableSku,
        isGenerated: true,
        suggestions: suggestions.slice(0, 10), // 最多返回10个建议
        conflict: {
          originalSku: baseSku,
          reason: 'SKU已存在，已自动生成新的SKU',
        },
      },
    });
  } catch (error) {
    logger.error('product-variants', '生成SKU失败', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '生成SKU失败',
      },
      { status: 500 }
    );
  }
});

// 批量生成SKU
export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();

    // 批量生成SKU输入验证
    const validationResult =
      productVariantBatchGenerateSkuSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { items } = validationResult.data;

    // 生成所有基础SKU
    const baseSkus: PreparedSkuItem[] = items.map(
      (item: BatchGenerateSkuItem) => {
        let baseSku = `${item.productCode}-${item.colorCode}`;
        if (item.customSuffix) {
          baseSku += `-${item.customSuffix}`;
        }
        return {
          ...item,
          baseSku,
        } satisfies PreparedSkuItem;
      }
    );

    // 检查内部重复
    const skuCounts = new Map<string, number>();
    baseSkus.forEach(item => {
      skuCounts.set(item.baseSku, (skuCounts.get(item.baseSku) || 0) + 1);
    });

    // 查询数据库中已存在的SKU
    const allBaseSkus = Array.from(skuCounts.keys());
    const existingSkus = await prisma.productVariant.findMany({
      where: {
        OR: allBaseSkus.map(sku => ({
          sku: { startsWith: sku },
        })),
      },
      select: { sku: true },
    });

    const existingSkuSet = new Set(existingSkus.map(v => v.sku));

    // 为每个项目生成可用的SKU
    const results: BatchGenerateSkuResult[] = baseSkus.map(
      (item, index): BatchGenerateSkuResult => {
        const { baseSku } = item;
        const duplicateCount = skuCounts.get(baseSku) || 1;
        const isInternalDuplicate = duplicateCount > 1;

        let finalSku = baseSku;
        let isGenerated = false;

        // 如果是内部重复或数据库中已存在，生成新的SKU
        if (isInternalDuplicate || existingSkuSet.has(baseSku)) {
          // 为内部重复的项目添加序号
          if (isInternalDuplicate) {
            const currentIndex = baseSkus
              .slice(0, index + 1)
              .filter(b => b.baseSku === baseSku).length;
            finalSku = `${baseSku}-${currentIndex.toString().padStart(2, '0')}`;
          }

          // 如果生成的SKU仍然存在，继续生成
          let counter = 1;
          while (existingSkuSet.has(finalSku)) {
            finalSku = `${baseSku}-${counter.toString().padStart(2, '0')}`;
            counter++;

            // 防止无限循环
            if (counter > 999) {
              const timestamp = Date.now().toString().slice(-6);
              finalSku = `${baseSku}-${timestamp}`;
              break;
            }
          }

          isGenerated = true;
          // 将生成的SKU添加到已存在集合中，避免后续重复
          existingSkuSet.add(finalSku);
        }

        return {
          productCode: item.productCode,
          colorCode: item.colorCode,
          customSuffix: item.customSuffix,
          originalSku: baseSku,
          sku: finalSku,
          isGenerated,
          conflict: isGenerated
            ? {
                reason: isInternalDuplicate
                  ? '批量生成中存在重复'
                  : 'SKU已存在',
              }
            : undefined,
        };
      }
    );

    return NextResponse.json({
      success: true,
      data: results,
      summary: {
        total: results.length,
        generated: results.filter(r => r.isGenerated).length,
        conflicts: results.filter(r => r.conflict).length,
      },
    });
  } catch (error) {
    logger.error('product-variants', '批量生成SKU失败', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '批量生成SKU失败',
      },
      { status: 500 }
    );
  }
});
