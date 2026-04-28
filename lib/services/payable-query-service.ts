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
import { parseLocalDateString } from '@/lib/utils/datetime';
import { toNumber } from '@/lib/utils/number';

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

type PayableWhereQuery = {
  search?: string;
  supplierId?: string;
  status?: PayableRecordQuery['status'];
  sourceType?: PayableRecordQuery['sourceType'];
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: PayableRecordQuery['sortBy'];
  sortOrder?: PayableRecordQuery['sortOrder'];
};

export function sanitizePayableSearchParams(
  searchParams: RawPayableSearchParams
) {
  return {
    ...searchParams,
    search: searchParams.search?.trim() || undefined,
  };
}

function buildPayableDateFilter(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) {
    return undefined;
  }

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (startDate) {
    dateFilter.gte = parseLocalDateString(startDate) ?? new Date(startDate);
  }
  if (endDate) {
    const endDateValue =
      parseLocalDateString(endDate) ?? new Date(endDate);
    endDateValue.setHours(23, 59, 59, 999);
    dateFilter.lte = endDateValue;
  }

  return dateFilter;
}

export function buildPayableWhereConditions(
  query: PayableWhereQuery
): Prisma.PayableRecordWhereInput {
  const where: Prisma.PayableRecordWhereInput = {};
  const normalizedSearch = query.search?.trim();

  if (normalizedSearch) {
    where.OR = [
      { payableNumber: { contains: normalizedSearch } },
      { sourceNumber: { contains: normalizedSearch } },
      { description: { contains: normalizedSearch } },
      { remarks: { contains: normalizedSearch } },
      { supplier: { name: { contains: normalizedSearch } } },
      { supplier: { phone: { contains: normalizedSearch } } },
      { supplier: { address: { contains: normalizedSearch } } },
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

  const dateFilter = buildPayableDateFilter(query.startDate, query.endDate);
  if (dateFilter) {
    where.createdAt = dateFilter;
  }

  return where;
}

function serializePayables(
  payables: Awaited<ReturnType<typeof fetchPayables>>
): PayableRecordDetail[] {
  return payables.map(payable => ({
    id: payable.id,
    payableNumber: payable.payableNumber,
    supplierId: payable.supplierId,
    userId: payable.userId,
    sourceType: payable.sourceType as PayableSourceType,
    ...(payable.sourceId !== null && payable.sourceId !== undefined
      ? { sourceId: payable.sourceId }
      : {}),
    ...(payable.sourceNumber !== null && payable.sourceNumber !== undefined
      ? { sourceNumber: payable.sourceNumber }
      : {}),
    payableAmount: toNumber(payable.payableAmount),
    paidAmount: toNumber(payable.paidAmount),
    remainingAmount: toNumber(payable.remainingAmount),
    ...(payable.dueDate !== null && payable.dueDate !== undefined
      ? { dueDate: payable.dueDate }
      : {}),
    status: payable.status as PayableStatus,
    paymentTerms: payable.paymentTerms,
    ...(payable.description !== null && payable.description !== undefined
      ? { description: payable.description }
      : {}),
    ...(payable.remarks !== null && payable.remarks !== undefined
      ? { remarks: payable.remarks }
      : {}),
    createdAt: payable.createdAt,
    updatedAt: payable.updatedAt,
    supplier: {
      id: payable.supplier.id,
      name: payable.supplier.name,
      ...(payable.supplier.phone !== null &&
      payable.supplier.phone !== undefined
        ? { phone: payable.supplier.phone }
        : {}),
      ...(payable.supplier.address !== null &&
      payable.supplier.address !== undefined
        ? { address: payable.supplier.address }
        : {}),
    },
    user: {
      id: payable.user.id,
      name: payable.user.name,
      email: payable.user.email ?? '',
    },
    paymentOutRecords: payable.paymentOutRecords.map(record => ({
      id: record.id,
      paymentNumber: record.paymentNumber,
      ...(record.payableRecordId !== null &&
      record.payableRecordId !== undefined
        ? { payableRecordId: record.payableRecordId }
        : {}),
      supplierId: record.supplierId,
      userId: record.userId,
      paymentMethod: record.paymentMethod as PaymentOutMethod,
      paymentAmount: toNumber(record.paymentAmount),
      actualPaymentAmount: toNumber(record.actualPaymentAmount),
      roundingAmount: toNumber(record.roundingAmount),
      paymentDate: record.paymentDate,
      status: record.status as PaymentOutStatus,
      ...(record.remarks !== null && record.remarks !== undefined
        ? { remarks: record.remarks }
        : {}),
      ...(record.voucherNumber !== null && record.voucherNumber !== undefined
        ? { voucherNumber: record.voucherNumber }
        : {}),
      ...(record.bankInfo !== null && record.bankInfo !== undefined
        ? { bankInfo: record.bankInfo }
        : {}),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })),
  }));
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
          actualPaymentAmount: true,
          roundingAmount: true,
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
  const where = buildPayableWhereConditions(query);

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
