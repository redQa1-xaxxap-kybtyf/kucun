/**
 * 厂家发货导出 API 路由
 * POST /api/factory-shipments/export
 *
 * 职责:
 * - 身份认证和权限检查
 * - 参数验证
 * - 调用服务层获取数据
 * - 生成Excel/CSV文件
 * - 返回文件下载响应
 */

import { type NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';

import { errorResponse, withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ExportAuditService } from '@/lib/services/export-audit-service';
import { FACTORY_SHIPMENT_ITEM_OWNERSHIP } from '@/lib/types/factory-shipment';
import { factoryShipmentOrderListParamsSchema } from '@/lib/validations/factory-shipment';

/**
 * POST /api/factory-shipments/export - 导出厂家发货
 * 权限：需要 factory_shipments:export 权限
 * 支持格式：Excel (xlsx) 和 CSV
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    try {
      // 参数验证
      const body = await request.json();
      const { format = 'excel', ...restBody } = body ?? {};

      const validationResult = factoryShipmentOrderListParamsSchema.safeParse({
        ...restBody,
        page: 1,
        limit: restBody?.limit ?? 50000, // 限制最大5万条
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
        page = 1,
        limit = 50000,
        mode,
        status,
        customerId,
        containerNumber,
        orderNumber,
        startDate,
        endDate,
      } = validationResult.data;

      // 构建查询条件
      const whereConditions: Prisma.FactoryShipmentOrderWhereInput = {};

      // 状态筛选
      if (status) {
        whereConditions.status = status;
      }

      // 客户筛选
      if (customerId) {
        whereConditions.customerId = customerId;
      }

      if (mode === 'customer_direct') {
        whereConditions.items = {
          some: {
            ownership: FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER,
          },
        };
      } else if (mode === 'factory') {
        whereConditions.items = {
          some: {
            ownership: FACTORY_SHIPMENT_ITEM_OWNERSHIP.SELF,
          },
        };
      }

      // 搜索条件：柜号或订单号
      if (containerNumber && orderNumber) {
        whereConditions.OR = [
          { containerNumber: { contains: containerNumber } },
          { orderNumber: { contains: orderNumber } },
        ];
      } else if (containerNumber) {
        whereConditions.containerNumber = { contains: containerNumber };
      } else if (orderNumber) {
        whereConditions.orderNumber = { contains: orderNumber };
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
      const totalCount = await prisma.factoryShipmentOrder.count({
        where: whereConditions,
      });

      if (totalCount === 0) {
        return errorResponse('没有符合条件的数据可导出', 404);
      }

      if (totalCount > 50000) {
        logger.warn('factory-shipments', '厂家发货导出数据量超过限制', {
          total: totalCount,
          userId: user.id,
        });
        return errorResponse(
          `数据量过大（${totalCount}条），已超过导出限制（50,000条）。请使用日期范围、客户、状态等筛选条件缩小导出范围。`,
          400
        );
      }

      // 查询数据
      const shipments = await prisma.factoryShipmentOrder.findMany({
        where: whereConditions,
        include: {
          customer: {
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
          items: {
            select: {
              id: true,
              productId: true,
              supplierId: true,
              productCode: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              ownership: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      });

      // 动态导入导出服务
      const { FactoryShipmentsExportService } = await import(
        '@/lib/services/factory-shipments-export-service'
      );

      // 生成文件名
      const filename = FactoryShipmentsExportService.generateFilename(
        {
          status: validationResult.data.status,
          customerId: validationResult.data.customerId,
          containerNumber: validationResult.data.containerNumber,
          startDate: validationResult.data.startDate,
          endDate: validationResult.data.endDate,
          customerName: shipments[0]?.customer?.name,
        },
        user.name || user.email.split('@')[0] || '系统'
      );

      // 准备导出数据
      const exportData = FactoryShipmentsExportService.prepareExportData(
        shipments as any
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
          dateFields: [
            '发货日期',
            '预计到港',
            '实际到港',
            '交付日期',
            '完成日期',
            '创建时间',
          ],
          numberFields: [
            '应收金额',
            '定金金额',
            '已收金额',
            '总成本',
            '总费用',
            '总利润',
            '客户货利润',
            '自有货成本',
          ],
          fieldOrder: [
            '订单编号',
            '柜号',
            '客户名称',
            '订单状态',
            '应收金额',
            '定金金额',
            '已收金额',
            '总成本',
            '总费用',
            '总利润',
            '客户货利润',
            '自有货成本',
            '发货日期',
            '预计到港',
            '实际到港',
            '交付日期',
            '完成日期',
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
          { width: 15 }, // 订单编号
          { width: 15 }, // 柜号
          { width: 20 }, // 客户名称
          { width: 10 }, // 订单状态
          { width: 12 }, // 应收金额
          { width: 12 }, // 定金金额
          { width: 12 }, // 已收金额
          { width: 12 }, // 总成本
          { width: 12 }, // 总费用
          { width: 12 }, // 总利润
          { width: 12 }, // 客户货利润
          { width: 12 }, // 自有货成本
          { width: 20 }, // 发货日期
          { width: 20 }, // 预计到港
          { width: 20 }, // 实际到港
          { width: 20 }, // 交付日期
          { width: 20 }, // 完成日期
          { width: 20 }, // 创建时间
          { width: 30 }, // 备注
        ];

        // 创建工作簿
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '厂家发货');

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
        module: 'factory-shipments',
        format,
        recordCount: totalCount,
        filters: {
          status: validationResult.data.status,
          customerId: validationResult.data.customerId,
          containerNumber: validationResult.data.containerNumber,
          startDate: validationResult.data.startDate,
          endDate: validationResult.data.endDate,
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
      const asciiFilename = `factory-shipments_${timestamp}.${fileExtension}`;
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
      logger.error('factory-shipments', '导出厂家发货失败', error);
      const errorMessage =
        error instanceof Error ? error.message : '导出厂家发货失败';

      // 记录失败审计日志
      try {
        await ExportAuditService.logExport({
          module: 'factory-shipments',
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
        logger.error('factory-shipments', '记录审计日志失败', auditError);
      }

      return errorResponse(errorMessage, 500);
    }
  },
  { permissions: ['factory_shipments:export'] }
);
