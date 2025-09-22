// 厂家发货相关类型定义
// 遵循 TypeScript 严格模式，禁用 any 类型

// 厂家发货订单状态枚举
export const FACTORY_SHIPMENT_STATUS = {
  DRAFT: 'draft',                    // 草稿（用户报货）
  PLANNING: 'planning',              // 计划中（我们做计划）
  WAITING_DEPOSIT: 'waiting_deposit', // 待定金（等待用户交定金）
  DEPOSIT_PAID: 'deposit_paid',      // 已付定金（定金已收）
  FACTORY_SHIPPED: 'factory_shipped', // 工厂发货（确认发货）
  IN_TRANSIT: 'in_transit',          // 运输中（集装箱到港前）
  ARRIVED: 'arrived',                // 到港（集装箱到港）
  DELIVERED: 'delivered',            // 已收货（确认用户收货）
  COMPLETED: 'completed',            // 已完成（货款付完）
} as const;

export type FactoryShipmentStatus = typeof FACTORY_SHIPMENT_STATUS[keyof typeof FACTORY_SHIPMENT_STATUS];

// 厂家发货订单状态标签
export const FACTORY_SHIPMENT_STATUS_LABELS: Record<FactoryShipmentStatus, string> = {
  [FACTORY_SHIPMENT_STATUS.DRAFT]: '草稿',
  [FACTORY_SHIPMENT_STATUS.PLANNING]: '计划中',
  [FACTORY_SHIPMENT_STATUS.WAITING_DEPOSIT]: '待定金',
  [FACTORY_SHIPMENT_STATUS.DEPOSIT_PAID]: '已付定金',
  [FACTORY_SHIPMENT_STATUS.FACTORY_SHIPPED]: '工厂发货',
  [FACTORY_SHIPMENT_STATUS.IN_TRANSIT]: '运输中',
  [FACTORY_SHIPMENT_STATUS.ARRIVED]: '到港',
  [FACTORY_SHIPMENT_STATUS.DELIVERED]: '已收货',
  [FACTORY_SHIPMENT_STATUS.COMPLETED]: '已完成',
};

// 厂家发货订单明细项
export interface FactoryShipmentOrderItem {
  id: string;
  factoryShipmentOrderId: string;
  productId?: string;
  supplierId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  
  // 手动输入商品信息（临时商品）
  isManualProduct?: boolean;
  manualProductName?: string;
  manualSpecification?: string;
  manualWeight?: number;
  manualUnit?: string;
  
  // 通用显示字段
  displayName: string;
  specification?: string;
  unit: string;
  weight?: number;
  
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // 关联数据
  product?: {
    id: string;
    code: string;
    name: string;
    specification?: string;
    unit: string;
    weight?: number;
  };
  supplier: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
  };
}

// 厂家发货订单
export interface FactoryShipmentOrder {
  id: string;
  orderNumber: string;
  containerNumber: string;
  customerId: string;
  userId: string;
  status: FactoryShipmentStatus;
  totalAmount: number;
  receivableAmount: number;
  depositAmount: number;
  paidAmount: number;
  remarks?: string;
  planDate?: Date;
  shipmentDate?: Date;
  arrivalDate?: Date;
  deliveryDate?: Date;
  completionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // 关联数据
  customer: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  items: FactoryShipmentOrderItem[];
}

// 创建厂家发货订单的输入数据
export interface CreateFactoryShipmentOrderData {
  containerNumber: string;
  customerId: string;
  status?: FactoryShipmentStatus;
  totalAmount?: number;
  receivableAmount?: number;
  depositAmount?: number;
  remarks?: string;
  planDate?: Date;
  items: CreateFactoryShipmentOrderItemData[];
}

// 创建厂家发货订单明细的输入数据
export interface CreateFactoryShipmentOrderItemData {
  productId?: string;
  supplierId: string;
  quantity: number;
  unitPrice: number;
  
  // 手动输入商品信息（临时商品）
  isManualProduct?: boolean;
  manualProductName?: string;
  manualSpecification?: string;
  manualWeight?: number;
  manualUnit?: string;
  
  // 通用显示字段
  displayName: string;
  specification?: string;
  unit: string;
  weight?: number;
  
  remarks?: string;
}

// 更新厂家发货订单的输入数据
export interface UpdateFactoryShipmentOrderData {
  containerNumber?: string;
  customerId?: string;
  status?: FactoryShipmentStatus;
  totalAmount?: number;
  receivableAmount?: number;
  depositAmount?: number;
  paidAmount?: number;
  remarks?: string;
  planDate?: Date;
  shipmentDate?: Date;
  arrivalDate?: Date;
  deliveryDate?: Date;
  completionDate?: Date;
  items?: CreateFactoryShipmentOrderItemData[];
}

// 厂家发货订单列表查询参数
export interface FactoryShipmentOrderListParams {
  page?: number;
  pageSize?: number;
  status?: FactoryShipmentStatus;
  customerId?: string;
  containerNumber?: string;
  orderNumber?: string;
  startDate?: Date;
  endDate?: Date;
}

// 厂家发货订单统计数据
export interface FactoryShipmentOrderStats {
  totalOrders: number;
  totalAmount: number;
  totalReceivable: number;
  totalPaid: number;
  statusCounts: Record<FactoryShipmentStatus, number>;
}
