/**
 * 应收款导出服务
 *
 * 职责：
 * - 准备应收款导出数据
 * - 字段映射和格式化
 * - 调用通用导出服务
 */

import type {
  PaymentStatus,
  ReceivableItem,
} from '@/lib/services/receivables-types';

import { CSVExportService } from './csv-export-service';
import { EnhancedExcelExportService } from './enhanced-excel-export-service';

/**
 * 应收款导出数据类型（扁平化结构）
 */
export interface ReceivableExportData extends Record<string, unknown> {
  /** 订单编号 */
  订单编号: string;
  /** 客户名称 */
  客户名称: string;
  /** 订单金额 */
  订单金额: number;
  /** 已收金额 */
  已收金额: number;
  /** 应收余额 */
  应收余额: number;
  /** 订单状态 */
  订单状态: string;
  /** 创建时间 */
  创建时间: string;
  /** 确认时间 */
  确认时间: string;
  /** 发货时间 */
  发货时间: string;
  /** 备注 */
  备注: string;
}

/**
 * 状态映射
 */
const PAYMENT_STATUS_MAP: Record<PaymentStatus, string> = {
  unpaid: '未收款',
  partial: '部分收款',
  pending: '待确认',
  paid: '已收款',
};

/**
 * 应收款导出服务
 */
export class ReceivablesExportService {
  /**
   * 准备导出数据（将应收款数据转换为导出格式）
   *
   * @param receivables 应收款数据数组
   * @returns 导出数据数组
   */
  static prepareExportData(
    receivables: ReceivableItem[]
  ): ReceivableExportData[] {
    return receivables.map(item => ({
      订单编号: item.orderNumber || '',
      客户名称: item.customerName || '未知客户',
      订单金额: item.totalAmount,
      已收金额: item.paidAmount,
      应收余额: item.remainingAmount,
      订单状态:
        PAYMENT_STATUS_MAP[item.paymentStatus] || item.paymentStatus || '',
      创建时间: item.orderDate || '',
      确认时间: item.lastPaymentDate || '',
      发货时间: '', // 列保留，当前列表数据中无对应字段
      备注: '', // 列保留，当前列表数据中无对应字段
    }));
  }

  /**
   * 导出为Excel文件
   *
   * @param receivables 应收款数据
   * @param filename 文件名
   */
  static exportToExcel(receivables: ReceivableItem[], filename: string): void {
    const data = this.prepareExportData(receivables);

    EnhancedExcelExportService.exportToEnhancedExcel(data, {
      filename,
      sheetName: '应收账款',
      dateFields: ['创建时间', '确认时间', '发货时间'],
      numberFields: ['订单金额', '已收金额', '应收余额'],
      freezeHeader: true,
      dateFormat: 'yyyy-MM-dd HH:mm:ss',
    });
  }

  /**
   * 导出为CSV文件
   *
   * @param receivables 应收款数据
   * @param filename 文件名
   */
  static exportToCSV(receivables: ReceivableItem[], filename: string): void {
    const data = this.prepareExportData(receivables);

    CSVExportService.exportToCSV(data, {
      filename,
      dateFields: ['创建时间', '确认时间', '发货时间'],
      numberFields: ['订单金额', '已收金额', '应收余额'],
      dateFormat: 'yyyy-MM-dd HH:mm:ss',
      fieldOrder: [
        '订单编号',
        '客户名称',
        '订单金额',
        '已收金额',
        '应收余额',
        '订单状态',
        '创建时间',
        '确认时间',
        '发货时间',
        '备注',
      ],
    });
  }

  /**
   * 生成规范文件名
   *
   * @param filters 筛选条件
   * @param userName 操作者姓名
   * @returns 文件名（不含扩展名）
   */
  static generateFilename(
    filters: Record<string, unknown>,
    userName: string
  ): string {
    const filterSummary =
      EnhancedExcelExportService.buildFilterSummary(filters);
    return EnhancedExcelExportService.generateFilename(
      '应收账款',
      filterSummary,
      userName
    );
  }
}
