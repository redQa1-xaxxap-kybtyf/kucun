import type { TemplateType } from './schemas';

export interface TemplateTypeMeta {
  label: string;
  shortLabel: string;
  description: string;
  supportsRealPreview: boolean;
  realDataLabel: string;
  recentDocumentLabel: string;
}

export const TEMPLATE_TYPE_META: Record<TemplateType, TemplateTypeMeta> = {
  'sales-order': {
    label: '销售订单',
    shortLabel: '销售',
    description: '适合客户下单、送货、结算场景',
    supportsRealPreview: true,
    realDataLabel: '真实销售单',
    recentDocumentLabel: '最近销售单',
  },
  'purchase-order': {
    label: '采购订单',
    shortLabel: '采购',
    description: '适合采购下单、跟柜、到货单据',
    supportsRealPreview: true,
    realDataLabel: '真实采购单',
    recentDocumentLabel: '最近采购单',
  },
  'factory-shipment': {
    label: '厂家发货',
    shortLabel: '发货',
    description: '适合厂家发货、海运/陆运跟踪',
    supportsRealPreview: true,
    realDataLabel: '真实发货单',
    recentDocumentLabel: '最近发货单',
  },
  'delivery-note': {
    label: '发货单',
    shortLabel: '发货',
    description: '适合仓库出货、司机随货单据',
    supportsRealPreview: false,
    realDataLabel: '真实发货单',
    recentDocumentLabel: '最近发货单',
  },
  'inbound-record': {
    label: '仓库进货（入库记录）',
    shortLabel: '入库',
    description: '适合单笔入库、收货留档',
    supportsRealPreview: true,
    realDataLabel: '真实入库单',
    recentDocumentLabel: '最近入库单',
  },
  'return-order': {
    label: '退货订单',
    shortLabel: '退货',
    description: '适合退货、退款和售后处理',
    supportsRealPreview: true,
    realDataLabel: '真实退货单',
    recentDocumentLabel: '最近退货单',
  },
  custom: {
    label: '自定义',
    shortLabel: '自定义',
    description: '自由排版模板，建议先用模拟数据调版式',
    supportsRealPreview: false,
    realDataLabel: '真实单据',
    recentDocumentLabel: '最近单据',
  },
};

export function getTemplateTypeLabel(type: string): string {
  return TEMPLATE_TYPE_META[type as TemplateType]?.label ?? type;
}

export function getTemplateTypeMeta(type: string): TemplateTypeMeta | null {
  return TEMPLATE_TYPE_META[type as TemplateType] ?? null;
}
