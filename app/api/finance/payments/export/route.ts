/**
 * 收款记录导出 API
 * POST /api/finance/payments/export
 *
 * 职责:
 * - 身份认证和权限检查
 * - 参数验证（沿用 paymentRecordQuerySchema）
 * - 调用 Prisma 查询收款记录
 * - 在服务端生成 Excel/CSV 文件
 * - 返回文件下载响应
 */

import { type NextRequest } from 'next/server';

import { errorResponse, withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { buildExcludeAutoReceivableConfirmationWhere } from '@/lib/services/receivables-helpers';
import { paymentRecordQuerySchema } from '@/lib/validations/payment';

type ExportFormat = 'excel' | 'csv';

export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        format?: ExportFormat;
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        paymentMethod?: string;
        customerId?: string;
        userId?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        startDate?: string;
        endDate?: string;
      } | null;

      const format: ExportFormat = body?.format ?? 'excel';

      if (format !== 'excel' && format !== 'csv') {
        return errorResponse('不支持的导出格式，仅支持 excel 或 csv', 400);
      }

      const validationResult = paymentRecordQuerySchema.safeParse({
        ...body,
        page: 1,
        limit: body?.limit ?? 50000, // 限制最大 5 万条
      });

      if (!validationResult.success) {
        return errorResponse(
          `提交内容有误： ${validationResult.error.issues[0]?.message}`,
          400
        );
      }

      const {
        search,
        status,
        paymentMethod,
        customerId,
        userId,
        sortBy,
        sortOrder,
        startDate,
        endDate,
        limit,
      } = validationResult.data;

      const where: Record<string, unknown> = {};

      if (search) {
        where.OR = [
          { paymentNumber: { contains: search } },
          { receiptNumber: { contains: search } },
          { remarks: { contains: search } },
          { customer: { name: { contains: search } } },
          { salesOrder: { orderNumber: { contains: search } } },
        ];
      }

      if (status) {
        where.status = status;
      }

      if (paymentMethod) {
        where.paymentMethod = paymentMethod;
      }

      if (customerId) {
        where.customerId = customerId;
      }

      if (userId) {
        where.userId = userId;
      }

      if (startDate || endDate) {
        const paymentDateFilter: { gte?: Date; lte?: Date } = {};
        if (startDate) {
          paymentDateFilter.gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          paymentDateFilter.lte = end;
        }
        where.paymentDate = paymentDateFilter;
      }

      Object.assign(where, buildExcludeAutoReceivableConfirmationWhere());

      const totalCount = await prisma.paymentRecord.count({ where });

      if (totalCount === 0) {
        return errorResponse('没有符合条件的数据可导出', 404);
      }

      if (totalCount > 50000) {
        logger.warn('finance-payments', '收款导出数据量超过限制', {
          totalCount,
        });
        return errorResponse(
          `数据量过大（${totalCount}条），已超过导出限制（50,000条）。请使用日期范围、客户、状态等筛选条件缩小导出范围。`,
          400
        );
      }

      const orderByMap: Record<
        string,
        {
          paymentDate?: 'asc' | 'desc';
          paymentAmount?: 'asc' | 'desc';
          createdAt?: 'asc' | 'desc';
        }
      > = {
        paymentDate: { paymentDate: sortOrder as 'asc' | 'desc' },
        paymentAmount: { paymentAmount: sortOrder as 'asc' | 'desc' },
        createdAt: { createdAt: sortOrder as 'asc' | 'desc' },
      };

      const orderBy = orderByMap[sortBy as string] ?? {
        paymentDate: sortOrder || 'desc',
      };

      const payments = await prisma.paymentRecord.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              roundingAdjustment: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy,
        take: limit,
        skip: 0,
      });

      const exportRows = payments.map(payment => {
        const paymentAmount = Number(payment.paymentAmount);
        const actualPaymentAmount = Number(
          (payment as any).actualPaymentAmount ?? payment.paymentAmount
        );
        const roundingAmount = Number((payment as any).roundingAmount ?? 0);

        return {
          收款编号: payment.paymentNumber,
          客户名称: payment.customer?.name ?? '',
          收款金额: paymentAmount,
          实际收款金额: actualPaymentAmount,
          抹零金额: roundingAmount,
          收款方式: payment.paymentMethod ?? '',
          收款状态: payment.status ?? 'pending',
          收款日期: payment.paymentDate.toISOString(),
          关联订单号: payment.salesOrder?.orderNumber ?? '',
          订单金额: Number(payment.salesOrder?.totalAmount ?? 0),
          经办人: payment.user?.name ?? '',
          收据号: payment.receiptNumber ?? '',
          备注: payment.remarks ?? '',
        };
      });

      if (format === 'csv') {
        const { CSVExportService } = await import(
          '@/lib/services/csv-export-service'
        );

        const fileContent = CSVExportService.generateCSVContent(exportRows, {
          dateFields: ['收款日期'],
          numberFields: ['收款金额', '实际收款金额', '抹零金额', '订单金额'],
          fieldOrder: [
            '收款编号',
            '客户名称',
            '收款金额',
            '实际收款金额',
            '抹零金额',
            '收款方式',
            '收款状态',
            '收款日期',
            '关联订单号',
            '订单金额',
            '经办人',
            '收据号',
            '备注',
          ],
        });

        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 19);
        const asciiFilename = `payments_${timestamp}.csv`;
        const encodedFilename = encodeURIComponent(asciiFilename);

        const headers = {
          'Content-Type': 'text/csv;charset=utf-8',
          'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
          'Cache-Control': 'no-cache',
          'Access-Control-Expose-Headers': 'Content-Disposition',
        };

        return new Response(fileContent, {
          status: 200,
          headers,
        });
      }

      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(exportRows);

      worksheet['!cols'] = [
        { width: 16 }, // 收款编号
        { width: 18 }, // 客户名称
        { width: 12 }, // 收款金额
        { width: 14 }, // 实际收款金额
        { width: 12 }, // 抹零金额
        { width: 12 }, // 收款方式
        { width: 12 }, // 收款状态
        { width: 20 }, // 收款日期
        { width: 16 }, // 关联订单号
        { width: 12 }, // 订单金额
        { width: 12 }, // 经办人
        { width: 16 }, // 收据号
        { width: 30 }, // 备注
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '收款记录');

      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
        compression: true,
      });

      const fileContent = buffer.toString('base64');
      const contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const asciiFilename = `payments_${timestamp}.xlsx`;
      const encodedFilename = encodeURIComponent(asciiFilename);

      const headers = {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-cache',
        'Access-Control-Expose-Headers': 'Content-Disposition',
      };

      return new Response(Buffer.from(fileContent, 'base64'), {
        status: 200,
        headers,
      });
    } catch (error) {
      logger.error('finance-payments', '导出收款记录失败', error);
      const errorMessage =
        error instanceof Error ? error.message : '导出收款记录失败';
      return errorResponse(errorMessage, 500);
    }
  },
  { anyPermissions: ['finance:view', 'finance:export'] }
);

