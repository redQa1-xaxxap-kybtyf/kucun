/**
 * 销售订单导出 API
 * POST /api/sales-orders/[id]/export
 *
 * 职责：
 * - 身份认证和权限检查
 * - 根据订单 ID 加载销售订单详情（含明细）
 * - 在服务端生成 Excel 文件（支持明细 / 完整两种模式）
 * - 返回文件下载响应
 *
 * 说明：
 * - 目前仅支持 Excel（xlsx）格式
 * - 单订单导出，数据量有限，无需流式处理
 */

import { type NextRequest } from 'next/server';

import type { SalesOrderDetail } from '@/app/(dashboard)/sales-orders/[id]/components/types';
import { getSalesOrderDetailWithPayments } from '@/lib/api/handlers/sales-orders/detail';
import { errorResponse, withAuth } from '@/lib/auth/api-helpers';
import { logger } from '@/lib/logger';
import {
  SAMPLE_SETTLEMENT_TYPE_LABELS,
  getSalesOrderReceivableTotal,
} from '@/lib/utils/sample-order';

type ExportMode = 'details' | 'complete';

/**
 * 根据订单详情构建“明细导出数据”
 * 结构与现有前端导出的 SalesOrderExcelData 保持一致，便于后续对比
 */
function buildDetailExportRows(order: SalesOrderDetail) {
  const items = order.items ?? [];

  return items.map(item => {
    const costPrice = item.unitCost || 0;
    const unitPricePiece = item.unitPrice || 0;
    const grossProfitPiece = unitPricePiece - costPrice;
    const grossProfitRate =
      unitPricePiece > 0 ? (grossProfitPiece / unitPricePiece) * 100 : 0;

    const displayUnit = item.displayUnit || item.product?.unit || '';
    const piecesPerUnit =
      item.piecesPerUnit ?? item.product?.piecesPerUnit ?? 0;
    const quantityDisplay =
      typeof item.displayQuantity === 'number' && item.displayQuantity > 0
        ? item.displayQuantity
        : item.quantity || 0;

    // 与前端导出规则保持一致：
    // - 若按件销售：单价 = 行小计 ÷ 件数
    // - 否则：单价 = 片单价
    let displayUnitPrice = unitPricePiece;
    if (displayUnit === '件') {
      const units =
        typeof item.displayQuantity === 'number' && item.displayQuantity > 0
          ? item.displayQuantity
          : piecesPerUnit > 0 && item.quantity
            ? item.quantity / piecesPerUnit
            : undefined;

      if (units && item.subtotal) {
        const perUnit = item.subtotal / units;
        if (Number.isFinite(perUnit)) {
          displayUnitPrice = perUnit;
        }
      } else if (piecesPerUnit > 0) {
        displayUnitPrice = unitPricePiece * piecesPerUnit;
      }
    }

    return {
      产品名称: item.product?.name || '',
      产品编号: item.product?.code || item.productCode || '',
      规格: item.product?.specification || item.specification || '',
      品牌: '',
      单位: displayUnit,
      数量: quantityDisplay,
      单价: Number(displayUnitPrice.toFixed(2)),
      小计: Number((item.subtotal || 0).toFixed(2)),
      成本价: Number(costPrice.toFixed(2)),
      毛利: Number(grossProfitPiece.toFixed(2)),
      '毛利率(%)': Number(grossProfitRate.toFixed(2)),
      备注: item.remarks || '',
    };
  });
}

function getOrderStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    draft: '草稿',
    confirmed: '已确认',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消',
  };
  return statusMap[status] || status;
}

/**
 * 构建订单摘要导出数据（单行）
 */
