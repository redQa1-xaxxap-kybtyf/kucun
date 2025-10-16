/**
 * 出库记录服务端数据获取函数
 * 用于 Next.js 15.4 Server Components
 */

import { prisma } from '@/lib/db';
import type { OutboundRecord } from '@/lib/types/inventory';

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

type OutboundRecordWithRelations = {
  id: string;
  recordNumber: string;
  productId: string;
  variantId: string | null;
  inventoryId: string;
  quantity: number;
  reason: string;
  notes: string | null;
  customerId: string | null;
  salesOrderId: string | null;
  operatorId: string;
  batchNumber: string | null;
  unitCost: number | null;
  totalCost: number | null;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    code: string;
    name: string;
    specification: string | null;
    unit: string;
  };
  variant: {
    id: string;
    colorCode: string;
    colorName: string | null;
  } | null;
  operator: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    name: string;
  } | null;
  salesOrder: {
    id: string;
    orderNumber: string;
  } | null;
};

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
    quantity: Number(record.quantity),
    type: mapOutboundReasonToType(record.reason),
    reason: record.reason,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
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
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            specification: true,
            unit: true,
            piecesPerUnit: true,
            weight: true,
          },
        },
        variant: {
          select: {
            id: true,
            colorCode: true,
            colorName: true,
            sku: true,
          },
        },
        operator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
    }),
    prisma.outboundRecord.count({ where }),
  ]);

  // 格式化数据
  const formattedRecords = records.map(record =>
    formatOutboundRecord(record as OutboundRecordWithRelations)
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
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          specification: true,
          unit: true,
          piecesPerUnit: true,
          weight: true,
        },
      },
      variant: {
        select: {
          id: true,
          colorCode: true,
          colorName: true,
          sku: true,
        },
      },
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
        },
      },
      salesOrder: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  const inventoryRecord = await prisma.inventory.findUnique({
    where: { id: record.inventoryId },
    select: { quantity: true },
  });

  const detail: OutboundRecord & {
    inventoryBalance?: number;
    customer?: { id: string; name: string };
    salesOrder?: { id: string; orderNumber: string };
  } = {
    id: record.id,
    recordNumber: record.recordNumber,
    type: mapOutboundReasonToType(record.reason),
    productId: record.productId,
    batchNumber: record.batchNumber ?? undefined,
    quantity: Number(record.quantity),
    unitCost: record.unitCost ?? undefined,
    totalCost: record.totalCost ?? undefined,
    customerId: record.customerId ?? undefined,
    salesOrderId: record.salesOrderId ?? undefined,
    userId: record.operatorId,
    remarks: record.notes ?? undefined,
    createdAt: record.createdAt.toISOString(),
    product: record.product
      ? ({
          id: record.product.id,
          code: record.product.code,
          name: record.product.name,
          specification: record.product.specification ?? undefined,
          unit: record.product.unit as NonNullable<
            OutboundRecord['product']
          >['unit'],
          piecesPerUnit: record.product.piecesPerUnit ?? 0,
          weight: record.product.weight ?? undefined,
        } satisfies NonNullable<OutboundRecord['product']>)
      : undefined,
    user: record.operator
      ? ({
          id: record.operator.id,
          name: record.operator.name ?? '—',
          email: record.operator.email ?? undefined,
        } satisfies NonNullable<OutboundRecord['user']>)
      : undefined,
    variant: record.variant
      ? ({
          id: record.variant.id,
          colorCode: record.variant.colorCode ?? undefined,
          colorName: record.variant.colorName ?? undefined,
          sku: record.variant.sku ?? undefined,
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
    reason: record.reason,
    updatedAt: record.updatedAt.toISOString(),
    inventoryBalance: inventoryRecord?.quantity ?? undefined,
  };

  return detail;
}
