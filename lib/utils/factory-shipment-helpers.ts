import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import {
  FACTORY_SHIPMENT_ITEM_OWNERSHIP,
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentItemOwnership,
  type FactoryShipmentOrder,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';

/**
 * 格式化金额 - 使用人民币符号和千分位分隔符
 */
export const formatAmount = (amount: number): string =>
  `￥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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
 * 厂家发货产品归属标签映射
 */
export const FACTORY_SHIPMENT_OWNERSHIP_LABELS: Record<
  FactoryShipmentItemOwnership,
  string
> = {
  [FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER]: '客户货',
  [FACTORY_SHIPMENT_ITEM_OWNERSHIP.SELF]: '自用补货',
};

/**
 * 格式化产品归属状态
 */
export const formatOwnershipStatus = (
  item: FactoryShipmentOrder['items'][number]
): { label: string; variant: 'secondary' | 'info' | 'success' | 'warning' } => {
  if (item.ownership === FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER) {
    return item.customerDeliveryStatus === 'delivered'
      ? { label: '已交付', variant: 'success' }
      : { label: '待交付', variant: 'warning' };
  }
  return item.selfInboundStatus === 'received'
    ? { label: '已入库', variant: 'success' }
    : { label: '待入库', variant: 'secondary' };
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
 * 判断是否可以确认自用货入库
 */
export const canConfirmInbound = (
  status: FactoryShipmentStatus,
  hasPendingSelfInbound: boolean
): boolean => {
  if (!hasPendingSelfInbound) {
    return false;
  }
  const allowedStatuses: FactoryShipmentStatus[] = [
    FACTORY_SHIPMENT_STATUS.ARRIVED,
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
