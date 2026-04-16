/**
 * 出库记录服务端数据获取函数
 * 用于 Next.js 15.4 Server Components
 */

import {
  OUTBOUND_RECORD_SELECT,
  type OutboundRecordWithRelations,
} from '@/lib/api/selectors/inventory-selectors';
import { prisma } from '@/lib/db';
import type { OutboundRecord } from '@/lib/types/inventory';
import { toNumber } from '@/lib/utils/number';

type OutboundWhereClause = {
  OR?: Array<{
    recordNumber?: { contains: string };
    product?: { name?: { contains: string }; code?: { contains: string } };
    batchNumber?: { contains: string };
  }>;
  reason?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
};

const OUTBOUND_REASON_TYPE_MAP: Record<string, OutboundRecord['type']> = {
  sales_outbound: 'sales_outbound',
  sample_outbound: 'sample_outbound',
  internal_use_outbound: 'internal_use_outbound',
  adjust_outbound: 'adjust_outbound',
  transfer: 'adjust_outbound',
  damage: 'adjust_outbound',
  manual_outbound: 'normal_outbound',
  normal_outbound: 'normal_outbound',
};

function mapOutboundReasonToType(reason?: string): OutboundRecord['type'] {
  if (!reason) {
    return 'normal_outbound';
  }

  return OUTBOUND_REASON_TYPE_MAP[reason] ?? 'normal_outbound';
}

/**
 * 构建出库记录查询条件
 */
function buildOutboundWhereClause(params: {
  search?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}): OutboundWhereClause {
  const where: OutboundWhereClause = {};

  if (params.search) {
    where.OR = [
      { recordNumber: { contains: params.search } },
      { product: { name: { contains: params.search } } },
      { product: { code: { contains: params.search } } },
      { batchNumber: { contains: params.search } },
    ];
  }

  if (params.type) {
    where.reason = params.type;
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      where.createdAt.lte = new Date(params.endDate);
    }
  }

  return where;
}

/**
 * 格式化出库记录数据
 */
