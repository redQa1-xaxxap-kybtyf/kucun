import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  shipping: '运费',
  storage: '仓储费',
  customs: '关税',
  other: '其他费用',
};

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '-';
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const STATUS_CONFIG: Record<
  PurchaseOrderStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  [PURCHASE_ORDER_STATUS.DRAFT]: { label: '草稿', variant: 'secondary' },
  [PURCHASE_ORDER_STATUS.ORDERED]: { label: '已下单', variant: 'default' },
  [PURCHASE_ORDER_STATUS.SHIPPED]: { label: '已发货', variant: 'default' },
  [PURCHASE_ORDER_STATUS.IN_TRANSIT]: { label: '运输中', variant: 'default' },
  [PURCHASE_ORDER_STATUS.ARRIVED]: { label: '已到货', variant: 'default' },
  [PURCHASE_ORDER_STATUS.COMPLETED]: { label: '已完成', variant: 'default' },
  [PURCHASE_ORDER_STATUS.CANCELLED]: {
    label: '已取消',
    variant: 'destructive',
  },
};

export const STATUS_FLOW: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  [PURCHASE_ORDER_STATUS.DRAFT]: [
    PURCHASE_ORDER_STATUS.ORDERED,
    PURCHASE_ORDER_STATUS.CANCELLED,
  ],
  [PURCHASE_ORDER_STATUS.ORDERED]: [
    PURCHASE_ORDER_STATUS.SHIPPED,
    PURCHASE_ORDER_STATUS.CANCELLED,
  ],
  [PURCHASE_ORDER_STATUS.SHIPPED]: [PURCHASE_ORDER_STATUS.IN_TRANSIT],
  [PURCHASE_ORDER_STATUS.IN_TRANSIT]: [PURCHASE_ORDER_STATUS.ARRIVED],
  [PURCHASE_ORDER_STATUS.ARRIVED]: [PURCHASE_ORDER_STATUS.COMPLETED],
  [PURCHASE_ORDER_STATUS.COMPLETED]: [],
  [PURCHASE_ORDER_STATUS.CANCELLED]: [],
};

export const STATUS_ACTION_LABELS: Record<PurchaseOrderStatus, string> = {
  [PURCHASE_ORDER_STATUS.DRAFT]: '保存草稿',
  [PURCHASE_ORDER_STATUS.ORDERED]: '提交订单',
  [PURCHASE_ORDER_STATUS.SHIPPED]: '标记已发货',
  [PURCHASE_ORDER_STATUS.IN_TRANSIT]: '标记在途',
  [PURCHASE_ORDER_STATUS.ARRIVED]: '标记已到货',
  [PURCHASE_ORDER_STATUS.COMPLETED]: '完成订单',
  [PURCHASE_ORDER_STATUS.CANCELLED]: '取消订单',
};
