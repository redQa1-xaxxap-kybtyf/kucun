/**
 * 应付款导出 API 路由
 * POST /api/finance/payables/export
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
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ExportAuditService } from '@/lib/services/export-audit-service';
import { payableRecordQuerySchema } from '@/lib/validations/payable';

/**
 * POST /api/finance/payables/export - 导出应付款
 * 权限：需要 finance:export 权限
 * 支持格式：Excel (xlsx) 和 CSV
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    try {
      // 参数验证
      const body = await request.json();
      const { format = 'excel', ...restBody } = body ?? {};

      const validationResult = payableRecordQuerySchema.safeParse({
        ...restBody,
        page: '1',
        limit: String(restBody?.limit ?? 50000), // 限制最大5万条
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

      const {
        page,
        limit,
        search,
        status,
        sourceType,
        sortBy,
        sortOrder,
        startDate,
        endDate,
      } = validationResult.data;

      // 构建查询条件
      const whereConditions: {
        OR?: Array<{
          payableNumber?: { contains: string };
          remarks?: { contains: string };
          supplier?: { name?: { contains: string } };
        }>;
        status?: string;
        sourceType?: string;
        createdAt?: { gte?: Date; lte?: Date };
      } = {};

      // 搜索条件
      if (search) {
        whereConditions.OR = [
          { payableNumber: { contains: search } },
          { remarks: { contains: search } },
          { supplier: { name: { contains: search } } },
        ];
      }

      // 状态筛选
      if (status) {
        whereConditions.status = status;
      }

      // 来源类型筛选
      if (sourceType) {
        whereConditions.sourceType = sourceType;
      }

      // 日期范围
      if (startDate || endDate) {
        whereConditions.createdAt = {};
        if (startDate) {
          whereConditions.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          whereConditions.createdAt.lte = new Date(endDate);
        }
      }

      // 数据量检查：先统计总数
      const totalCount = await prisma.payableRecord.count({
        where: whereConditions,
      });

      if (totalCount === 0) {
        return errorResponse('没有符合条件的数据可导出', 404);
      }

      if (totalCount > 50000) {
        logger.warn('finance', '应付款导出数据量超过限制', {
          total: totalCount,
          userId: user.id,
        });
        return errorResponse(
          `数据量过大（${totalCount}条），已超过导出限制（50,000条）。请使用日期范围、供应商、状态等筛选条件缩小导出范围。`,
          400
        );
      }

      // 查询数据
      const payables = await prisma.payableRecord.findMany({
        where: whereConditions,
        include: {
          supplier: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          [sortBy || 'createdAt']: sortOrder || 'desc',
        },
        take: limit,
        skip: (page - 1) * limit,
      });

      // 动态导入导出服务
      const { PayablesExportService } = await import(
        '@/lib/services/payables-export-service'
      );

      // 生成文件名
      const filename = PayablesExportService.generateFilename(
        {
          status: validationResult.data.status,
          sourceType: validationResult.data.sourceType,
          startDate: validationResult.data.startDate,
          endDate: validationResult.data.endDate,
          search: validationResult.data.search,
          supplierName: payables[0]?.supplier?.name,
        },
        user.name || user.email.split('@')[0] || '系统'
      );

      // 准备导出数据
      const exportData = PayablesExportService.prepareExportData(payables);

      // 根据格式生成内容
      let fileContent: string;
      let contentType: string;
      let fileExtension: string;

      if (format === 'csv') {
        const { CSVExportService } = await import(
          '@/lib/services/csv-export-service'
        );
        fileContent = CSVExportService.generateCSVContent(exportData, {
          dateFields: ['到期日期', '创建时间'],
          numberFields: ['应付金额', '已付金额', '剩余金额'],
          fieldOrder: [
            '应付款编号',
            '供应商名称',
            '应付金额',
            '已付金额',
            '剩余金额',
            '付款状态',
            '来源类型',
            '来源单号',
            '到期日期',
            '创建时间',
            '备注',
          ],
        });
        contentType = 'text/csv;charset=utf-8';
        fileExtension = 'csv';
      } else {
        // Excel格式
        const XLSX = await import('xlsx');

        // 创建工作表数据
        const worksheet = XLSX.utils.json_to_sheet(exportData);

        // 设置列宽
        worksheet['!cols'] = [
          { width: 15 }, // 应付款编号
          { width: 20 }, // 供应商名称
          { width: 12 }, // 应付金额
          { width: 12 }, // 已付金额
          { width: 12 }, // 剩余金额
          { width: 10 }, // 付款状态
          { width: 12 }, // 来源类型
          { width: 15 }, // 来源单号
          { width: 20 }, // 到期日期
          { width: 20 }, // 创建时间
          { width: 30 }, // 备注
        ];

        // 创建工作簿
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '应付账款');

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
        module: 'payables',
        format,
        recordCount: totalCount,
        filters: {
          status: validationResult.data.status,
          sourceType: validationResult.data.sourceType,
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
      const asciiFilename = `payables_${timestamp}.${fileExtension}`;
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
      logger.error('finance', '导出应付款失败', error);
      const errorMessage =
        error instanceof Error ? error.message : '导出应付款失败';

      // 记录失败审计日志
      try {
        await ExportAuditService.logExport({
          module: 'payables',
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
        logger.error('finance', '记录审计日志失败', auditError);
      }

      return errorResponse(errorMessage, 500);
    }
  },
  { permissions: ['finance:export'] }
);
