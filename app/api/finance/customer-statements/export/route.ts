/**
 * 客户对账单导出 API
 * POST /api/finance/customer-statements/export
 *
 * 职责:
 * - 身份认证和权限检查
 * - 参数验证
 * - 调用服务层获取单个客户对账单详情
 * - 在服务端生成 Excel 文件
 * - 返回文件下载响应
 */

import { type NextRequest } from 'next/server';

import { errorResponse, withAuth } from '@/lib/auth/api-helpers';
import { logger } from '@/lib/logger';
import { getCustomerStatementDetail } from '@/lib/services/customer-statement-service';
import { ExportAuditService } from '@/lib/services/export-audit-service';
import type { CustomerStatementDetail } from '@/lib/types/customer-statement';

const DEFAULT_RANGE_DAYS = 30;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - DEFAULT_RANGE_DAYS);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
}

function normalizeRange(
  startDate: string | null,
  endDate: string | null
): { startDate: string; endDate: string } {
  if (startDate && endDate) {
    return { startDate, endDate };
  }

  if (startDate && !endDate) {
    const parsedStart = new Date(startDate);
    if (Number.isNaN(parsedStart.valueOf())) {
      return getDefaultDateRange();
    }
    const derivedEnd = new Date(parsedStart);
    derivedEnd.setDate(parsedStart.getDate() + DEFAULT_RANGE_DAYS);
    return {
      startDate,
      endDate: formatDate(derivedEnd),
    };
  }

  if (!startDate && endDate) {
    const parsedEnd = new Date(endDate);
    if (Number.isNaN(parsedEnd.valueOf())) {
      return getDefaultDateRange();
    }
    const derivedStart = new Date(parsedEnd);
    derivedStart.setDate(parsedEnd.getDate() - DEFAULT_RANGE_DAYS);
    return {
      startDate: formatDate(derivedStart),
      endDate,
    };
  }

  return getDefaultDateRange();
}

function buildExportRows(detail: CustomerStatementDetail) {
  const { customerName, periodStart, periodEnd, summary, openingBalance, transactions } = detail;

  const summaryRow = {
    客户名称: customerName,
    对账期间开始: periodStart,
    对账期间结束: periodEnd,
    期初余额: openingBalance,
    销售金额: summary.receivables.salesAmount,
    退货金额: summary.receivables.salesReturnAmount,
    收款金额: summary.receivables.paymentReceived,
    预收款: summary.receivables.prepaymentReceived,
    已退款金额: summary.receivables.refundPaid ?? 0,
    应收余额: summary.receivables.receivableBalance,
  };

  const detailRows = transactions.map(tx => ({
    日期: tx.transactionDate,
    类型: tx.transactionType,
    单据号: tx.referenceNumber,
    描述: tx.description,
    增加应收: tx.debitAmount,
    减少应收: tx.creditAmount,
    余额: tx.balance,
    状态: tx.status,
  }));

  const rows = [
    summaryRow,
    { ...summaryRow, 客户名称: '——明细如下——' },
    ...detailRows,
  ];

  return {
    rows,
    recordCount: detailRows.length,
  };
}

/**
 * POST /api/finance/customer-statements/export
 * 权限：需要 finance:export
 * 说明：当前仅支持 Excel 导出
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    try {
      const body = (await request.json().catch(() => ({}))) as {
        customerId?: string;
        startDate?: string;
        endDate?: string;
        format?: 'excel' | 'csv';
      } | null;

      const customerId = body?.customerId;
      const format = body?.format ?? 'excel';

      if (!customerId || typeof customerId !== 'string') {
        return errorResponse('缺少客户ID', 400);
      }

      if (format !== 'excel') {
        return errorResponse('不支持的导出格式，仅支持 excel', 400);
      }

      const { startDate, endDate } = normalizeRange(
        body?.startDate ?? null,
        body?.endDate ?? null
      );

      const detail = await getCustomerStatementDetail(
        customerId,
        startDate,
        endDate
      );

      if (!detail.transactions || detail.transactions.length === 0) {
        return errorResponse('该时间段内暂无对账记录，无法导出', 404);
      }

      const { rows, recordCount } = buildExportRows(detail);

      // 使用服务端 XLSX 生成Excel文件
      const XLSX = await import('xlsx');

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '客户对账单');

      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
        compression: true,
      });

      const fileContent = buffer.toString('base64');
      const contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const fileExtension = 'xlsx';

      const filenameBase = `客户对账单-${detail.customerName}-${startDate}_至_${endDate}`;

      // 记录导出审计日志
      await ExportAuditService.logExport({
        module: 'customer-statements',
        format: 'excel',
        recordCount,
        filters: {
          customerId,
          startDate,
          endDate,
        },
        userId: user.id,
        userName: user.name || user.email,
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        success: true,
        filename: `${filenameBase}.${fileExtension}`,
      });

      // 生成ASCII安全的文件名
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const asciiFilename = `customer-statement_${timestamp}.${fileExtension}`;
      const encodedFilename = encodeURIComponent(asciiFilename);

      const responseHeaders = {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-cache',
        'Access-Control-Expose-Headers': 'Content-Disposition',
      };

      return new Response(Buffer.from(fileContent, 'base64'), {
        status: 200,
        headers: responseHeaders,
      });
    } catch (error) {
      logger.error('finance-customer-statements', '导出客户对账单失败', error);
      const errorMessage =
        error instanceof Error ? error.message : '导出客户对账单失败';

      try {
        await ExportAuditService.logExport({
          module: 'customer-statements',
          format: 'excel',
          recordCount: 0,
          userId: user.id,
          userName: undefined,
          ipAddress:
            request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            undefined,
          userAgent: request.headers.get('user-agent') || undefined,
          success: false,
          errorMessage,
        });
      } catch (auditError) {
        logger.error(
          'finance-customer-statements',
          '记录客户对账单导出审计日志失败',
          auditError
        );
      }

      return errorResponse(errorMessage, 500);
    }
  },
  { permissions: ['finance:export'] }
);


