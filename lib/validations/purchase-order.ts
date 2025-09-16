// 采购订单表单验证规则
// 使用 Zod 进行严格的类型验证和数据校验

import { z } from 'zod'
import { PurchaseOrderStatus } from '@/lib/types/purchase-order'

// 采购订单明细验证规则
export const purchaseOrderItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, '请选择产品'),
  colorCode: z.string().optional(),
  productionDate: z.string().optional(),
  quantity: z.number()
    .min(1, '数量必须大于0')
    .max(999999, '数量不能超过999999')
    .int('数量必须为整数'),
  unitPrice: z.number()
    .min(0.01, '单价必须大于0')
    .max(999999.99, '单价不能超过999999.99')
})

// 采购订单创建验证规则
export const purchaseOrderCreateSchema = z.object({
  supplierId: z.string().min(1, '请选择供应商'),
  expectedDeliveryDate: z.string().optional(),
  remarks: z.string().max(500, '备注不能超过500字符').optional(),
  items: z.array(purchaseOrderItemSchema)
    .min(1, '至少需要添加一个采购明细')
    .max(100, '采购明细不能超过100行')
}).refine((data) => {
  // 验证明细项目的产品不能重复（相同产品、色号、生产日期）
  const itemKeys = data.items.map(item => 
    `${item.productId}-${item.colorCode || ''}-${item.productionDate || ''}`
  )
  const uniqueKeys = new Set(itemKeys)
  return uniqueKeys.size === itemKeys.length
}, {
  message: '采购明细中存在重复的产品规格',
  path: ['items']
})

// 采购订单更新验证规则
export const purchaseOrderUpdateSchema = z.object({
  supplierId: z.string().min(1, '请选择供应商').optional(),
  status: z.enum(['draft', 'confirmed', 'received', 'completed', 'cancelled'] as const).optional(),
  expectedDeliveryDate: z.string().optional(),
  actualDeliveryDate: z.string().optional(),
  remarks: z.string().max(500, '备注不能超过500字符').optional(),
  items: z.array(purchaseOrderItemSchema)
    .min(1, '至少需要添加一个采购明细')
    .max(100, '采购明细不能超过100行')
    .optional()
}).refine((data) => {
  // 如果有明细项目，验证不能重复
  if (data.items) {
    const itemKeys = data.items.map(item => 
      `${item.productId}-${item.colorCode || ''}-${item.productionDate || ''}`
    )
    const uniqueKeys = new Set(itemKeys)
    return uniqueKeys.size === itemKeys.length
  }
  return true
}, {
  message: '采购明细中存在重复的产品规格',
  path: ['items']
})

// 采购订单搜索验证规则
export const purchaseOrderSearchSchema = z.object({
  search: z.string().max(100, '搜索关键词不能超过100字符').optional(),
  status: z.enum(['draft', 'confirmed', 'received', 'completed', 'cancelled'] as const).optional(),
  supplierId: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(['createdAt', 'orderNumber', 'totalAmount', 'expectedDeliveryDate'] as const).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc'] as const).default('desc')
}).refine((data) => {
  // 验证日期范围
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate)
  }
  return true
}, {
  message: '开始日期不能晚于结束日期',
  path: ['endDate']
})

// 采购订单状态更新验证规则
export const purchaseOrderStatusUpdateSchema = z.object({
  status: z.enum(['draft', 'confirmed', 'received', 'completed', 'cancelled'] as const),
  actualDeliveryDate: z.string().optional(),
  remarks: z.string().max(500, '备注不能超过500字符').optional()
}).refine((data) => {
  // 如果状态是已收货或已完成，必须填写实际交货日期
  if ((data.status === 'received' || data.status === 'completed') && !data.actualDeliveryDate) {
    return false
  }
  return true
}, {
  message: '收货或完成时必须填写实际交货日期',
  path: ['actualDeliveryDate']
})

// 供应商创建验证规则（简化版）
export const supplierCreateSchema = z.object({
  name: z.string().min(1, '供应商名称不能为空').max(100, '供应商名称不能超过100字符'),
  contactPerson: z.string().max(50, '联系人姓名不能超过50字符').optional(),
  phone: z.string()
    .regex(/^1[3-9]\d{9}$/, '请输入正确的手机号码')
    .optional(),
  email: z.string()
    .email('请输入正确的邮箱地址')
    .optional(),
  address: z.string().max(200, '地址不能超过200字符').optional()
})

// 供应商更新验证规则
export const supplierUpdateSchema = z.object({
  name: z.string().min(1, '供应商名称不能为空').max(100, '供应商名称不能超过100字符').optional(),
  contactPerson: z.string().max(50, '联系人姓名不能超过50字符').optional(),
  phone: z.string()
    .regex(/^1[3-9]\d{9}$/, '请输入正确的手机号码')
    .optional(),
  email: z.string()
    .email('请输入正确的邮箱地址')
    .optional(),
  address: z.string().max(200, '地址不能超过200字符').optional(),
  status: z.enum(['active', 'inactive'] as const).optional()
})

