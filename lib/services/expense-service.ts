// 费用记录服务层
/*
 * 注意：阶段2新增 - 费用幂等创建与公司承担费用批量创建工具
 */

// 提供费用记录的创建、查询、更新和删除功能

import type { Prisma } from '@prisma/client';

import { ApiError, handlePrismaError, isPrismaError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { createOrMergePayableFromExpense } from '@/lib/services/expense-payable-integration';
import { getSystemMode } from '@/lib/services/system-mode-service';
import {
  EXPENSE_TYPE_LABELS,
  type CreateExpenseRequest,
  type ExpenseQueryParams,
  type ExpenseRecord,
  type ExpenseStatistics,
  type ExpenseStatisticsByDate,
  type ExpenseStatisticsByMonth,
  type ExpenseStatisticsByType,
  type ExpenseStatisticsParams,
  type UpdateExpenseRequest,
} from '@/lib/types/expense';
import { toNumber } from '@/lib/utils/number';
import { validateExpenseType } from '@/lib/validations/expense';

function parseLocalDateString(dateString: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

async function getPurchaseOrderContainerMap(
  orderIds: string[]
): Promise<Map<string, string | null>> {
  if (orderIds.length === 0) {
    return new Map();
  }

  const orders = await prisma.purchaseOrder.findMany({
    where: { id: { in: orderIds } },
    take: orderIds.length,
    select: {
      id: true,
      containerNumber: true,
    },
  });

  const map = new Map<string, string | null>();
  orders.forEach(order => {
    map.set(order.id, order.containerNumber);
  });
  return map;
}

async function getPurchaseOrderContainer(
  orderId?: string | null
): Promise<string | undefined> {
  if (!orderId) {
    return undefined;
  }
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: orderId },
    select: { containerNumber: true },
  });
  return order?.containerNumber ?? undefined;
}

/**
 * 生成费用编号
 * 格式：EXP-YYYYMMDD-序号
 * 例如：EXP-20251103-001
 */
