import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import {
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';

/**
 * 格式化金额 - 使用人民币符号和千分位分隔符
 * ✅ 支持处理 Prisma Decimal 类型
 */
export const formatAmount = (amount: number | unknown): string => {
  // 确保转换为 JavaScript number 类型（处理 Prisma Decimal）
  const numAmount = Number(amount);
  if (isNaN(numAmount)) {
    return '￥0.00';
  }
  return `￥${numAmount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * 格式化日期 - 统一使用 YYYY-MM-DD 格式
 */
export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy-MM-dd', { locale: zhCN });
};

/**
 * 格式化日期时间 - 包含时分 YYYY-MM-DD HH:mm
 */
export const formatDateTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy-MM-dd HH:mm', { locale: zhCN });
};

/**
 * 单位中英文映射
 */
const UNIT_MAP: Record<string, string> = {
  piece: '件',
  box: '箱',
  pcs: '个',
  kg: '千克',
  g: '克',
  ton: '吨',
  m: '米',
  cm: '厘米',
  mm: '毫米',
  sqm: '平方米',
  cbm: '立方米',
  set: '套',
  pair: '对',
  dozen: '打',
  pack: '包',
  bag: '袋',
  bottle: '瓶',
  can: '罐',
  roll: '卷',
  sheet: '张',
};

/**
 * 格式化单位 - 将英文单位转换为中文
 */
export const formatUnit = (unit: string): string =>
  UNIT_MAP[unit.toLowerCase()] || unit;

/**
 * 获取厂家发货订单状态徽章样式
 */
export const getFactoryShipmentStatusBadgeVariant = (
  status: FactoryShipmentStatus
):
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info' => {
  switch (status) {
    case 'draft':
      return 'outline';
    case 'confirmed':
      return 'success';
    case 'pending_shipment':
      return 'warning';
    case 'shipped':
    case 'in_transit':
      return 'info';
    case 'arrived':
      return 'success';
    case 'cancelled':
      return 'destructive';
    default:
      return 'secondary';
  }
};

/**
 * 获取运输查询状态徽章样式
 * 根据查询状态返回不同的徽章颜色
 *
 * 颜色规则：
 * - 绿色 (success): 已到港、已送达、已签收等完成状态
 * - 蓝色 (info): 运输中、在途、锚泊、靠泊等进行中状态
 * - 红色 (destructive): 失败、错误、异常等错误状态
 * - 黄色 (warning): 等待、待处理等待状态
 * - 灰色 (secondary): 其他未分类状态
 */
export const getShippingQueryStatusVariant = (
  status: string
):
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info' => {
  const statusLower = status.toLowerCase();

  // 已到港/完成状态 - 绿色
  if (
    statusLower.includes('已到港') ||
    statusLower.includes('到港') ||
    statusLower.includes('已送达') ||
    statusLower.includes('已签收') ||
    statusLower.includes('已完成') ||
    statusLower.includes('完成') ||
    statusLower.includes('delivered') ||
    statusLower.includes('arrived') ||
    statusLower.includes('success')
  ) {
    return 'success';
  }

  // 失败/异常状态 - 红色
  if (
    statusLower.includes('失败') ||
    statusLower.includes('错误') ||
    statusLower.includes('异常') ||
    statusLower.includes('failed') ||
    statusLower.includes('error')
  ) {
    return 'destructive';
  }

  // 运输中/进行中状态 - 蓝色
  // 包括：运输中、在途、锚泊、靠泊、派送中等
  if (
    statusLower.includes('运输中') ||
    statusLower.includes('在途') ||
    statusLower.includes('锚泊') ||
    statusLower.includes('靠泊') ||
    statusLower.includes('派送中') ||
    statusLower.includes('状态') || // 通用"状态"字段，表示有状态更新
    statusLower.includes('transit') ||
    statusLower.includes('shipping') ||
    statusLower.includes('delivering') ||
    statusLower.includes('anchored') ||
    statusLower.includes('berthed')
  ) {
    return 'info';
  }

  // 等待/待处理状态 - 黄色
  if (
    statusLower.includes('等待') ||
    statusLower.includes('待') ||
    statusLower.includes('pending') ||
    statusLower.includes('waiting')
  ) {
    return 'warning';
  }

  // 默认 - 灰色
  return 'secondary';
};

/**
 * 判断是否可以确认发货
 */
export const canConfirmShipment = (status: FactoryShipmentStatus): boolean => {
  const allowedStatuses: FactoryShipmentStatus[] = [
    FACTORY_SHIPMENT_STATUS.DRAFT,
    FACTORY_SHIPMENT_STATUS.CONFIRMED,
    FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT,
  ];
  return allowedStatuses.includes(status);
};

/**
 * 判断是否可以确认到港
 */
export const canConfirmArrival = (status: FactoryShipmentStatus): boolean => {
  const allowedStatuses: FactoryShipmentStatus[] = [
    FACTORY_SHIPMENT_STATUS.SHIPPED,
    FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
  ];
  return allowedStatuses.includes(status);
};

/**
 * 判断是否可以取消订单
 * 只有草稿、已确认、待发货状态的订单可以取消
 */
export const canCancelOrder = (status: FactoryShipmentStatus): boolean => {
  const allowedStatuses: FactoryShipmentStatus[] = [
    FACTORY_SHIPMENT_STATUS.DRAFT,
    FACTORY_SHIPMENT_STATUS.CONFIRMED,
    FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT,
  ];
  return allowedStatuses.includes(status);
};

/**
 * 判断是否可以删除订单
 */
export const canDeleteOrder = (status: FactoryShipmentStatus): boolean => {
  const allowedStatuses: FactoryShipmentStatus[] = [
    FACTORY_SHIPMENT_STATUS.DRAFT,
    FACTORY_SHIPMENT_STATUS.CANCELLED,
  ];
  return allowedStatuses.includes(status);
};