// 采购订单明细单项验证规则
export const purchaseOrderItemCreateSchema = z.object({
  productId: z.string().min(1, '请选择产品'),
  colorCode: z.string().max(20, '色号不能超过20字符').optional(),
  productionDate: z.string().optional(),
  quantity: z.number()
    .min(1, '数量必须大于0')
    .max(999999, '数量不能超过999999')
    .int('数量必须为整数'),
  unitPrice: z.number()
    .min(0.01, '单价必须大于0')
    .max(999999.99, '单价不能超过999999.99')
})

// 批量操作验证规则
export const purchaseOrderBatchOperationSchema = z.object({
  orderIds: z.array(z.string()).min(1, '请选择要操作的订单'),
  operation: z.enum(['confirm', 'cancel', 'delete'] as const),
  reason: z.string().max(200, '操作原因不能超过200字符').optional()
})

// 表单数据类型推断
export type PurchaseOrderCreateFormData = z.infer<typeof purchaseOrderCreateSchema>
export type PurchaseOrderUpdateFormData = z.infer<typeof purchaseOrderUpdateSchema>
export type PurchaseOrderSearchFormData = z.infer<typeof purchaseOrderSearchSchema>
export type PurchaseOrderStatusUpdateFormData = z.infer<typeof purchaseOrderStatusUpdateSchema>
export type PurchaseOrderItemFormData = z.infer<typeof purchaseOrderItemSchema>
export type PurchaseOrderItemCreateFormData = z.infer<typeof purchaseOrderItemCreateSchema>
export type SupplierCreateFormData = z.infer<typeof supplierCreateSchema>
export type SupplierUpdateFormData = z.infer<typeof supplierUpdateSchema>
export type PurchaseOrderBatchOperationFormData = z.infer<typeof purchaseOrderBatchOperationSchema>

// 表单默认值
export const purchaseOrderCreateDefaults: PurchaseOrderCreateFormData = {
  supplierId: '',
  expectedDeliveryDate: '',
  remarks: '',
  items: []
}

export const purchaseOrderUpdateDefaults: Partial<PurchaseOrderUpdateFormData> = {
  supplierId: '',
  status: 'draft',
  expectedDeliveryDate: '',
  actualDeliveryDate: '',
  remarks: '',
  items: []
}

export const purchaseOrderSearchDefaults: PurchaseOrderSearchFormData = {
  search: '',
  status: undefined,
  supplierId: '',
  userId: '',
  startDate: '',
  endDate: '',
  sortBy: 'createdAt',
  sortOrder: 'desc'
}

export const purchaseOrderItemDefaults: PurchaseOrderItemFormData = {
  productId: '',
  colorCode: '',
  productionDate: '',
  quantity: 1,
  unitPrice: 0
}

export const supplierCreateDefaults: SupplierCreateFormData = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: ''
}

// 验证辅助函数
export function validatePurchaseOrderItems(items: PurchaseOrderItemFormData[]): string[] {
  const errors: string[] = []
  
  if (items.length === 0) {
    errors.push('至少需要添加一个采购明细')
    return errors
  }
  
  // 检查重复项目
  const itemKeys = items.map((item, index) => ({
    key: `${item.productId}-${item.colorCode || ''}-${item.productionDate || ''}`,
    index
  }))
  
  const duplicates = itemKeys.filter((item, index) => 
    itemKeys.findIndex(other => other.key === item.key) !== index
  )
  
  if (duplicates.length > 0) {
    duplicates.forEach(duplicate => {
      errors.push(`第${duplicate.index + 1}行：存在重复的产品规格`)
    })
  }
  
  // 验证每个明细项目
  items.forEach((item, index) => {
    if (!item.productId) {
      errors.push(`第${index + 1}行：请选择产品`)
    }
    
    if (!item.quantity || item.quantity <= 0) {
      errors.push(`第${index + 1}行：数量必须大于0`)
    }
    
    if (!item.unitPrice || item.unitPrice <= 0) {
      errors.push(`第${index + 1}行：单价必须大于0`)
    }
    
    if (item.quantity > 999999) {
      errors.push(`第${index + 1}行：数量不能超过999999`)
    }
    
    if (item.unitPrice > 999999.99) {
      errors.push(`第${index + 1}行：单价不能超过999999.99`)
    }
  })
  
  return errors
}

// 计算采购订单总金额
export function calculateOrderTotal(items: PurchaseOrderItemFormData[]): number {
  return items.reduce((total, item) => {
    const subtotal = (item.quantity || 0) * (item.unitPrice || 0)
    return total + subtotal
  }, 0)
}

// 验证状态流转
export function validateStatusTransition(fromStatus: PurchaseOrderStatus, toStatus: PurchaseOrderStatus): boolean {
  const validTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
    draft: ['confirmed', 'cancelled'],
    confirmed: ['received', 'cancelled'],
    received: ['completed'],
    completed: [],
    cancelled: []
  }
  
  return validTransitions[fromStatus].includes(toStatus)
}

// 验证日期范围
export function validateDateRange(startDate?: string, endDate?: string): boolean {
  if (!startDate || !endDate) return true
  return new Date(startDate) <= new Date(endDate)
}

// 格式化验证错误信息
export function formatValidationErrors(errors: z.ZodError): Record<string, string> {
  const formattedErrors: Record<string, string> = {}
  
  errors.errors.forEach(error => {
    const path = error.path.join('.')
    formattedErrors[path] = error.message
  })
  
  return formattedErrors
}