function buildSummaryExportRow(order: SalesOrderDetail) {
  const customer = order.customer;
  const orderItems = order.items ?? [];

  const totalQuantity = orderItems.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
  );
  const totalAmount = order.totalAmount || 0;
  const receivableTotal = getSalesOrderReceivableTotal({
    isSampleOrder: order.isSampleOrder,
    sampleSettlementType: order.sampleSettlementType,
    totalAmount: order.totalAmount,
    roundingAdjustment: order.roundingAdjustment,
  });
  const paidAgainstOrder = (order.paymentRecords || [])
    .filter(record => record.status === 'confirmed')
    .reduce((sum, record) => sum + Number(record.paymentAmount || 0), 0);
  const prepaymentApplied =
    order.prepaymentTotalApplied ??
    (order.prepaymentUsages || []).reduce(
      (sum, usage) => sum + Number(usage.appliedAmount || 0),
      0
    );
  const paidAmount = paidAgainstOrder + prepaymentApplied;
  const unpaidAmount = Math.max(0, receivableTotal - paidAmount);

  return {
    订单号: order.orderNumber || '',
    业务标签: order.isSampleOrder
      ? SAMPLE_SETTLEMENT_TYPE_LABELS[order.sampleSettlementType ?? 'FREE']
      : order.orderType === 'TRANSFER'
        ? '调货销售'
        : '正常销售',
    客户名称: customer?.name || '',
    联系电话: customer?.phone || '',
    收货地址: customer?.address || '',
    订单状态: getOrderStatusText(order.status),
    创建时间: order.createdAt
      ? new Date(order.createdAt).toLocaleString('zh-CN')
      : '',
    确认时间: '',
    发货时间: order.shippedAt
      ? new Date(order.shippedAt).toLocaleString('zh-CN')
      : '',
    产品数量: totalQuantity,
    订单总额: Number(totalAmount.toFixed(2)),
    已付金额: Number(paidAmount.toFixed(2)),
    未付金额: Number(unpaidAmount.toFixed(2)),
    备注: order.remarks || '',
  };
}

export const POST = withAuth(
  async (request: NextRequest, { params }) => {
    try {
      const bag = params ? await Promise.resolve(params) : ({} as any);
      const id = (bag as Record<string, string>).id;

      if (!id) {
        return errorResponse('缺少订单ID', 400);
      }

      const body = (await request.json().catch(() => ({}))) as {
        mode?: ExportMode;
        format?: 'excel' | 'csv';
      } | null;

      const mode: ExportMode =
        body?.mode === 'complete' ? 'complete' : 'details';
      const format = body?.format ?? 'excel';

      if (format !== 'excel') {
        return errorResponse('不支持的导出格式，仅支持 excel', 400);
      }

      const detail = (await getSalesOrderDetailWithPayments(
        id
      )) as SalesOrderDetail | null;

      if (!detail) {
        return errorResponse('销售订单不存在', 404);
      }

      if (!detail.items || detail.items.length === 0) {
        return errorResponse('该订单暂无明细，无法导出', 404);
      }

      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      if (mode === 'complete') {
        const summaryRow = buildSummaryExportRow(detail);
        const summarySheet = XLSX.utils.json_to_sheet([summaryRow]);
        XLSX.utils.book_append_sheet(workbook, summarySheet, '订单摘要');
      }

      const detailRows = buildDetailExportRows(detail);
      const detailSheet = XLSX.utils.json_to_sheet(detailRows);
      const columnWidths = [
        20, // 产品名称
        15, // 产品编号
        15, // 规格
        10, // 品牌
        8, // 单位
        10, // 数量
        10, // 单价
        10, // 小计
        10, // 成本价
        10, // 毛利
        10, // 毛利率
        20, // 备注
      ];
      detailSheet['!cols'] = columnWidths.map(width => ({ width }));
      XLSX.utils.book_append_sheet(workbook, detailSheet, '订单明细');

      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
        compression: true,
      });

      const fileContent = buffer.toString('base64');
      const contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const fileExtension = 'xlsx';

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const asciiFilename = `sales-order_${timestamp}.${fileExtension}`;
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
      logger.error('sales-orders', '导出销售订单失败', error);
      const errorMessage =
        error instanceof Error ? error.message : '导出销售订单失败';
      return errorResponse(errorMessage, 500);
    }
  },
  { permissions: ['sales:view'] }
);
