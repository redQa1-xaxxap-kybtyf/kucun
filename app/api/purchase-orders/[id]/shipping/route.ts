import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { resolveParams } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type PurchaseOrderParams = { id: string };

async function resolveOrderParams(
  params?: Promise<Record<string, string>> | Record<string, string>
): Promise<PurchaseOrderParams> {
  const resolved = await resolveParams<Record<string, string>>(params);
  if (!resolved.id) {
    throw new Error('缺少订单编号');
  }
  return { id: resolved.id };
}

const shippingUpdateSchema = z.object({
  containerNumber: z
    .string()
    .max(50, '集装箱号码不能超过50个字符')
    .optional()
    .or(z.literal('')),
  shippingCompany: z
    .string()
    .max(100, '船运公司名称不能超过100个字符')
    .optional()
    .or(z.literal('')),
});

export const PATCH = withAuth(async (request: NextRequest, context) => {
  const { user } = context;
  const { id: orderId } = await resolveOrderParams(context.params);

  try {
    const body = (await request.json()) as unknown;
    const parsed = shippingUpdateSchema.parse(body);

    const data: Prisma.PurchaseOrderUpdateInput = {};

    if (parsed.containerNumber !== undefined) {
      const trimmed = parsed.containerNumber?.trim() ?? '';
      data.containerNumber = trimmed.length > 0 ? trimmed : null;
    }

    if (parsed.shippingCompany !== undefined) {
      const trimmed = parsed.shippingCompany?.trim() ?? '';
      data.shippingCompany = trimmed.length > 0 ? trimmed : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: '没有需要更新的字段' },
        { status: 400 }
      );
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: orderId },
      data,
      select: {
        id: true,
        orderNumber: true,
        containerNumber: true,
        shippingCompany: true,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    logger.error('purchase-orders', '更新采购订单运输信息失败', error, {
      userId: user.id,
      orderId,
    });

    const message =
      error instanceof Error ? error.message : '更新运输信息失败，请重试';

    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
});

