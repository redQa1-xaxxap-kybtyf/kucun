// 采购订单类型定义
// 严格遵循全栈项目统一约定规范：数据库 snake_case → API camelCase → 前端 camelCase

import { Product } from './product'
import { User } from './user'

// 采购订单状态枚举
export type PurchaseOrderStatus = 'draft' | 'confirmed' | 'received' | 'completed' | 'cancelled'

// 采购订单状态标签映射
export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: '草稿',
  confirmed: '已确认',
  received: '已收货',
  completed: '已完成',
  cancelled: '已取消'
}

// 采购订单状态变体映射（用于UI组件）
export const PURCHASE_ORDER_STATUS_VARIANTS: Record<PurchaseOrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  confirmed: 'secondary',
  received: 'default',
  completed: 'default',
  cancelled: 'destructive'
}

// 采购订单状态颜色映射
export const PURCHASE_ORDER_STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  draft: 'text-gray-600',
  confirmed: 'text-blue-600',
  received: 'text-orange-600',
  completed: 'text-green-600',
  cancelled: 'text-red-600'
}

// 供应商信息接口（简化版，实际应该有独立的供应商管理模块）
export interface Supplier {
  id: string
  name: string
  contactPerson?: string
  phone?: string
  address?: string
  email?: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

// 采购订单明细接口
export interface PurchaseOrderItem {
  id: string
  purchaseOrderId: string
  productId: string
  colorCode?: string
  productionDate?: string
  quantity: number
  unitPrice: number
  subtotal: number
  
  // 关联数据
  product?: Product
}

// 采购订单主表接口
export interface PurchaseOrder {
  id: string
  orderNumber: string
  supplierId: string
  userId: string
  status: PurchaseOrderStatus
  totalAmount: number
  expectedDeliveryDate?: string
  actualDeliveryDate?: string
  remarks?: string
  createdAt: string
  updatedAt: string
  