function formatOutboundRecord(record: OutboundRecordWithRelations) {
  return {
    id: record.id,
    recordNumber: record.recordNumber,
    productId: record.productId,
    productCode: record.product.code,
    productName: record.product.name,
    productSpecification: record.product.specification,
    batchNumber: record.batchNumber ?? undefined,
    piecesPerUnit: record.product.piecesPerUnit ?? undefined,
    weightPerUnit: record.product.weight ?? undefined,
    quantity: Number(record.quantity),
    type: mapOutboundReasonToType(record.reason),
    reason: record.reason,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * 获取批次规格映射
 */
async function fetchBatchSpecifications(
  records: OutboundRecordWithRelations[]
): Promise<Map<string, { piecesPerUnit?: number; weight?: number }>> {
  const buildBatchKey = (
    productId: string,
    batchNumber: string,
    variantId?: string | null
  ) => `${productId}-${variantId ?? ''}-${batchNumber}`;
  const batchSpecMap = new Map<
    string,
    { piecesPerUnit?: number; weight?: number }
  >();

  const batchQueries = records.reduce<
    Array<{ productId: string; variantId: string | null; batchNumber: string }>
  >((acc, record) => {
    if (record.batchNumber) {
      acc.push({
        productId: record.productId,
        variantId: record.variantId ?? null,
        batchNumber: record.batchNumber,
      });
    }
    return acc;
  }, []);

  if (batchQueries.length > 0) {
    const seenConditions = new Set<string>();
    const conditions = batchQueries.flatMap(query => {
      const entries = [
        {
          productId: query.productId,
          variantId: query.variantId,
          batchNumber: query.batchNumber,
        },
      ];

      if (query.variantId) {
        entries.push({
          productId: query.productId,
          variantId: null,
          batchNumber: query.batchNumber,
        });
      }

      return entries.filter(condition => {
        const key = buildBatchKey(
          condition.productId,
          condition.batchNumber,
          condition.variantId
        );
        if (seenConditions.has(key)) {
          return false;
        }
        seenConditions.add(key);
        return true;
      });
    });

    const batchSpecs = await prisma.batchSpecification.findMany({
      where: {
        OR: conditions,
      },
      select: {
        productId: true,
        variantId: true,
        batchNumber: true,
        piecesPerUnit: true,
        weight: true,
      },
    });

    batchSpecs.forEach(spec => {
      const key = buildBatchKey(
        spec.productId,
        spec.batchNumber,
        spec.variantId ?? null
      );
      batchSpecMap.set(key, {
        piecesPerUnit: spec.piecesPerUnit ?? undefined,
        weight:
          spec.weight === null || spec.weight === undefined
            ? undefined
            : toNumber(spec.weight),
      });
    });
  }

  return batchSpecMap;
}

/**
 * 计算总重量
 */
function calculateTotalWeight(
  quantity: number,
  weightPerUnit: number,
  piecesPerUnit?: number
): number {
  const effectivePiecesPerUnit =
    piecesPerUnit && piecesPerUnit > 0 ? piecesPerUnit : undefined;
  const units = effectivePiecesPerUnit
    ? quantity / effectivePiecesPerUnit
    : quantity;
  const rawTotal = units * weightPerUnit;
  return Math.round(rawTotal * 1000) / 1000;
}

/**
 * 格式化出库记录并添加批次信息
 */
function formatRecordWithBatchInfo(
  record: OutboundRecordWithRelations,
  batchSpecMap: Map<string, { piecesPerUnit?: number; weight?: number }>
) {
  const formatted = formatOutboundRecord(record);

  const batchKey = record.batchNumber
    ? `${record.productId}-${record.variantId ?? ''}-${record.batchNumber}`
    : null;
  const fallbackBatchKey = record.batchNumber
    ? `${record.productId}--${record.batchNumber}`
    : null;
  const batchOverride = batchKey
    ? (batchSpecMap.get(batchKey) ??
      (fallbackBatchKey ? batchSpecMap.get(fallbackBatchKey) : undefined))
    : undefined;
  const piecesPerUnit =
    batchOverride?.piecesPerUnit ?? record.product.piecesPerUnit ?? undefined;
  const weightPerUnitRaw = batchOverride?.weight ?? record.product.weight;
  const weightPerUnit =
    weightPerUnitRaw === null || weightPerUnitRaw === undefined
      ? undefined
      : toNumber(weightPerUnitRaw);

  let totalWeight: number | undefined;
  if (weightPerUnit !== undefined) {
    totalWeight = calculateTotalWeight(
      Number(record.quantity),
      weightPerUnit,
      piecesPerUnit
    );
  }

  return {
    ...formatted,
    piecesPerUnit,
    weightPerUnit,
    totalWeight,
  };
}

/**
 * 获取出库记录列表
 */
export async function getOutboundRecordsServer(searchParams: URLSearchParams) {
  // 解析查询参数
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const search = searchParams.get('search') || undefined;
  const type = searchParams.get('type') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  // 构建查询条件
  const where = buildOutboundWhereClause({
    search,
    type,
    startDate,
    endDate,
  });

  // 计算分页
  const skip = (page - 1) * limit;

  // 并行查询记录和总数
  const [records, total] = await Promise.all([
    prisma.outboundRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: OUTBOUND_RECORD_SELECT,
    }),
    prisma.outboundRecord.count({ where }),
  ]);

  // 获取批次规格信息
  const batchSpecMap = await fetchBatchSpecifications(
    records as OutboundRecordWithRelations[]
  );

  // 格式化记录并添加批次信息
  const formattedRecords = records.map(record =>
    formatRecordWithBatchInfo(
      record as OutboundRecordWithRelations,
      batchSpecMap
    )
  );

  return {
    data: formattedRecords,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 根据出库单号获取详情
 */
export async function getOutboundRecordByNumber(recordNumber: string): Promise<
  | (OutboundRecord & {
      inventoryBalance?: number;
      customer?: { id: string; name: string };
      salesOrder?: { id: string; orderNumber: string };
    })
  | null
> {
  if (!recordNumber) {
    return null;
  }

  const record = await prisma.outboundRecord.findUnique({
    where: { recordNumber },
    select: OUTBOUND_RECORD_SELECT,
  });

  if (!record) {
    return null;
  }

  const inventoryRecord = await prisma.inventory.findUnique({
    where: { id: record.inventoryId },
    select: { quantity: true },
  });
  const batchSpecMap = await fetchBatchSpecifications([
    record as OutboundRecordWithRelations,
  ]);
  const formattedRecord = formatRecordWithBatchInfo(
    record as OutboundRecordWithRelations,
    batchSpecMap
  );

  const detail: OutboundRecord & {
    inventoryBalance?: number;
    customer?: { id: string; name: string };
    salesOrder?: { id: string; orderNumber: string };
  } = {
    id: record.id,
    recordNumber: record.recordNumber,
    type: formattedRecord.type,
    productId: record.productId,
    productCode: formattedRecord.productCode,
    productName: formattedRecord.productName,
    productSpecification: formattedRecord.productSpecification ?? undefined,
    batchNumber: record.batchNumber ?? undefined,
    piecesPerUnit: formattedRecord.piecesPerUnit,
    variantId: record.variantId ?? undefined,
    quantity: Number(record.quantity),
    unitCost:
      record.unitCost === null || record.unitCost === undefined
        ? undefined
        : toNumber(record.unitCost),
    totalCost:
      record.totalCost === null || record.totalCost === undefined
        ? undefined
        : toNumber(record.totalCost),
    customerId: record.customerId ?? undefined,
    salesOrderId: record.salesOrderId ?? undefined,
    userId: record.operatorId,
    remarks: record.notes ?? undefined,
    createdAt: record.createdAt.toISOString(),
    weightPerUnit: formattedRecord.weightPerUnit,
    totalWeight: formattedRecord.totalWeight,
    product: record.product
      ? ({
          id: record.product.id,
          code: record.product.code,
          name: record.product.name,
          specification: record.product.specification ?? undefined,
          unit: record.product.unit as NonNullable<
            OutboundRecord['product']
          >['unit'],
          piecesPerUnit:
            formattedRecord.piecesPerUnit ?? record.product.piecesPerUnit ?? 0,
          weight:
            formattedRecord.weightPerUnit !== undefined
              ? formattedRecord.weightPerUnit
              : record.product.weight === null ||
                  record.product.weight === undefined
              ? undefined
              : toNumber(record.product.weight),
        } satisfies NonNullable<OutboundRecord['product']>)
      : undefined,
    user: record.operator
      ? ({
          id: record.operator.id,
          name: record.operator.name ?? '—',
          email: record.operator.email ?? '',
        } satisfies NonNullable<OutboundRecord['user']>)
      : undefined,
    variant: record.variant
      ? ({
          id: record.variant.id,
          colorCode: record.variant.colorCode ?? undefined,
          colorName: record.variant.colorName ?? undefined,
          sku: record.variant.sku,
        } satisfies NonNullable<OutboundRecord['variant']>)
      : undefined,
    customer: record.customer
      ? {
          id: record.customer.id,
          name: record.customer.name,
        }
      : undefined,
    salesOrder: record.salesOrder
      ? {
          id: record.salesOrder.id,
          orderNumber: record.salesOrder.orderNumber,
        }
      : undefined,
    reason: formattedRecord.reason,
    updatedAt: record.updatedAt.toISOString(),
    inventoryBalance: inventoryRecord?.quantity ?? undefined,
  };

  return detail;
}
