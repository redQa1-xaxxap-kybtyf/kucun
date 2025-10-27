/**
 * 运输追踪相关类型定义
 */

/**
 * 运输追踪查询结果
 * 对应系统设置中的运输查询功能返回的数据
 */
export interface ShippingTrackingRecord {
  /** 查询时间 */
  queryTime: Date | string;

  /** 站点 - 船运公司名称 */
  site: string;

  /** 追踪单号 - 集装箱号 */
  trackingNumber: string;

  /** 状态 - 运输状态 */
  status: ShippingStatus;

  /** 目的地 */
  destination?: string;

  /** 预到时间 - 预计到达时间 */
  estimatedArrival?: Date | string;

  /** 更新时间 - 最后更新时间 */
  updateTime: Date | string;

  /** 查询结果 - 详细信息 */
  result?: string;
}

/**
 * 运输状态枚举
 */
export const SHIPPING_STATUS = {
  /** 在途/运输中 */
  IN_TRANSIT: 'in_transit',
  /** 已到港 */
  ARRIVED: 'arrived',
  /** 未查询到 */
  NOT_FOUND: 'not_found',
  /** 查询失败 */
  QUERY_FAILED: 'query_failed',
} as const;

export type ShippingStatus =
  (typeof SHIPPING_STATUS)[keyof typeof SHIPPING_STATUS];

/**
 * 运输状态中文标签
 */
export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  [SHIPPING_STATUS.IN_TRANSIT]: '运输中',
  [SHIPPING_STATUS.ARRIVED]: '已到港',
  [SHIPPING_STATUS.NOT_FOUND]: '未查询到',
  [SHIPPING_STATUS.QUERY_FAILED]: '查询失败',
};

/**
 * 运输查询请求参数
 */
export interface ShippingTrackingQuery {
  /** 站点 - 船运公司名称 */
  site: string;

  /** 追踪单号 - 集装箱号 */
  trackingNumber: string;
}

/**
 * 运输查询响应
 */
export interface ShippingTrackingResponse {
  success: boolean;
  data?: ShippingTrackingRecord;
  error?: string;
}

/**
 * 映射运输状态到厂家发货订单状态
 */
export function mapShippingStatusToOrderStatus(
  shippingStatus: ShippingStatus
): 'shipped' | 'in_transit' | 'arrived' | null {
  switch (shippingStatus) {
    case SHIPPING_STATUS.IN_TRANSIT:
      return 'in_transit';
    case SHIPPING_STATUS.ARRIVED:
      return 'arrived';
    case SHIPPING_STATUS.NOT_FOUND:
    case SHIPPING_STATUS.QUERY_FAILED:
      return null; // 保持原状态
    default:
      return null;
  }
}
