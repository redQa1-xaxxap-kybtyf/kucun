/**
 * 销售订单导出服务 - 专门处理销售订单的图片和Excel导出
 */

import type { SalesOrderDetail } from '@/app/(dashboard)/sales-orders/[id]/components/types';
import { roundCostPrice } from '@/lib/utils/cost-price';
import {
  getSalesOrderDisplayUnitPrice,
  getSalesOrderItemDisplayCode,
  getSalesOrderItemDisplayName,
  getSalesOrderItemSpecification,
  getSalesOrderItemQuantityText,
  getSalesOrderItemWeightKg,
  getSalesOrderNormalizedDisplayUnit,
  getSalesOrderTotalQuantitySummary,
  getSalesOrderTotalWeightKg,
} from '@/lib/utils/sales-order-display';
import { getSalesOrderReceivableTotal } from '@/lib/utils/sample-order';

import {
  ExportService,
  type ExcelExportOptions,
  type ImageExportOptions,
} from './export-service';
import { PrintTemplateExportService } from './print-template-export-service';

/**
 * 销售订单图片导出配置
 */
export interface SalesOrderImageExportOptions
  extends Omit<ImageExportOptions, 'filename'> {
  /** 订单ID */
  orderId: string;
  /** 订单号 */
  orderNumber: string;
}

/**
 * 销售订单Excel导出配置
 */
export interface SalesOrderExcelExportOptions
  extends Omit<ExcelExportOptions, 'filename'> {
  /** 订单ID */
  orderId: string;
  /** 订单号 */
  orderNumber: string;
}

/**
 * 销售订单导出数据类型
 */
export interface SalesOrderExcelData extends Record<string, string | number> {
  /** 产品名称 */
  产品名称: string;
  /** 产品编号 */
  产品编号: string;
  /** 规格 */
  规格: string;
  /** 品牌 */
  品牌: string;
  /** 单位 */
  单位: string;
  /** 数量 */
  数量: string;
  /** 重量(kg) */
  '重量(kg)': string | number;
  /** 单价 */
  单价: number;
  /** 小计 */
  小计: number;
  /** 成本价 */
  成本价: number;
  /** 毛利 */
  毛利: number;
  /** 毛利率(%) */
  '毛利率(%)': number;
  /** 备注 */
  备注: string;
}

/**
 * 销售订单导出服务
 */
export class SalesOrderExportService {
  /**
   * 导出销售订单为图片
   * @param options 导出配置
   */
  static async exportOrderToImage(
    options: SalesOrderImageExportOptions
  ): Promise<void> {
    const { orderId: _orderId, orderNumber, ...imageOptions } = options;

    // 生成文件名：销售订单-订单号-日期
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `销售订单-${orderNumber}-${date}`;

    await PrintTemplateExportService.exportDocumentToImage({
      templateType: 'sales-order',
      documentId: options.orderId,
      ...imageOptions,
      filename,
    });
  }

  /**
   * 导出销售订单为Excel
   * @param order 销售订单数据
   * @param options 导出配置
   */
  static exportOrderToExcel(
    order: SalesOrderDetail,
    options: SalesOrderExcelExportOptions
  ): Promise<void> {
    const { orderId: _orderId, orderNumber, ...excelOptions } = options;

    // 生成文件名：销售订单-订单号-日期
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `销售订单-${orderNumber}-${date}`;

    // 准备Excel数据
    const excelData = this.prepareOrderExcelData(order);

    // 配置列宽
    const columnWidths = [
      20, // 产品名称
      15, // 产品编号
      15, // 规格
      10, // 品牌
      8, // 单位
      10, // 数量
      12, // 重量(kg)
      10, // 单价
      10, // 小计
      10, // 成本价
      10, // 毛利
      10, // 毛利率
      20, // 备注
    ];

    return ExportService.exportToExcel<SalesOrderExcelData>(excelData, {
      ...excelOptions,
      filename,
      sheetName: '订单明细',
      columnWidths,
    });
  }

