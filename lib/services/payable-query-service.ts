import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import type {
  PayableRecordDetail,
  PayableRecordListResponse,
  PayableRecordQuery,
  PayableSourceType,
  PayableStatus,
  PaymentOutMethod,
  PaymentOutStatus,
} from '@/lib/types/payable';

type RawPayableSearchParams = {
  page?: string;
  limit?: string;
  search?: string;
  supplierId?: string;
  status?: string;
  sourceType?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
};

type PayableQuery = PayableRecordQuery & {
  sortBy: NonNullable<PayableRecordQuery['sortBy']>;
  sortOrder: NonNullable<PayableRecordQuery['sortOrder']>;
};

export function sanitizePayableSearchParams(
  searchParams: RawPayableSearchParams
) {
  return {
    ...searchParams,
    search: searchParams.search?.trim() || undefined,
  };
}

function buildWhereConditions(
  query: PayableRecordQuery
): Prisma.PayableRecordWhereInput {
  const where: Prisma.PayableRecordWhereInput = {};

  if (query.search) {
    where.OR = [
      { payableNumber: { contains: query.search } },
      { supplier: { name: { contains: query.search } } },
      { sourceNumber: { contains: query.search } },
    ];
  }

  if (query.supplierId) {
    where.supplierId = query.supplierId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.sourceType) {
    where.sourceType = query.sourceType;
  }

  if (query.startDate || query.endDate) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query.startDate) {
      dateFilter.gte = new Date(query.startDate);
    }
    if (query.endDate) {
      dateFilter.lte = new Date(query.endDate);
    }
    where.createdAt = dateFilter;
  }

  return where;
}

function toUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

function serializePayables(
  payables: Awaited<ReturnType<typeof fetchPayables>>
) {
  return payables.map(payable => ({
    ...payable,
    sourceType: payable.sourceType as PayableSourceType,
    status: payable.status as PayableStatus,
    sourceId: toUndefined(payable.sourceId),
    sourceNumber: toUndefined(payable.sourceNumber),
    description: toUndefined(payable.description),
    remarks: toUndefined(payable.remarks),
    dueDate: toUndefined(payable.dueDate),
    supplier: {
      ...payable.supplier,
      phone: toUndefined(payable.supplier.phone),
      address: toUndefined(payable.supplier.address),
    },
    user: {
      ...payable.user,
      email: payable.user.email ?? '',
    },
    paymentOutRecords: payable.paymentOutRecords.map(record => ({
      ...record,
      paymentMethod: record.paymentMethod as PaymentOutMethod,
      status: record.status as PaymentOutStatus,
      payableRecordId: toUndefined(record.payableRecordId),
      remarks: toUndefined(record.remarks),
      voucherNumber: toUndefined(record.voucherNumber),
      bankInfo: toUndefined(record.bankInfo),
    })),
  })) as PayableRecordDetail[];
}

async function fetchPayables(
  where: Prisma.PayableRecordWhereInput,
  query: PayableQuery
) {
  return prisma.payableRecord.findMany({
    where,
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      paymentOutRecords: {
        where: { status: 'confirmed' },
        select: {
          id: true,
          paymentNumber: true,
          payableRecordId: true,
          supplierId: true,
          userId: true,
          paymentAmount: true,
          paymentDate: true,
          paymentMethod: true,
          status: true,
          remarks: true,
          voucherNumber: true,
          bankInfo: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: {
      [query.sortBy]: query.sortOrder,
    },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });
}

export async function fetchPayableRecordList(
  query: PayableQuery
): Promise<PayableRecordListResponse> {
  const where = buildWhereConditions(query);

  const [payables, total] = await Promise.all([
    fetchPayables(where, query),
    prisma.payableRecord.count({ where }),
  ]);

  const formattedPayables = serializePayables(payables);

  return {
    data: formattedPayables,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export function normalizePayableQuery(query: PayableRecordQuery): PayableQuery {
  return {
    ...query,
    page: query.page,
    limit: query.limit,
    search: query.search ?? '',
    sortBy: query.sortBy ?? 'createdAt',
    sortOrder: query.sortOrder ?? 'desc',
  };
}