export async function generateExpenseNumber(
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx || prisma;

  // 获取当前日期（YYYYMMDD格式）
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // 查询今天已有的最大序号
  const prefix = `EXP-${dateStr}-`;
  const lastRecord = await db.expenseRecord.findFirst({
    where: {
      expenseNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      expenseNumber: 'desc',
    },
    select: {
      expenseNumber: true,
    },
  });

  let sequence = 1;
  if (lastRecord) {
    // 从最后一条记录中提取序号
    const lastSequence = parseInt(
      lastRecord.expenseNumber.substring(prefix.length),
      10
    );
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  // 生成新的费用编号（序号补齐3位）
  const sequenceStr = String(sequence).padStart(3, '0');
  return `${prefix}${sequenceStr}`;
}

/**
 * 创建费用记录
 */
export async function createExpenseRecord(
  data: CreateExpenseRequest,
  userId: string
): Promise<ExpenseRecord> {
  // 优先校验用户是否存在且可用，避免外键错误直接暴露给前端
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (!user) {
    throw ApiError.unauthorized(
      '当前登录用户不存在或已被删除，请重新登录后再创建费用记录'
    );
  }

  if (user.status !== 'active') {
    throw ApiError.forbidden('账户状态异常，无法创建费用记录');
  }

  let expense;

  try {
    // 使用事务确保单号生成和记录创建的原子性
    expense = await prisma.$transaction(async tx => {
      // 在事务内生成费用编号
      const expenseNumber = await generateExpenseNumber(tx);

      // 创建费用记录
      return await tx.expenseRecord.create({
        data: {
          expenseNumber,
          expenseType: data.expenseType,
          expenseName: data.expenseName,
          expenseAmount: data.expenseAmount,
          expenseDate: new Date(data.expenseDate),
          relatedType: data.relatedType || null,
          relatedId: data.relatedId || null,
          relatedNumber: data.relatedNumber || null,
          remarks: data.remarks || null,
          attachments: data.attachments || null,
          status: 'draft',
          userId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });
  } catch (error) {
    if (isPrismaError(error)) {
      throw handlePrismaError(error);
    }
    throw error;
  }

  const containerNumber =
    expense.expenseType === 'shipping' &&
    expense.relatedType === 'purchase_order'
      ? await getPurchaseOrderContainer(expense.relatedId)
      : undefined;

  const safeExpenseType = validateExpenseType(expense.expenseType)
    ? expense.expenseType
    : 'other';

  // 转换为 ExpenseRecord 类型
  return {
    id: expense.id,
    expenseNumber: expense.expenseNumber,
    expenseType: safeExpenseType as ExpenseRecord['expenseType'],
    expenseName: expense.expenseName,
    expenseAmount: toNumber(expense.expenseAmount),
    expenseDate: expense.expenseDate.toISOString(),
    relatedType: expense.relatedType as ExpenseRecord['relatedType'],
    relatedId: expense.relatedId || undefined,
    relatedNumber: expense.relatedNumber || undefined,
    containerNumber,
    remarks: expense.remarks || undefined,
    attachments: expense.attachments || undefined,
    status: expense.status as ExpenseRecord['status'],
    userId: expense.userId,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
    user: expense.user,
    userName: expense.user.name,
    approvedById: expense.approvedById || undefined,
    approvedAt: expense.approvedAt
      ? expense.approvedAt.toISOString()
      : undefined,
    cancelReason: expense.cancelReason || undefined,
    approvedBy: expense.approvedBy || undefined,
    paymentStatus: (expense as { paymentStatus?: string }).paymentStatus as
      | 'unpaid'
      | 'partial'
      | 'paid'
      | undefined,
    payableId:
      (expense as { payableId?: string | null }).payableId || undefined,
    supplierId:
      (expense as { supplierId?: string | null }).supplierId || undefined,
  };
}

/**
 * 费用类型映射（销售/厂家费用 → ExpenseRecord.expenseType）
 */
function mapFeeTypeToExpenseType(feeType: string): string {
  switch (feeType) {
    case 'freight':
    case 'shipping':
      return 'shipping';
    case 'loading_unloading':
      return 'loading_unloading';
    case 'storage':
      return 'storage';
    case 'labor':
      return 'labor';
    case 'operating':
      return 'operating';
    case 'management':
      return 'management';
    case 'travel':
      return 'travel';
    case 'living':
      return 'living';
    default:
      return 'other';
  }
}

export interface CompanyFeeItemLike {
  feeType: string;
  feeName: string;
  feeAmount: number;
  paidBy?: 'customer' | 'company';
  remarks?: string | null;
  // 可选的费用对应供应商，用于订单费用明细等场景
  supplierId?: string | null;
}

export interface EnsureCompanyExpensesParams {
  tx: Prisma.TransactionClient;
  sourceType: 'sales_order' | 'factory_shipment';
  sourceId: string;
  sourceNumber?: string;
  userId: string;
  supplierId?: string | null; // 可选，便于后续供应商维度统计
  feeItems: CompanyFeeItemLike[];
  expenseDate?: Date; // 默认 new Date()
}

/**
 * 幂等创建公司承担费用的 ExpenseRecord 列表
 * - 仅处理 paidBy === 'company' 的费用项
 * - 使用 (sourceType, sourceId, feeType, feeName, amount, yyyy-MM-dd) 生成幂等键
 */
export async function ensureCompanyExpenses(
  params: EnsureCompanyExpensesParams
): Promise<number> {
  const {
    tx,
    sourceType,
    sourceId,
    sourceNumber,
    userId,
    supplierId,
    feeItems,
  } = params;
  const expenseDate = params.expenseDate ?? new Date();

  // 动态导入以避免循环依赖
  const { generateExpenseIdempotencyKey } = await import(
    '@/lib/services/expense-idempotency'
  );

  let created = 0;

  for (const fee of feeItems) {
    if ((fee.paidBy ?? 'customer') !== 'company') continue;
    if (!fee.feeAmount || fee.feeAmount <= 0) continue;

    const idempotencyKey = generateExpenseIdempotencyKey({
      sourceType,
      sourceId,
      feeType: fee.feeType,
      feeName: fee.feeName,
      feeAmount: fee.feeAmount,
      expenseDate,
    });

    // 命中即跳过（幂等）
    const dup = await tx.expenseRecord.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (dup) continue;

    const expenseType = mapFeeTypeToExpenseType(fee.feeType);

    await tx.expenseRecord.create({
      data: {
        expenseNumber: await generateExpenseNumber(tx),
        expenseType,
        expenseName: fee.feeName,
        expenseAmount: Math.round(fee.feeAmount * 100) / 100,
        expenseDate,
        relatedType: sourceType,
        relatedId: sourceId,
        relatedNumber: sourceNumber || null,
        remarks: fee.remarks || null,
        userId,
        status: 'draft',
        paymentStatus: 'unpaid',
        idempotencyKey,
        supplierId: supplierId || null,
      },
    });
    created += 1;
  }

  return created;
}

/**
 * 审核费用记录
 */
export async function approveExpenseRecord(
  id: string,
  approverId: string
): Promise<ExpenseRecord> {
  const existing = await prisma.expenseRecord.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw ApiError.notFound('费用记录');
  }

  // 幂等性：如果已审核，直接返回现有记录而不抛错误
  if (existing.status === 'approved') {
    const approvedExpense = await prisma.expenseRecord.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!approvedExpense) {
      throw ApiError.notFound('费用记录');
    }

    const containerNumber =
      approvedExpense.expenseType === 'shipping' &&
      approvedExpense.relatedType === 'purchase_order'
        ? await getPurchaseOrderContainer(approvedExpense.relatedId)
        : undefined;

    const safeExpenseType = validateExpenseType(approvedExpense.expenseType)
      ? approvedExpense.expenseType
      : 'other';

    return {
      id: approvedExpense.id,
      expenseNumber: approvedExpense.expenseNumber,
      expenseType: safeExpenseType as ExpenseRecord['expenseType'],
      expenseName: approvedExpense.expenseName,
      expenseAmount: toNumber(approvedExpense.expenseAmount),
      expenseDate: approvedExpense.expenseDate.toISOString(),
      relatedType: approvedExpense.relatedType as ExpenseRecord['relatedType'],
      relatedId: approvedExpense.relatedId || undefined,
      relatedNumber: approvedExpense.relatedNumber || undefined,
      containerNumber,
      remarks: approvedExpense.remarks || undefined,
      attachments: approvedExpense.attachments || undefined,
      status: approvedExpense.status as ExpenseRecord['status'],
      userId: approvedExpense.userId,
      createdAt: approvedExpense.createdAt.toISOString(),
      updatedAt: approvedExpense.updatedAt.toISOString(),
      user: approvedExpense.user,
      userName: approvedExpense.user.name,
      approvedById: approvedExpense.approvedById || undefined,
      approvedAt: approvedExpense.approvedAt
        ? approvedExpense.approvedAt.toISOString()
        : undefined,
      cancelReason: approvedExpense.cancelReason || undefined,
      approvedBy: approvedExpense.approvedBy || undefined,
    };
  }

  if (existing.status === 'cancelled') {
    throw ApiError.badRequest('已作废的费用记录不能审核');
  }

  // 使用事务包装审批+应付款创建，确保原子性
  const expense = await prisma.$transaction(async tx => {
    // 1. 更新费用状态为已审批
    const updatedExpense = await tx.expenseRecord.update({
      where: { id },
      data: {
        status: 'approved',
        approvedById: approverId,
        approvedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 2. 阶段3：费用审批后自动创建/更新应付款（可选功能）
    if (
      env.EXPENSE_TO_PAYABLE_ENABLED &&
      updatedExpense.supplierId &&
      toNumber(updatedExpense.expenseAmount) > 0
    ) {
      try {
        await createOrMergePayableFromExpense({
          expenseId: updatedExpense.id,
          expenseNumber: updatedExpense.expenseNumber,
          expenseAmount: toNumber(updatedExpense.expenseAmount),
          supplierId: updatedExpense.supplierId,
          sourceType: updatedExpense.relatedType as
            | 'sales_order'
            | 'factory_shipment'
            | 'purchase_order'
            | 'other',
          sourceId: updatedExpense.relatedId,
          sourceNumber: updatedExpense.relatedNumber,
          userId: updatedExpense.userId,
          tx,
        });
      } catch (error) {
        logger.error(
          'expense-service',
          '审批后创建应付款失败，但不影响审批结果',
          error,
          {
            expenseId: updatedExpense.id,
            expenseNumber: updatedExpense.expenseNumber,
          }
        );
        // 不抛出错误，允许审批继续完成
      }
    }

    return updatedExpense;
  });

  const containerNumber =
    expense.expenseType === 'shipping' &&
    expense.relatedType === 'purchase_order'
      ? await getPurchaseOrderContainer(expense.relatedId)
      : undefined;

  const safeExpenseType = validateExpenseType(expense.expenseType)
    ? expense.expenseType
    : 'other';

  return {
    id: expense.id,
    expenseNumber: expense.expenseNumber,
    expenseType: safeExpenseType as ExpenseRecord['expenseType'],
    expenseName: expense.expenseName,
    expenseAmount: toNumber(expense.expenseAmount),
    expenseDate: expense.expenseDate.toISOString(),
    relatedType: expense.relatedType as ExpenseRecord['relatedType'],
    relatedId: expense.relatedId || undefined,
    relatedNumber: expense.relatedNumber || undefined,
    containerNumber,
    remarks: expense.remarks || undefined,
    attachments: expense.attachments || undefined,
    status: expense.status as ExpenseRecord['status'],
    userId: expense.userId,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
    user: expense.user,
    userName: expense.user.name,
    approvedById: expense.approvedById || undefined,
    approvedAt: expense.approvedAt
      ? expense.approvedAt.toISOString()
      : undefined,
    cancelReason: expense.cancelReason || undefined,
    approvedBy: expense.approvedBy || undefined,
  };
}

/**
 * 获取费用记录列表
 */
export async function getExpenseRecords(
  query: ExpenseQueryParams = {}
): Promise<{
  records: ExpenseRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}> {
  const {
    page = 1,
    pageSize = 20,
    expenseType,
    startDate,
    endDate,
    relatedType,
    status,
    sortBy = 'expenseDate',
    sortOrder = 'desc',
    includeTest,
    includeVoided,
  } = query;

  const skip = (page - 1) * pageSize;

  // 构建查询条件
  const where: Prisma.ExpenseRecordWhereInput = {};

  if (!includeVoided) {
    where.voidedAt = null;
  }

  const systemMode = await getSystemMode();
  if (systemMode === 'production' && !includeTest) {
    where.dataTag = 'prod';
  }

  if (expenseType) {
    where.expenseType = expenseType;
  }

  // ✅ P0修复: 使用本地时区解析日期，并正确设置结束日期上限
  if (startDate || endDate) {
    where.expenseDate = {};
    if (startDate) {
      // 开始日期：当天 00:00:00
      where.expenseDate.gte =
        parseLocalDateString(startDate) ?? new Date(startDate);
    }
    if (endDate) {
      // 结束日期：当天 23:59:59.999
      const endDateObj = parseLocalDateString(endDate) ?? new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      where.expenseDate.lte = endDateObj;
    }
  }

  if (relatedType) {
    where.relatedType = relatedType;
  }

  if (status) {
    where.status = status;
  }

  // 查询总数
  const total = await prisma.expenseRecord.count({ where });

  // 查询记录
  const expenses = await prisma.expenseRecord.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const shippingOrderIds = expenses
    .filter(
      expense =>
        expense.expenseType === 'shipping' &&
        expense.relatedType === 'purchase_order' &&
        expense.relatedId
    )
    .map(expense => expense.relatedId)
    .filter((id): id is string => id !== null) as string[];

  const containerMap = await getPurchaseOrderContainerMap(shippingOrderIds);

  // 转换为 ExpenseRecord 类型
  const records: ExpenseRecord[] = expenses.map(expense => {
    const safeExpenseType = validateExpenseType(expense.expenseType)
      ? expense.expenseType
      : 'other';

    return {
      id: expense.id,
      expenseNumber: expense.expenseNumber,
      expenseType: safeExpenseType as ExpenseRecord['expenseType'],
      expenseName: expense.expenseName,
      expenseAmount: toNumber(expense.expenseAmount),
      expenseDate: expense.expenseDate.toISOString(),
      relatedType: expense.relatedType as ExpenseRecord['relatedType'],
      relatedId: expense.relatedId || undefined,
      relatedNumber: expense.relatedNumber || undefined,
      containerNumber:
        expense.expenseType === 'shipping' &&
        expense.relatedType === 'purchase_order'
          ? containerMap.get(expense.relatedId || '') || undefined
          : undefined,
      remarks: expense.remarks || undefined,
      attachments: expense.attachments || undefined,
      status: expense.status as ExpenseRecord['status'],
      userId: expense.userId,
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString(),
      user: expense.user,
      userName: expense.user.name,
      approvedById: expense.approvedById || undefined,
      approvedAt: expense.approvedAt
        ? expense.approvedAt.toISOString()
        : undefined,
      cancelReason: expense.cancelReason || undefined,
      approvedBy: expense.approvedBy || undefined,
    };
  });

  return {
    records,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * 获取费用记录详情
 */
export async function getExpenseRecordById(
  id: string
): Promise<ExpenseRecord | null> {
  const expense = await prisma.expenseRecord.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!expense) {
    return null;
  }

  const containerNumber =
    expense.expenseType === 'shipping' &&
    expense.relatedType === 'purchase_order'
      ? await getPurchaseOrderContainer(expense.relatedId)
      : undefined;

  const safeExpenseType = validateExpenseType(expense.expenseType)
    ? expense.expenseType
    : 'other';

  // 转换为 ExpenseRecord 类型
  return {
    id: expense.id,
    expenseNumber: expense.expenseNumber,
    expenseType: safeExpenseType as ExpenseRecord['expenseType'],
    expenseName: expense.expenseName,
    expenseAmount: toNumber(expense.expenseAmount),
    expenseDate: expense.expenseDate.toISOString(),
    relatedType: expense.relatedType as ExpenseRecord['relatedType'],
    relatedId: expense.relatedId || undefined,
    relatedNumber: expense.relatedNumber || undefined,
    containerNumber,
    remarks: expense.remarks || undefined,
    attachments: expense.attachments || undefined,
    status: expense.status as ExpenseRecord['status'],
    userId: expense.userId,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
    user: expense.user,
    userName: expense.user.name,
    approvedById: expense.approvedById || undefined,
    approvedAt: expense.approvedAt
      ? expense.approvedAt.toISOString()
      : undefined,
    cancelReason: expense.cancelReason || undefined,
    approvedBy: expense.approvedBy || undefined,
  };
}

/**
 * 更新费用记录
 */
export async function updateExpenseRecord(
  id: string,
  data: UpdateExpenseRequest
): Promise<ExpenseRecord> {
  const existing = await prisma.expenseRecord.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!existing) {
    throw ApiError.notFound('费用记录');
  }

  // 已审核费用记录：只允许修改备注和附件
  let updateData: Prisma.ExpenseRecordUpdateInput = {};

  if (existing.status === 'approved') {
    if (data.remarks !== undefined) {
      updateData.remarks = data.remarks;
    }
    if (data.attachments !== undefined) {
      updateData.attachments = data.attachments;
    }
  } else {
    updateData = {
      ...(data.expenseType && { expenseType: data.expenseType }),
      ...(data.expenseName && { expenseName: data.expenseName }),
      ...(data.expenseAmount !== undefined && {
        expenseAmount: data.expenseAmount,
      }),
      ...(data.expenseDate && { expenseDate: new Date(data.expenseDate) }),
      ...(data.relatedType !== undefined && { relatedType: data.relatedType }),
      ...(data.relatedId !== undefined && { relatedId: data.relatedId }),
      ...(data.relatedNumber !== undefined && {
        relatedNumber: data.relatedNumber,
      }),
      ...(data.remarks !== undefined && { remarks: data.remarks }),
      ...(data.attachments !== undefined && { attachments: data.attachments }),
    };
  }

  const expense = await prisma.expenseRecord.update({
    where: { id },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const containerNumber =
    expense.expenseType === 'shipping' &&
    expense.relatedType === 'purchase_order'
      ? await getPurchaseOrderContainer(expense.relatedId)
      : undefined;

  // 转换为 ExpenseRecord 类型
  return {
    id: expense.id,
    expenseNumber: expense.expenseNumber,
    expenseType: (validateExpenseType(expense.expenseType)
      ? expense.expenseType
      : 'other') as ExpenseRecord['expenseType'],
    expenseName: expense.expenseName,
    expenseAmount: toNumber(expense.expenseAmount),
    expenseDate: expense.expenseDate.toISOString(),
    relatedType: expense.relatedType as ExpenseRecord['relatedType'],
    relatedId: expense.relatedId || undefined,
    relatedNumber: expense.relatedNumber || undefined,
    containerNumber,
    remarks: expense.remarks || undefined,
    attachments: expense.attachments || undefined,
    status: expense.status as ExpenseRecord['status'],
    userId: expense.userId,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
    user: expense.user,
    userName: expense.user.name,
    approvedById: expense.approvedById || undefined,
    approvedAt: expense.approvedAt
      ? expense.approvedAt.toISOString()
      : undefined,
    cancelReason: expense.cancelReason || undefined,
    approvedBy: expense.approvedBy || undefined,
  };
}

/**
 * 删除费用记录
 */
export async function deleteExpenseRecord(id: string): Promise<void> {
  const existing = await prisma.expenseRecord.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw ApiError.notFound('费用记录');
  }

  if (existing.status === 'approved') {
    throw ApiError.forbidden('已审核的费用记录不允许删除');
  }

  await prisma.expenseRecord.delete({ where: { id } });
}

/**
 * 获取费用统计数据
 */
export async function getExpenseStatistics(
  params: ExpenseStatisticsParams
): Promise<ExpenseStatistics> {
  const {
    startDate,
    endDate,
    groupBy = 'type',
    expenseType,
    relatedType,
  } = params;

  // ✅ P0修复: 使用本地时区解析日期，并正确设置结束日期上限
  // 构建查询条件
  const startDateObj = parseLocalDateString(startDate) ?? new Date(startDate);
  const endDateObj = parseLocalDateString(endDate) ?? new Date(endDate);
  endDateObj.setHours(23, 59, 59, 999);

  const where: Prisma.ExpenseRecordWhereInput = {
    expenseDate: {
      gte: startDateObj,
      lte: endDateObj,
    },
  };

  if (expenseType) {
    where.expenseType = expenseType;
  }

  // ✅ P1修复: 添加关联业务类型筛选
  if (relatedType) {
    where.relatedType = relatedType;
  }

  // 1. 计算总览数据
  const aggregateResult = await prisma.expenseRecord.aggregate({
    where,
    _sum: {
      expenseAmount: true,
    },
    _count: {
      id: true,
    },
    _avg: {
      expenseAmount: true,
    },
  });

  const totalAmount = toNumber(aggregateResult._sum.expenseAmount);
  const totalCount = aggregateResult._count.id || 0;
  const averageAmount = toNumber(aggregateResult._avg.expenseAmount);

  // 2. 按费用类型分组统计
  const byTypeRaw = await prisma.expenseRecord.groupBy({
    by: ['expenseType'],
    where,
    _sum: {
      expenseAmount: true,
    },
    _count: {
      id: true,
    },
  });

  const byType: ExpenseStatisticsByType[] = byTypeRaw.map(item => ({
    expenseType: item.expenseType as ExpenseRecord['expenseType'],
    expenseTypeName:
      EXPENSE_TYPE_LABELS[item.expenseType as ExpenseRecord['expenseType']],
    totalAmount: Math.round(toNumber(item._sum.expenseAmount) * 100) / 100,
    count: item._count.id,
    percentage:
      totalAmount > 0
        ? Math.round(
            (toNumber(item._sum.expenseAmount) / totalAmount) * 10000
          ) / 100
        : 0,
  }));

  // 3. 根据 groupBy 参数进行额外的分组统计
  let byDate: ExpenseStatisticsByDate[] | undefined;
  let byMonth: ExpenseStatisticsByMonth[] | undefined;

  if (groupBy === 'date') {
    // 按日期分组统计
    // 按日期分组
    const dateMap = new Map<
      string,
      {
        totalAmount: number;
        count: number;
        byType: Map<
          string,
          { expenseType: string; totalAmount: number; count: number }
        >;
      }
    >();

    let cursor: string | undefined;
    const batchSize = 1000;

    while (true) {
      const expenses = await prisma.expenseRecord.findMany({
        where,
        select: {
          id: true,
          expenseDate: true,
          expenseType: true,
          expenseAmount: true,
        },
        orderBy: {
          id: 'asc',
        },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (expenses.length === 0) {
        break;
      }

      expenses.forEach(expense => {
        const dateStr = expense.expenseDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const typeStr = expense.expenseType;

        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, {
            totalAmount: 0,
            count: 0,
            byType: new Map(),
          });
        }

        const dateData = dateMap.get(dateStr);
        if (!dateData) return;

        const expenseAmount = toNumber(expense.expenseAmount);
        dateData.totalAmount += expenseAmount;
        dateData.count += 1;

        if (!dateData.byType.has(typeStr)) {
          dateData.byType.set(typeStr, {
            expenseType: typeStr,
            totalAmount: 0,
            count: 0,
          });
        }

        const typeData = dateData.byType.get(typeStr);
        if (!typeData) return;

        typeData.totalAmount += expenseAmount;
        typeData.count += 1;
      });

      cursor = expenses[expenses.length - 1].id;
    }

    byDate = Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      totalAmount: Math.round(data.totalAmount * 100) / 100,
      count: data.count,
      byType: Array.from(data.byType.values()).map(item => ({
        expenseType: item.expenseType as ExpenseRecord['expenseType'],
        expenseTypeName:
          EXPENSE_TYPE_LABELS[item.expenseType as ExpenseRecord['expenseType']],
        amount: Math.round(item.totalAmount * 100) / 100,
        count: item.count,
      })),
    }));
  } else if (groupBy === 'month') {
    // 按月份分组统计
    // 按月份分组
    const monthMap = new Map<
      string,
      {
        totalAmount: number;
        count: number;
        byType: Map<
          string,
          { expenseType: string; totalAmount: number; count: number }
        >;
      }
    >();

    let cursor: string | undefined;
    const batchSize = 1000;

    while (true) {
      const expenses = await prisma.expenseRecord.findMany({
        where,
        select: {
          id: true,
          expenseDate: true,
          expenseType: true,
          expenseAmount: true,
        },
        orderBy: {
          id: 'asc',
        },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (expenses.length === 0) {
        break;
      }

      expenses.forEach(expense => {
        const date = expense.expenseDate;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const monthStr = `${year}-${month}`; // YYYY-MM
        const typeStr = expense.expenseType;

        if (!monthMap.has(monthStr)) {
          monthMap.set(monthStr, {
            totalAmount: 0,
            count: 0,
            byType: new Map(),
          });
        }

        const monthData = monthMap.get(monthStr);
        if (!monthData) return;

        const expenseAmount = toNumber(expense.expenseAmount);
        monthData.totalAmount += expenseAmount;
        monthData.count += 1;

        if (!monthData.byType.has(typeStr)) {
          monthData.byType.set(typeStr, {
            expenseType: typeStr,
            totalAmount: 0,
            count: 0,
          });
        }

        const typeData = monthData.byType.get(typeStr);
        if (!typeData) return;

        typeData.totalAmount += expenseAmount;
        typeData.count += 1;
      });

      cursor = expenses[expenses.length - 1].id;
    }

    byMonth = Array.from(monthMap.entries()).map(([month, data]) => ({
      month,
      totalAmount: Math.round(data.totalAmount * 100) / 100,
      count: data.count,
      byType: Array.from(data.byType.values()).map(item => ({
        expenseType: item.expenseType as ExpenseRecord['expenseType'],
        expenseTypeName:
          EXPENSE_TYPE_LABELS[item.expenseType as ExpenseRecord['expenseType']],
        amount: Math.round(item.totalAmount * 100) / 100,
        count: item.count,
      })),
    }));
  }

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalCount,
    averageAmount: Math.round(averageAmount * 100) / 100,
    byType,
    byDate,
    byMonth,
    startDate,
    endDate,
  };
}