  /**
   * 准备销售订单Excel数据
   * @param order 销售订单数据
   * @returns Excel数据数组
   */
  private static prepareOrderExcelData(
    order: SalesOrderDetail
  ): SalesOrderExcelData[] {
    const orderItems = order.items ?? [];

    return orderItems.map(item => {
      // 片单价 & 成本单价（技术字段）
      const costPrice = item.unitCost || 0;
      const unitPricePiece = item.unitPrice || 0;
      const grossProfitPiece = unitPricePiece - costPrice;
      const grossProfitRate =
        unitPricePiece > 0 ? (grossProfitPiece / unitPricePiece) * 100 : 0;
      const displayUnit = getSalesOrderNormalizedDisplayUnit(item);
      const displayUnitPrice = getSalesOrderDisplayUnitPrice(item);
      const quantityText = getSalesOrderItemQuantityText(item);
      const itemWeightKg = getSalesOrderItemWeightKg(item);

      return {
        产品名称: getSalesOrderItemDisplayName(item),
        产品编号: getSalesOrderItemDisplayCode(item),
        规格: getSalesOrderItemSpecification(item),
        品牌: '', // 产品表中没有品牌字段
        单位: displayUnit,
        数量: quantityText,
        '重量(kg)':
          typeof itemWeightKg === 'number'
            ? Number(itemWeightKg.toFixed(3))
            : '-',
        单价: Number(displayUnitPrice.toFixed(2)),
        小计: Number((item.subtotal || 0).toFixed(2)),
        成本价: roundCostPrice(costPrice),
        毛利: Number(grossProfitPiece.toFixed(2)),
        '毛利率(%)': Number(grossProfitRate.toFixed(2)),
        备注: item.remarks || '',
      };
    });
  }

  /**
   * 生成销售订单摘要数据（用于Excel第一页）
   * @param order 销售订单数据
   * @returns 摘要数据对象
   */
  private static prepareOrderSummaryData(
    order: SalesOrderDetail
  ): Record<string, string | number> {
    const customer = order.customer;
    const orderItems = order.items ?? [];

    // 计算汇总数据
    const totalWeightKg = getSalesOrderTotalWeightKg(orderItems);
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
      客户名称: customer?.name || '',
      联系电话: customer?.phone || '',
      收货地址: '', // 客户表中没有地址字段
      订单状态: this.getOrderStatusText(order.status),
      创建时间: order.createdAt
        ? new Date(order.createdAt).toLocaleString('zh-CN')
        : '',
      确认时间: '', // 订单表中没有确认时间字段
      发货时间: order.shippedAt
        ? new Date(order.shippedAt).toLocaleString('zh-CN')
        : '',
      产品数量: getSalesOrderTotalQuantitySummary(orderItems),
      '总重量(kg)': Number(totalWeightKg.toFixed(3)),
      订单总额: Number(totalAmount.toFixed(2)),
      已收金额: Number(paidAmount.toFixed(2)),
      未付金额: Number(unpaidAmount.toFixed(2)),
      备注: order.remarks || '',
    };
  }

  /**
   * 获取订单状态文本
   * @param status 订单状态
   * @returns 状态文本
   */
  private static getOrderStatusText(status: string): string {
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
   * 导出销售订单为完整Excel（包含摘要和明细）
   * @param order 销售订单数据
   * @param options 导出配置
   */
  static exportOrderToCompleteExcel(
    order: SalesOrderDetail,
    options: SalesOrderExcelExportOptions
  ): void {
    const { orderId: _orderId, orderNumber } = options;

    // 生成文件名
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `销售订单-${orderNumber}-${date}`;

    // 准备数据
    const summaryData = this.prepareOrderSummaryData(order);
    const detailData = this.prepareOrderExcelData(order);

    // 使用原始XLSX库创建多工作表文件
    import('xlsx')
      .then(XLSX => {
        const workbook = XLSX.utils.book_new();

        // 创建摘要工作表
        const summaryWorksheet = XLSX.utils.json_to_sheet([summaryData]);
        XLSX.utils.book_append_sheet(workbook, summaryWorksheet, '订单摘要');

        // 创建明细工作表
        const detailWorksheet = XLSX.utils.json_to_sheet(detailData);

        // 设置明细表的列宽
        const columnWidths = [20, 15, 15, 10, 8, 10, 10, 10, 10, 10, 10, 20];
        detailWorksheet['!cols'] = columnWidths.map(width => ({ width }));

        XLSX.utils.book_append_sheet(workbook, detailWorksheet, '订单明细');

        // 导出文件
        XLSX.writeFile(workbook, `${filename}.xlsx`, {
          compression: true,
        });
      })
      .catch(error => {
        const message = error instanceof Error ? error.message : '未知错误';
        throw new Error(`导出Excel失败: ${message}`);
      });
  }
}
