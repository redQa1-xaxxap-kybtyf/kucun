/**
 * 出库记录服务端数据获取函数
 * 用于 Next.js 15.4 Server Components
 */

import { prisma } from '@/lib/db';

interface OutboundQueryParams {
  page: number;
  limit: number;
  search?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

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

type OutboundRecordWithProduct = {
  id: string;
  recordNumber: string;
  productId: string;
  quantity: number;
  reason: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  product: {
    code: string;
    name: string;
    specification: string | null;
  };
};

/**
 * 格式化出库记录数据
 */
function formatOutboundRecord(record: OutboundRecordWithProduct) {
  return {
    id: record.id,
    recordNumber: record.recordNumber,
    productId: record.productId,
    productCode: record.product.code,
    productName: record.product.name,
    productSpecification: record.product.specification,
    quantity: record.quantity,
    type: record.reason,
    reason: record.notes || undefined,
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
          },
        },
      },
    }),
    prisma.outboundRecord.count({ where }),
  ]);

  // 格式化数据
  const formattedRecords = records.map(formatOutboundRecord);

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
