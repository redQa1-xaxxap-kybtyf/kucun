import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// SKU检查查询参数验证
const CheckSkuQuerySchema = z.object({
  sku: z.string().min(1, 'SKU不能为空').max(50, 'SKU不能超过50个字符'),
  excludeId: z.string().uuid('排除的变体ID格式不正确').optional(),
});

// SKU可用性检查服务
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      sku: searchParams.get('sku') || '',
      excludeId: searchParams.get('excludeId') || undefined,
    };

    // 验证查询参数
    const validationResult = CheckSkuQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { sku, excludeId } = validationResult.data;

    // 构建查询条件
    const where: { sku: string; id?: { not: string } } = { sku };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    // 检查SKU是否已存在
    const existingVariant = await prisma.productVariant.findFirst({
      where,
      select: {
        id: true,
        sku: true,
        colorCode: true,
        status: true,
        product: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    const available = !existingVariant;

    // 如果SKU不可用，提供相关信息
    let conflictInfo = null;
    if (!available && existingVariant) {
      conflictInfo = {
        variantId: existingVariant.id,
        sku: existingVariant.sku,
        colorCode: existingVariant.colorCode,
        status: existingVariant.status,
        product: existingVariant.product,
      };
    }

    // 生成建议的替代SKU
    let suggestions: string[] = [];
    if (!available) {
      suggestions = await generateSkuSuggestions(sku);
    }

    return NextResponse.json({
      success: true,
      data: {
        sku,
        available,
        conflict: conflictInfo,
        suggestions: suggestions.slice(0, 5), // 最多返回5个建议
      },
    });
  } catch (error) {
    console.error('检查SKU可用性错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '检查SKU可用性失败',
      },
      { status: 500 }
    );
  }
}

// 批量SKU可用性检查
export async function POST(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 批量检查输入验证
    const BatchCheckSkuSchema = z.object({
      skus: z
        .array(
          z.object({
            sku: z
              .string()
              .min(1, 'SKU不能为空')
              .max(50, 'SKU不能超过50个字符'),
            excludeId: z.string().uuid('排除的变体ID格式不正确').optional(),
          })
        )
        .min(1, '至少需要一个SKU')
        .max(100, '批量检查最多支持100个SKU'),
    });

    const validationResult = BatchCheckSkuSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { skus } = validationResult.data;

    // 提取所有SKU进行批量查询
    const allSkus = skus.map(item => item.sku);
    const existingVariants = await prisma.productVariant.findMany({
      where: {
        sku: { in: allSkus },
      },
      select: {
        id: true,
        sku: true,
        colorCode: true,
        status: true,
        product: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    // 创建SKU到变体的映射
    const skuToVariantMap = new Map(
      existingVariants.map(variant => [variant.sku, variant])
    );

    // 检查每个SKU的可用性
    const results = await Promise.all(
      skus.map(async item => {
        const { sku, excludeId } = item;
        const existingVariant = skuToVariantMap.get(sku);

        // 如果存在变体且不是被排除的变体，则不可用
        const available =
          !existingVariant || (excludeId && existingVariant.id === excludeId);

        let conflictInfo = null;
        if (!available && existingVariant) {
          conflictInfo = {
            variantId: existingVariant.id,
            sku: existingVariant.sku,
            colorCode: existingVariant.colorCode,
            status: existingVariant.status,
            product: existingVariant.product,
          };
        }

        // 为不可用的SKU生成建议
        let suggestions: string[] = [];
        if (!available) {
          suggestions = await generateSkuSuggestions(sku);
        }

        return {
          sku,
          available,
          conflict: conflictInfo,
          suggestions: suggestions.slice(0, 3), // 批量检查时每个SKU最多返回3个建议
        };
      })
    );

    // 统计信息
    const summary = {
      total: results.length,
      available: results.filter(r => r.available).length,
      conflicts: results.filter(r => !r.available).length,
    };

    return NextResponse.json({
      success: true,
      data: results,
      summary,
    });
  } catch (error) {
    console.error('批量检查SKU可用性错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '批量检查SKU可用性失败',
      },
      { status: 500 }
    );
  }
}

// 生成SKU建议的辅助函数
async function generateSkuSuggestions(baseSku: string): Promise<string[]> {
  const suggestions: string[] = [];

  try {
    // 查找相似的SKU模式
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

    // 生成带序号的建议
    for (let i = 1; i <= 20; i++) {
      const numberedSku = `${baseSku}-${i.toString().padStart(2, '0')}`;
      if (!existingSkuSet.has(numberedSku)) {
        suggestions.push(numberedSku);
        if (suggestions.length >= 10) break;
      }
    }

    // 如果还没有足够的建议，尝试其他模式
    if (suggestions.length < 5) {
      // 添加字母后缀
      const letters = ['A', 'B', 'C', 'D', 'E'];
      for (const letter of letters) {
        const letterSku = `${baseSku}-${letter}`;
        if (!existingSkuSet.has(letterSku)) {
          suggestions.push(letterSku);
          if (suggestions.length >= 10) break;
        }
      }
    }

    // 如果还是不够，添加时间戳建议
    if (suggestions.length < 3) {
      const timestamp = Date.now().toString().slice(-6);
      const timestampSku = `${baseSku}-${timestamp}`;
      if (!existingSkuSet.has(timestampSku)) {
        suggestions.push(timestampSku);
      }
    }

    return suggestions;
  } catch (error) {
    console.error('生成SKU建议错误:', error);
    return [];
  }
}
