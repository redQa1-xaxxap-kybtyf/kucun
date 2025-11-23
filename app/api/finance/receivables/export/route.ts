/**
 * 应收账款导出 API 路由
 * POST /api/finance/receivables/export
 *
 * 职责:
 * - 身份认证和权限检查
 * - 参数验证
 * - 调用服务层获取数据
 * - 生成Excel/CSV文件
 * - 返回文件下载响应
 */

import { type NextRequest } from 'next/server';

import { errorResponse, withAuth } from '@/lib/auth/api-helpers';
import { logger } from '@/lib/logger';
import { ExportAuditService } from '@/lib/services/export-audit-service';
import { getReceivables } from '@/lib/services/receivables-service';
import { accountsReceivableQuerySchema } from '@/lib/validations/payment';

/**
 * POST /api/finance/receivables/export - 导出应收账款
 * 权限：需要 finance:export 权限
 * 支持格式：Excel (xlsx) 和 CSV
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    try {
      // 参数验证
      const body = await request.json();
      const { pageSize, format = 'excel', ...restBody } = body ?? {};
      const paymentStatusBody =
        restBody?.paymentStatus ?? restBody?.status ?? undefined;

      const validationResult = accountsReceivableQuerySchema.safeParse({
        ...restBody,
        paymentStatus: paymentStatusBody,
        page: 1,
        limit: restBody?.limit ?? pageSize ?? 50000, // 限制最大5万条
      });

      if (!validationResult.success) {
        return errorResponse(
          `参数验证失败: ${validationResult.error.issues[0]?.message}`,
          400
        );
      }

      // 验证导出格式
      if (format !== 'excel' && format !== 'csv') {
        return errorResponse('不支持的导出格式，仅支持 excel 或 csv', 400);
      }

      // 调用服务层获取数据
      const result = await getReceivables(validationResult.data);

      if (result.receivables.length === 0) {
        return errorResponse('没有符合条件的数据可导出', 404);
      }

      // 数据量检查：超过限制时建议用户使用筛选条件
      if (result.pagination.total > 50000) {
        logger.warn('finance', '导出数据量超过限制', {
          total: result.pagination.total,
          userId: user.id,
        });
        return errorResponse(
          `数据量过大（${result.pagination.total}条），已超过导出限制（50,000条）。请使用日期范围、客户筛选等条件缩小导出范围。`,
          400
        );
      }

      // 动态导入导出服务（避免服务端加载客户端代码）
      const { ReceivablesExportService } = await import(
        '@/lib/services/receivables-export-service'
      );

      // 生成文件名
      const filename = ReceivablesExportService.generateFilename(
        {
          status: validationResult.data.paymentStatus,
          startDate: validationResult.data.startDate,
          endDate: validationResult.data.endDate,
          search: validationResult.data.search,
          customerName: result.receivables[0]?.customer?.name,
        },
        user.name || user.email.split('@')[0] || '系统'
      );

      // 准备导出数据
      const exportData = ReceivablesExportService.prepareExportData(
        result.receivables
      );

      // 根据格式生成内容
      let fileContent: string;
      let contentType: string;
      let fileExtension: string;

      if (format === 'csv') {
        const { CSVExportService } = await import(
          '@/lib/services/csv-export-service'
        );
        fileContent = CSVExportService.generateCSVContent(exportData, {
          dateFields: ['创建时间', '确认时间', '发货时间'],
          numberFields: ['订单金额', '已付金额', '应收余额'],
          fieldOrder: [
            '订单编号',
            '客户名称',
            '订单金额',
            '已付金额',
            '应收余额',
            '订单状态',
            '创建时间',
            '确认时间',
            '发货时间',
            '备注',
          ],
        });
        contentType = 'text/csv;charset=utf-8';
        fileExtension = 'csv';
      } else {
        // Excel格式 - 使用服务端XLSX生成
        const XLSX = await import('xlsx');

        // 创建工作表数据
        const worksheet = XLSX.utils.json_to_sheet(exportData);

        // 设置列宽
        worksheet['!cols'] = [
          { width: 15 }, // 订单编号
          { width: 20 }, // 客户名称
          { width: 12 }, // 订单金额
          { width: 12 }, // 已付金额
          { width: 12 }, // 应收余额
          { width: 10 }, // 订单状态
          { width: 20 }, // 创建时间
          { width: 20 }, // 确认时间
          { width: 20 }, // 发货时间
          { width: 30 }, // 备注
        ];

        // 创建工作簿
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '应收账款');

        // 生成Buffer
        const buffer = XLSX.write(workbook, {
          type: 'buffer',
          bookType: 'xlsx',
          compression: true,
        });

        fileContent = buffer.toString('base64');
        contentType =
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExtension = 'xlsx';
      }

      // 记录导出审计日志
      await ExportAuditService.logExport({
        module: 'receivables',
        format,
        recordCount: result.receivables.length,
        filters: {
          paymentStatus: validationResult.data.paymentStatus,
          startDate: validationResult.data.startDate,
          endDate: validationResult.data.endDate,
          search: validationResult.data.search,
        },
        userId: user.id,
        userName: user.name || user.email,
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        success: true,
        filename: `${filename}.${fileExtension}`,
      });

      // 返回文件
      // 生成ASCII安全的文件名（RFC 6266 + RFC 5987标准）
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const asciiFilename = `receivables_${timestamp}.${fileExtension}`;
      const encodedFilename = encodeURIComponent(asciiFilename);

      // 直接使用普通对象传递headers,避免Headers对象的ByteString验证
      // RFC 6266标准: filename参数使用双引号包裹ASCII安全文件名
      // RFC 5987标准: filename*参数支持UTF-8编码
      const responseHeaders = {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-cache',
        'Access-Control-Expose-Headers': 'Content-Disposition',
      };

      return new Response(
        format === 'csv' ? fileContent : Buffer.from(fileContent, 'base64'),
        {
          status: 200,
          headers: responseHeaders,
        }
      );
    } catch (error) {
      logger.error('finance', '导出应收账款失败', error);
      const errorMessage =
        error instanceof Error ? error.message : '导出应收账款失败';

      // 记录失败审计日志
      try {
        await ExportAuditService.logExport({
          module: 'receivables',
          format: 'excel',
          recordCount: 0,
          userId: user.id,
          userName: user.name || user.email,
          ipAddress:
            request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            undefined,
          userAgent: request.headers.get('user-agent') || undefined,
          success: false,
          errorMessage,
        });
      } catch (auditError) {
        // 审计失败不应阻断错误响应
        logger.error('finance', '记录审计日志失败', auditError);
      }

      return errorResponse(errorMessage, 500);
    }
  },
  { permissions: ['finance:export'] }
);
