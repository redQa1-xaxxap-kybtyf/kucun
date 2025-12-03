/**
 * 付款记录导出 API
 * POST /api/finance/payments-out/export
 *
 * 职责:
 * - 身份认证和权限检查
 * - 参数验证（沿用 paymentOutRecordQuerySchema）
 * - 调用 Prisma 查询付款记录
 * - 在服务端生成 Excel/CSV 文件
 * - 返回文件下载响应
 */

import { type NextRequest } from 'next/server';

import { errorResponse, withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { paymentOutRecordQuerySchema } from '@/lib/validations/payable';

type ExportFormat = 'excel' | 'csv';

export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        format?: ExportFormat;
        page?: number | string;
        limit?: number | string;
        search?: string;
        payableRecordId?: string;
        supplierId?: string;
        status?: string;
        paymentMethod?: string;
        startDate?: string;
        endDate?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      } | null;

      const format: ExportFormat = body?.format ?? 'excel';

      if (format !== 'excel' && format !== 'csv') {
        return errorResponse('不支持的导出格式，仅支持 excel 或 csv', 400);
      }

      // 将 page/limit 转换为字符串以匹配验证规则的输入类型，
      // 同时为导出场景提供更大的默认 limit（最多 50,000 条）
      const validationResult = paymentOutRecordQuerySchema.safeParse({
        ...body,
        page:
          body && body.page !== undefined && body.page !== null
            ? String(body.page)
            : '1',
        limit:
          body && body.limit !== undefined && body.limit !== null
            ? String(body.limit)
            : '50000', // 导出默认最多 5 万条
      });

      if (!validationResult.success) {
        return errorResponse(
          `参数验证失败: ${validationResult.error.issues[0]?.message}`,
          400
        );
      }

      const {
        search,
        payableRecordId,
        supplierId,
        status,
        paymentMethod,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        limit,
      } = validationResult.data;

      const where: Record<string, unknown> = {};

      if (search) {
        where.OR = [
          { paymentNumber: { contains: search, mode: 'insensitive' } },
          { supplier: { name: { contains: search, mode: 'insensitive' } } },
          { voucherNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (payableRecordId) {
        where.payableRecordId = payableRecordId;
      }

      if (supplierId) {
        where.supplierId = supplierId;
      }

      if (status) {
        where.status = status;
      }

      if (paymentMethod) {
        where.paymentMethod = paymentMethod;
      }

      if (startDate || endDate) {
        const dateFilter: { gte?: Date; lte?: Date } = {};
        if (startDate) {
          dateFilter.gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter.lte = end;
        }
        where.paymentDate = dateFilter;
      }

      const totalCount = await prisma.paymentOutRecord.count({ where });

      if (totalCount === 0) {
        return errorResponse('没有符合条件的数据可导出', 404);
      }

      if (totalCount > 50000) {
        logger.warn('finance-payments-out', '付款导出数据量超过限制', {
          totalCount,
        });
        return errorResponse(
          `数据量过大（${totalCount}条），已超过导出限制（50,000条）。请使用日期范围、供应商、状态等筛选条件缩小导出范围。`,
          400
        );
      }

      const payments = await prisma.paymentOutRecord.findMany({
        where,
        include: {
          payableRecord: {
            select: {
              id: true,
              payableNumber: true,
              payableAmount: true,
              remainingAmount: true,
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        take: limit,
        skip: 0,
      });

      const exportRows = payments.map(payment => ({
        付款编号: payment.paymentNumber,
        供应商名称: payment.supplier?.name ?? '',
        付款金额: Number(payment.paymentAmount),
        付款方式: payment.paymentMethod,
        付款状态: payment.status,
        付款日期: payment.paymentDate.toISOString(),
        应付款编号: payment.payableRecord?.payableNumber ?? '',
        应付金额: Number(payment.payableRecord?.payableAmount ?? 0),
        剩余应付金额: Number(payment.payableRecord?.remainingAmount ?? 0),
        经办人: payment.user?.name ?? '',
        凭证号: payment.voucherNumber ?? '',
        备注: payment.remarks ?? '',
      }));

      if (format === 'csv') {
        const { CSVExportService } = await import(
          '@/lib/services/csv-export-service'
        );

        const fileContent = CSVExportService.generateCSVContent(exportRows, {
          dateFields: ['付款日期'],
          numberFields: ['付款金额', '应付金额', '剩余应付金额'],
          fieldOrder: [
            '付款编号',
            '供应商名称',
            '付款金额',
            '付款方式',
            '付款状态',
            '付款日期',
            '应付款编号',
            '应付金额',
            '剩余应付金额',
            '经办人',
            '凭证号',
            '备注',
          ],
        });

        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 19);
        const asciiFilename = `payments-out_${timestamp}.csv`;
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
        { width: 16 }, // 付款编号
        { width: 18 }, // 供应商名称
        { width: 12 }, // 付款金额
        { width: 12 }, // 付款方式
        { width: 12 }, // 付款状态
        { width: 20 }, // 付款日期
        { width: 16 }, // 应付款编号
        { width: 12 }, // 应付金额
        { width: 14 }, // 剩余应付金额
        { width: 12 }, // 经办人
        { width: 16 }, // 凭证号
        { width: 30 }, // 备注
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '付款记录');

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
      const asciiFilename = `payments-out_${timestamp}.xlsx`;
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
      logger.error('finance-payments-out', '导出付款记录失败', error);
      const errorMessage =
        error instanceof Error ? error.message : '导出付款记录失败';
      return errorResponse(errorMessage, 500);
    }
  },
  { permissions: ['finance:view'] }
);
