/**
 * 应付款导出服务
 *
 * 职责：
 * - 准备应付款导出数据
 * - 字段映射和格式化
 * - 调用通用导出服务
 */

import type { Payable } from '@prisma/client';

import { CSVExportService } from './csv-export-service';
import { EnhancedExcelExportService } from './enhanced-excel-export-service';

/**
 * 应付款导出数据类型（扁平化结构）
 */
export interface PayableExportData {
  /** 应付款编号 */
  应付款编号: string;
  /** 供应商名称 */
  供应商名称: string;
  /** 应付金额 */
  应付金额: number;
  /** 已付金额 */
  已付金额: number;
  /** 剩余金额 */
  剩余金额: number;
  /** 付款状态 */
  付款状态: string;
  /** 来源类型 */
  来源类型: string;
  /** 来源单号 */
  来源单号: string;
  /** 到期日期 */
  到期日期: string;
  /** 创建时间 */
  创建时间: string;
  /** 备注 */
  备注: string;
}

/**
 * 扩展的应付款数据（包含关联数据）
 */
export interface PayableWithRelations extends Payable {
  supplier?: {
    name: string;
  } | null;
}

/**
 * 状态映射
 */
const STATUS_MAP: Record<string, string> = {
  pending: '待付款',
  partial: '部分付款',
  paid: '已付款',
  cancelled: '已取消',
};

/**
 * 来源类型映射
 */
const SOURCE_TYPE_MAP: Record<string, string> = {
  purchase_order: '采购订单',
  factory_shipment: '厂家发货',
  sales_order: '销售订单',
  service: '服务费用',
  other: '其他',
};

/**
 * 应付款导出服务
 */
export class PayablesExportService {
  /**
   * 准备导出数据（将应付款数据转换为导出格式）
   *
   * @param payables 应付款数据数组
   * @returns 导出数据数组
   */
  static prepareExportData(
    payables: PayableWithRelations[]
  ): PayableExportData[] {
    return payables.map(item => ({
      应付款编号: item.payableNumber || '',
      供应商名称: item.supplier?.name || '未知供应商',
      应付金额: item.payableAmount,
      已付金额: item.paidAmount,
      剩余金额: item.remainingAmount,
      付款状态: STATUS_MAP[item.status] || item.status,
      来源类型: SOURCE_TYPE_MAP[item.sourceType] || item.sourceType,
      来源单号: item.sourceOrderNumber || '',
      到期日期: item.dueDate?.toISOString() || '',
      创建时间: item.createdAt?.toISOString() || '',
      备注: item.remarks || '',
    }));
  }

  /**
   * 导出为Excel文件
   *
   * @param payables 应付款数据
   * @param filename 文件名
   */
  static exportToExcel(
    payables: PayableWithRelations[],
    filename: string
  ): void {
    const data = this.prepareExportData(payables);

    EnhancedExcelExportService.exportToEnhancedExcel(data, {
      filename,
      sheetName: '应付账款',
      dateFields: ['到期日期', '创建时间'],
      numberFields: ['应付金额', '已付金额', '剩余金额'],
      freezeHeader: true,
      dateFormat: 'yyyy-MM-dd HH:mm:ss',
    });
  }

  /**
   * 导出为CSV文件
   *
   * @param payables 应付款数据
   * @param filename 文件名
   */
  static exportToCSV(payables: PayableWithRelations[], filename: string): void {
    const data = this.prepareExportData(payables);

    CSVExportService.exportToCSV(data, {
      filename,
      dateFields: ['到期日期', '创建时间'],
      numberFields: ['应付金额', '已付金额', '剩余金额'],
      dateFormat: 'yyyy-MM-dd HH:mm:ss',
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
      '应付账款',
      filterSummary,
      userName
    );
  }
}
