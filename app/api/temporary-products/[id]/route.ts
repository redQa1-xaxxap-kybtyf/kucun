import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { invalidateMiniProgramCatalogCache } from '@/lib/services/miniprogram-catalog-service';

const temporaryProductWriteSchema = z.object({
  supplierId: z.string().min(1, '请选择供应商'),
  code: z.string().trim().min(1, '请填写产品编码').max(120),
  name: z.string().trim().min(1, '请填写产品名称').max(150),
  specification: z.string().trim().optional().nullable(),
  weight: z.coerce.number().positive().optional().nullable(),
  unit: z.string().trim().optional().default('片'),
  piecesPerUnit: z.coerce.number().int().positive().optional().default(1),
  description: z.string().trim().optional().nullable(),
  thumbnailUrl: z.string().trim().optional().nullable(),
  showInMiniProgram: z.coerce.boolean().optional().default(true),
  latestCostPrice: z.coerce.number().nonnegative().optional().nullable(),
  latestSalePrice: z.coerce.number().nonnegative().optional().nullable(),
  priceRemarks: z.string().trim().optional().nullable(),
});

function normalizeNullableText(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function toNumberOrNull(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isPriceChanged(
  current: {
    latestCostPrice: Prisma.Decimal | null;
    latestSalePrice: Prisma.Decimal | null;
    priceRemarks: string | null;
  },
  next: z.infer<typeof temporaryProductWriteSchema>
) {
  return (
    toNumberOrNull(current.latestCostPrice) !==
      (next.latestCostPrice ?? null) ||
    toNumberOrNull(current.latestSalePrice) !==
      (next.latestSalePrice ?? null) ||
    (current.priceRemarks ?? null) !== normalizeNullableText(next.priceRemarks)
  );
}

function buildUpdateData(
  input: z.infer<typeof temporaryProductWriteSchema>,
  priceUpdatedAt: Date | null
) {
  return {
    supplierId: input.supplierId,
    code: input.code.trim(),
    name: input.name.trim(),
    specification: normalizeNullableText(input.specification),
    weight: input.weight ?? null,
    unit: input.unit?.trim() || '片',
    piecesPerUnit: input.piecesPerUnit ?? 1,
    description: normalizeNullableText(input.description),
    thumbnailUrl: normalizeNullableText(input.thumbnailUrl),
    showInMiniProgram: input.showInMiniProgram,
    latestCostPrice: input.latestCostPrice ?? null,
    latestSalePrice: input.latestSalePrice ?? null,
    priceUpdatedAt,
    priceRemarks: normalizeNullableText(input.priceRemarks),
  };
}

export const PUT = withAuth(
  async (request: NextRequest, { user, params }) => {
    const resolvedParams = await Promise.resolve(params);
    const id = resolvedParams?.id;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少外采产品ID' },
        { status: 400 }
      );
    }

    try {
      const body = await request.json();
      const parsed = temporaryProductWriteSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: parsed.error.issues[0]?.message || '参数不正确',
          },
          { status: 400 }
        );
      }

      const current = await prisma.temporaryProduct.findUnique({
        where: { id },
        select: {
          id: true,
          latestCostPrice: true,
          latestSalePrice: true,
          priceRemarks: true,
          priceUpdatedAt: true,
        },
      });

      if (!current) {
        return NextResponse.json(
          { success: false, error: '外采产品不存在' },
          { status: 404 }
        );
      }

      const priceChanged = isPriceChanged(current, parsed.data);
      const priceUpdatedAt = priceChanged ? new Date() : current.priceUpdatedAt;
      const data = buildUpdateData(parsed.data, priceUpdatedAt);

      const product = await prisma.temporaryProduct.update({
        where: { id },
        data,
      });
      invalidateMiniProgramCatalogCache();

      if (priceChanged) {
        await prisma.temporaryProductPriceHistory.create({
          data: {
            temporaryProductId: product.id,
            supplierId: product.supplierId,
            costPrice: parsed.data.latestCostPrice ?? null,
            salePrice: parsed.data.latestSalePrice ?? null,
            sourceType: 'manual',
            remarks: normalizeNullableText(parsed.data.priceRemarks),
            createdBy: user.id,
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: product,
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return NextResponse.json(
          {
            success: false,
            error: '该供应商下已存在相同编码的外采产品',
          },
          { status: 409 }
        );
      }

      logger.error('temporary-products-api', 'PUT失败', error, { id });
      return NextResponse.json(
        {
          success: false,
          error: '更新外采产品失败',
          message: error instanceof Error ? error.message : '未知错误',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['products:edit'] }
);
