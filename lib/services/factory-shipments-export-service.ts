/**
 * 厂家发货导出服务
 *
 * 职责：
 * - 准备厂家发货导出数据
 * - 字段映射和格式化
 * - 调用通用导出服务
 */

import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';

import { CSVExportService } from './csv-export-service';
import { EnhancedExcelExportService } from './enhanced-excel-export-service';

/**
 * 厂家发货导出数据类型（扁平化结构）
 */
export interface FactoryShipmentExportData extends Record<string, unknown> {
  /** 订单编号 */
  订单编号: string;
  /** 柜号 */
  柜号: string;
  /** 客户名称 */
  客户名称: string;
  /** 订单状态 */
  订单状态: string;
  /** 应收金额 */
  应收金额: number;
  /** 定金金额 */
  定金金额: number;
  /** 已收金额 */
  已收金额: number;
  /** 总成本 */
  总成本: number;
  /** 总费用 */
  总费用: number;
  /** 总利润 */
  总利润: number;
  /** 客户货利润 */
  客户货利润: number;
  /** 自有货成本 */
  自有货成本: number;
  /** 发货日期 */
  发货日期: string;
  /** 预计到港 */
  预计到港: string;
  /** 实际到港 */
  实际到港: string;
  /** 交付日期 */
  交付日期: string;
  /** 完成日期 */
  完成日期: string;
  /** 创建时间 */
  创建时间: string;
  /** 备注 */
  备注: string;
}

/**
 * 状态映射
 */
const STATUS_MAP: Record<string, string> = {
  draft: '草稿',
  confirmed: '已确认',
  pending_shipment: '待发货',
  shipped: '已发货',
  in_transit: '运输中',
  arrived: '到港',
  cancelled: '已取消',
};

/**
 * 厂家发货导出服务
 */
export class FactoryShipmentsExportService {
  /**
   * 准备导出数据（将厂家发货数据转换为导出格式）
   *
   * @param shipments 厂家发货数据数组
   * @returns 导出数据数组
   */
  static prepareExportData(
    shipments: FactoryShipmentOrder[]
  ): FactoryShipmentExportData[] {
    return shipments.map(item => ({
      订单编号: item.orderNumber || '',
      柜号: item.containerNumber || '',
      客户名称: item.customer?.name || '未知客户',
      订单状态: STATUS_MAP[item.status] || item.status,
      应收金额: item.receivableAmount || 0,
      定金金额: item.depositAmount || 0,
      已收金额: item.paidAmount || 0,
      总成本: item.costAmount || 0,
      总费用: item.expenseAmount || 0,
      总利润: item.profitAmount || 0,
      客户货利润: item.customerProfit || 0,
      自有货成本: item.selfCostAmount || 0,
      发货日期: item.shipmentDate?.toISOString() || '',
      预计到港: item.estimatedArrival?.toISOString() || '',
      实际到港: item.arrivalDate?.toISOString() || '',
      交付日期: item.deliveryDate?.toISOString() || '',
      完成日期: item.completionDate?.toISOString() || '',
      创建时间: item.createdAt?.toISOString() || '',
      备注: item.remarks || '',
    }));
  }

  /**
   * 导出为Excel文件
   *
   * @param shipments 厂家发货数据
   * @param filename 文件名
   */
  static exportToExcel(
    shipments: FactoryShipmentOrder[],
    filename: string
  ): void {
    const data = this.prepareExportData(shipments);

    EnhancedExcelExportService.exportToEnhancedExcel(data, {
      filename,
      sheetName: '厂家发货',
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
      freezeHeader: true,
      dateFormat: 'yyyy-MM-dd HH:mm:ss',
    });
  }

  /**
   * 导出为CSV文件
   *
   * @param shipments 厂家发货数据
   * @param filename 文件名
   */
  static exportToCSV(
    shipments: FactoryShipmentOrder[],
    filename: string
  ): void {
    const data = this.prepareExportData(shipments);

    CSVExportService.exportToCSV(data, {
      filename,
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
      dateFormat: 'yyyy-MM-dd HH:mm:ss',
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
      '厂家发货',
      filterSummary,
      userName
    );
  }
}
