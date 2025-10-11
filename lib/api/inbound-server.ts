/**
 * 入库记录服务端数据获取函数
 * 用于 Next.js 15.4 Server Components
 */

import { prisma } from '@/lib/db';
import type { InboundRecord } from '@/lib/types/inbound';

import { getInboundRecords, parseInboundQueryParams } from './inbound-handlers';

export async function getInboundRecordsServer(searchParams: URLSearchParams) {
  // 解析查询参数
  const queryData = parseInboundQueryParams(searchParams);

  // 获取入库记录列表
  return await getInboundRecords(queryData);
}

/**
 * 根据入库单号获取详情
 * @param recordNumber 入库记录编号
 */
export async function getInboundRecordByNumber(
  recordNumber: string
): Promise<
  (InboundRecord & {
    inventoryBalance?: number;
  }) | null
> {
  if (!recordNumber) {
    return null;
  }

  const record = await prisma.inboundRecord.findUnique({
    where: { recordNumber },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          specification: true,
          piecesPerUnit: true,
        },
      },
      variant: {
        select: {
          id: true,
          colorCode: true,
          colorName: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      batchSpecification: {
        select: {
          id: true,
          batchNumber: true,
          piecesPerUnit: true,
          weight: true,
          thickness: true,
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  const inventoryRecord = await prisma.inventory.findFirst({
    where: {
      productId: record.productId,
      variantId: record.variantId ?? null,
      batchNumber: record.batchNumber ?? null,
    },
    select: {
      quantity: true,
    },
  });

  const mapped: InboundRecord & { inventoryBalance?: number } = {
    id: record.id,
    recordNumber: record.recordNumber,
    productId: record.productId,
    variantId: record.variantId ?? undefined,
    batchNumber: record.batchNumber ?? undefined,
    batchSpecificationId: record.batchSpecificationId ?? undefined,
    quantity: Number(record.quantity),
    unitCost: record.unitCost ?? undefined,
    totalCost: record.totalCost ?? undefined,
    location: record.location ?? undefined,
    reason: record.reason as InboundRecord['reason'],
    remarks: record.remarks ?? undefined,
    userId: record.userId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    product: record.product
      ? {
          id: record.product.id,
          code: record.product.code,
          name: record.product.name,
          unit: record.product.unit,
          specification: record.product.specification ?? undefined,
          piecesPerUnit: record.product.piecesPerUnit,
        }
      : undefined,
    variant: record.variant
      ? {
          id: record.variant.id,
          colorCode: record.variant.colorCode,
          colorName: record.variant.colorName,
        }
      : undefined,
    user: record.user
      ? {
          id: record.user.id,
          name: record.user.name ?? '—',
        }
      : undefined,
    batchSpecification: record.batchSpecification
      ? {
          id: record.batchSpecification.id,
          batchNumber: record.batchSpecification.batchNumber,
          piecesPerUnit: record.batchSpecification.piecesPerUnit,
          weight: record.batchSpecification.weight ?? undefined,
          thickness: record.batchSpecification.thickness ?? undefined,
        }
      : undefined,
    inventoryBalance: inventoryRecord?.quantity ?? undefined,
  };

  return mapped;
}
