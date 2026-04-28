import type { Prisma } from '@prisma/client';

import type { PaymentOutRecordQuery } from '@/lib/types/payable';
import { parseLocalDateString } from '@/lib/utils/datetime';

function buildPaymentOutDateFilter(startDate?: string, endDate?: string) {
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

export function buildPaymentOutWhereConditions(
  query: PaymentOutRecordQuery
): Prisma.PaymentOutRecordWhereInput {
  const where: Prisma.PaymentOutRecordWhereInput = {};
  const normalizedSearch = query.search?.trim();

  if (normalizedSearch) {
    where.OR = [
      { paymentNumber: { contains: normalizedSearch } },
      { voucherNumber: { contains: normalizedSearch } },
      { remarks: { contains: normalizedSearch } },
      { bankInfo: { contains: normalizedSearch } },
      { supplier: { name: { contains: normalizedSearch } } },
      { supplier: { phone: { contains: normalizedSearch } } },
      {
        payableRecord: {
          is: {
            OR: [
              { payableNumber: { contains: normalizedSearch } },
              { sourceNumber: { contains: normalizedSearch } },
            ],
          },
        },
      },
    ];
  }

  if (query.payableRecordId) {
    where.payableRecordId = query.payableRecordId;
  }

  if (query.supplierId) {
    where.supplierId = query.supplierId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.paymentMethod) {
    where.paymentMethod = query.paymentMethod;
  }

  const dateFilter = buildPaymentOutDateFilter(query.startDate, query.endDate);
  if (dateFilter) {
    where.paymentDate = dateFilter;
  }

  return where;
}