  // 关联数据
  supplier?: Supplier
  user?: User
  items?: PurchaseOrderItem[]
}

// 采购订单查询参数
export interface PurchaseOrderQueryParams {
  page?: number
  limit?: number
  search?: string
  status?: PurchaseOrderStatus
  supplierId?: string
  userId?: string
  startDate?: string
  endDate?: string
  sortBy?: 'createdAt' | 'orderNumber' | 'totalAmount' | 'expectedDeliveryDate'
  sortOrder?: 'asc' | 'desc'
}

// 采购订单明细查询参数
export interface PurchaseOrderItemQueryParams {
  purchaseOrderId?: string
  productId?: string
  colorCode?: string
  productionDate?: string
}

// 采购订单创建输入类型
export interface PurchaseOrderCreateInput {
  supplierId: string
  expectedDeliveryDate?: string
  remarks?: string
  items: PurchaseOrderItemCreateInput[]
}

// 采购订单明细创建输入类型
export interface PurchaseOrderItemCreateInput {
  productId: string
  colorCode?: string
  productionDate?: string
  quantity: number
  unitPrice: number
}

// 采购订单更新输入类型
export interface PurchaseOrderUpdateInput {
  supplierId?: string
  status?: PurchaseOrderStatus
  expectedDeliveryDate?: string
  actualDeliveryDate?: string
  remarks?: string
  items?: PurchaseOrderItemUpdateInput[]
}

// 采购订单明细更新输入类型
export interface PurchaseOrderItemUpdateInput {
  id?: string
  productId: string
  colorCode?: string
  productionDate?: string
  quantity: number
  unitPrice: number
}

// API 响应类型
export interface PurchaseOrderResponse {
  success: boolean
  data: PurchaseOrder
  message?: string
}

export interface PurchaseOrderListResponse {
  success: boolean
  data: {
    purchaseOrders: PurchaseOrder[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  message?: string
}

export interface PurchaseOrderItemResponse {
  success: boolean
  data: PurchaseOrderItem
  message?: string
}

export interface PurchaseOrderItemListResponse {
  success: boolean
  data: {
    items: PurchaseOrderItem[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  message?: string
}

// 采购订单统计信息
export interface PurchaseOrderStats {
  totalOrders: number
  totalAmount: number
  draftCount: number
  confirmedCount: number
  receivedCount: number
  completedCount: number
  cancelledCount: number
  overdueCount: number
}

export interface PurchaseOrderStatsResponse {
  success: boolean
  data: PurchaseOrderStats
  message?: string
}

// 排序选项
export const PURCHASE_ORDER_SORT_OPTIONS = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'orderNumber', label: '订单号' },
  { value: 'totalAmount', label: '订单金额' },
  { value: 'expectedDeliveryDate', label: '预期交货日期' }
] as const

// 默认分页大小
export const DEFAULT_PAGE_SIZE = 20

// 采购订单状态流转规则
export const PURCHASE_ORDER_STATUS_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['received', 'cancelled'],
  received: ['completed'],
  completed: [],
  cancelled: []
}

// 检查状态流转是否有效
export function isValidStatusTransition(from: PurchaseOrderStatus, to: PurchaseOrderStatus): boolean {
  return PURCHASE_ORDER_STATUS_TRANSITIONS[from].includes(to)
}

// 获取采购订单状态信息
export function getPurchaseOrderStatus(order: PurchaseOrder) {
  const status = order.status
  const label = PURCHASE_ORDER_STATUS_LABELS[status]
  const variant = PURCHASE_ORDER_STATUS_VARIANTS[status]
  const color = PURCHASE_ORDER_STATUS_COLORS[status]
  
  // 检查是否逾期
  const isOverdue = status === 'confirmed' && 
    order.expectedDeliveryDate && 
    new Date(order.expectedDeliveryDate) < new Date()
  
  return {
    status,
    label: isOverdue ? `${label}（逾期）` : label,
    variant: isOverdue ? 'destructive' as const : variant,
    color: isOverdue ? 'text-red-600' : color,
    isOverdue
  }
}

// 计算采购订单总金额
export function calculatePurchaseOrderTotal(items: PurchaseOrderItem[]): number {
  return items.reduce((total, item) => total + item.subtotal, 0)
}

// 计算采购订单明细小计
export function calculatePurchaseOrderItemSubtotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

// 格式化采购订单金额
export function formatPurchaseOrderAmount(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// 格式化交货日期
export function formatDeliveryDate(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN')
}

// 生成采购订单号
export function generatePurchaseOrderNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const timestamp = now.getTime().toString().slice(-6)
  
  return `PO${year}${month}${day}${timestamp}`
}

// 常用色号选项（瓷砖行业）
export const COMMON_COLOR_CODES = [
  { value: 'A001', label: 'A001 - 白色' },
  { value: 'A002', label: 'A002 - 米白' },
  { value: 'A003', label: 'A003 - 浅灰' },
  { value: 'A004', label: 'A004 - 深灰' },
  { value: 'A005', label: 'A005 - 黑色' },
  { value: 'B001', label: 'B001 - 浅木纹' },
  { value: 'B002', label: 'B002 - 深木纹' },
  { value: 'C001', label: 'C001 - 米黄' },
  { value: 'C002', label: 'C002 - 咖啡' },
  { value: 'D001', label: 'D001 - 蓝色' }
] as const

// 采购订单明细验证
export function validatePurchaseOrderItem(item: PurchaseOrderItemCreateInput | PurchaseOrderItemUpdateInput): string[] {
  const errors: string[] = []
  
  if (!item.productId) {
    errors.push('请选择产品')
  }
  
  if (!item.quantity || item.quantity <= 0) {
    errors.push('数量必须大于0')
  }
  
  if (!item.unitPrice || item.unitPrice <= 0) {
    errors.push('单价必须大于0')
  }
  
  if (item.quantity && item.quantity > 999999) {
    errors.push('数量不能超过999999')
  }
  
  if (item.unitPrice && item.unitPrice > 999999.99) {
    errors.push('单价不能超过999999.99')
  }
  
  return errors
}

// 采购订单验证
export function validatePurchaseOrder(order: PurchaseOrderCreateInput | PurchaseOrderUpdateInput): string[] {
  const errors: string[] = []
  
  if ('supplierId' in order && !order.supplierId) {
    errors.push('请选择供应商')
  }
  
  if ('items' in order && (!order.items || order.items.length === 0)) {
    errors.push('至少需要添加一个采购明细')
  }
  
  if ('items' in order && order.items) {
    order.items.forEach((item, index) => {
      const itemErrors = validatePurchaseOrderItem(item)
      itemErrors.forEach(error => {
        errors.push(`第${index + 1}行：${error}`)
      })
    })
  }
  
  return errors
}
