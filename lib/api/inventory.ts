// 库存管理 API 客户端
// 使用 TanStack Query 进行服务器状态管理
// 遵循命名约定：API响应 camelCase

import { 
  Inventory, 
  InboundRecord,
  OutboundRecord,
  InventoryQueryParams, 
  InboundRecordQueryParams,
  OutboundRecordQueryParams,
  InventoryListResponse, 
  InventoryDetailResponse,
  InboundRecordListResponse,
  OutboundRecordListResponse,
  InboundCreateInput,
  OutboundCreateInput,
  InventoryAdjustInput,
  InventoryCountInput,
  InventoryStats,
  InventoryAlert
} from '@/lib/types/inventory'

// API 基础配置
const API_BASE = '/api/inventory'

// 查询键工厂 - 用于 TanStack Query 缓存管理
export const inventoryQueryKeys = {
  all: ['inventory'] as const,
  lists: () => [...inventoryQueryKeys.all, 'list'] as const,
  list: (params: InventoryQueryParams) => [...inventoryQueryKeys.lists(), params] as const,
  details: () => [...inventoryQueryKeys.all, 'detail'] as const,
  detail: (productId: string, colorCode?: string, productionDate?: string) => 
    [...inventoryQueryKeys.details(), productId, colorCode, productionDate] as const,
  stats: () => [...inventoryQueryKeys.all, 'stats'] as const,
  alerts: () => [...inventoryQueryKeys.all, 'alerts'] as const,
  inboundRecords: () => [...inventoryQueryKeys.all, 'inbound'] as const,
  inboundList: (params: InboundRecordQueryParams) => [...inventoryQueryKeys.inboundRecords(), params] as const,
  outboundRecords: () => [...inventoryQueryKeys.all, 'outbound'] as const,
  outboundList: (params: OutboundRecordQueryParams) => [...inventoryQueryKeys.outboundRecords(), params] as const,
}

// API 响应类型
interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

interface ApiError {
  success: false
  error: string
  details?: any
}

// 获取库存列表
export async function getInventories(params: InventoryQueryParams = {}): Promise<InventoryListResponse> {
  const searchParams = new URLSearchParams()
  
  // 构建查询参数
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.search) searchParams.set('search', params.search)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
  if (params.productId) searchParams.set('productId', params.productId)
  if (params.colorCode) searchParams.set('colorCode', params.colorCode)
  if (params.lowStock !== undefined) searchParams.set('lowStock', params.lowStock.toString())
  if (params.hasStock !== undefined) searchParams.set('hasStock', params.hasStock.toString())
  if (params.productionDateStart) searchParams.set('productionDateStart', params.productionDateStart)
  if (params.productionDateEnd) searchParams.set('productionDateEnd', params.productionDateEnd)

  const url = `${API_BASE}?${searchParams.toString()}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 获取库存详情
export async function getInventory(
  productId: string, 
  colorCode?: string, 
  productionDate?: string
): Promise<InventoryDetailResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('productId', productId)
  if (colorCode) searchParams.set('colorCode', colorCode)
  if (productionDate) searchParams.set('productionDate', productionDate)

  const url = `${API_BASE}/detail?${searchParams.toString()}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 入库操作
export async function createInbound(data: InboundCreateInput): Promise<ApiResponse<InboundRecord>> {
  const response = await fetch(`${API_BASE}/inbound`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 出库操作
export async function createOutbound(data: OutboundCreateInput): Promise<ApiResponse<OutboundRecord>> {
  const response = await fetch(`${API_BASE}/outbound`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 库存调整
export async function adjustInventory(data: InventoryAdjustInput): Promise<ApiResponse<Inventory>> {
  const response = await fetch(`${API_BASE}/adjust`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 库存盘点
export async function countInventory(data: InventoryCountInput): Promise<ApiResponse<{
  totalItems: number
  adjustedItems: number
  adjustments: Array<{
    productId: string
    colorCode?: string
    productionDate?: string
    difference: number
  }>
}>> {
  const response = await fetch(`${API_BASE}/count`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 获取入库记录列表
export async function getInboundRecords(params: InboundRecordQueryParams = {}): Promise<InboundRecordListResponse> {
  const searchParams = new URLSearchParams()
  
  // 构建查询参数
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.search) searchParams.set('search', params.search)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
  if (params.type) searchParams.set('type', params.type)
  if (params.productId) searchParams.set('productId', params.productId)
  if (params.userId) searchParams.set('userId', params.userId)
  if (params.startDate) searchParams.set('startDate', params.startDate)
  if (params.endDate) searchParams.set('endDate', params.endDate)

  const url = `${API_BASE}/inbound?${searchParams.toString()}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 获取出库记录列表
export async function getOutboundRecords(params: OutboundRecordQueryParams = {}): Promise<OutboundRecordListResponse> {
  const searchParams = new URLSearchParams()
  
  // 构建查询参数
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.search) searchParams.set('search', params.search)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
  if (params.type) searchParams.set('type', params.type)
  if (params.productId) searchParams.set('productId', params.productId)
  if (params.customerId) searchParams.set('customerId', params.customerId)
  if (params.salesOrderId) searchParams.set('salesOrderId', params.salesOrderId)
  if (params.userId) searchParams.set('userId', params.userId)
  if (params.startDate) searchParams.set('startDate', params.startDate)
  if (params.endDate) searchParams.set('endDate', params.endDate)

  const url = `${API_BASE}/outbound?${searchParams.toString()}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 获取库存统计信息
export async function getInventoryStats(params?: {
  startDate?: string
  endDate?: string
  productId?: string
}): Promise<ApiResponse<InventoryStats>> {
  const searchParams = new URLSearchParams()
  
  if (params?.startDate) searchParams.set('startDate', params.startDate)
  if (params?.endDate) searchParams.set('endDate', params.endDate)
  if (params?.productId) searchParams.set('productId', params.productId)
  
  const url = `${API_BASE}/stats?${searchParams.toString()}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 获取库存预警
export async function getInventoryAlerts(params?: {
  type?: 'low_stock' | 'out_of_stock'
  limit?: number
}): Promise<ApiResponse<InventoryAlert[]>> {
  const searchParams = new URLSearchParams()
  
  if (params?.type) searchParams.set('type', params.type)
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  
  const url = `${API_BASE}/alerts?${searchParams.toString()}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 检查库存可用性
export async function checkInventoryAvailability(
  productId: string,
  quantity: number,
  colorCode?: string,
  productionDate?: string
): Promise<ApiResponse<{
  available: boolean
  currentQuantity: number
  reservedQuantity: number
  availableQuantity: number
  message?: string
}>> {
  const response = await fetch(`${API_BASE}/check-availability`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId,
      quantity,
      colorCode,
      productionDate
    }),
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 预留库存
export async function reserveInventory(
  productId: string,
  quantity: number,
  colorCode?: string,
  productionDate?: string,
  salesOrderId?: string
): Promise<ApiResponse<Inventory>> {
  const response = await fetch(`${API_BASE}/reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId,
      quantity,
      colorCode,
      productionDate,
      salesOrderId
    }),
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 释放预留库存
export async function releaseReservedInventory(
  productId: string,
  quantity: number,
  colorCode?: string,
  productionDate?: string,
  salesOrderId?: string
): Promise<ApiResponse<Inventory>> {
  const response = await fetch(`${API_BASE}/release-reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      productId,
      quantity,
      colorCode,
      productionDate,
      salesOrderId
    }),
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 导出库存数据
export async function exportInventories(params: InventoryQueryParams = {}): Promise<Blob> {
  const searchParams = new URLSearchParams()
  
  // 构建查询参数
  if (params.search) searchParams.set('search', params.search)
  if (params.productId) searchParams.set('productId', params.productId)
  if (params.colorCode) searchParams.set('colorCode', params.colorCode)
  if (params.lowStock !== undefined) searchParams.set('lowStock', params.lowStock.toString())
  if (params.hasStock !== undefined) searchParams.set('hasStock', params.hasStock.toString())
  if (params.productionDateStart) searchParams.set('productionDateStart', params.productionDateStart)
  if (params.productionDateEnd) searchParams.set('productionDateEnd', params.productionDateEnd)

  const url = `${API_BASE}/export?${searchParams.toString()}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  })

  if (!response.ok) {
    throw new Error(`导出失败: ${response.status}`)
  }

  return response.blob()
}

// 获取产品库存历史
export async function getProductInventoryHistory(
  productId: string,
  params?: {
    colorCode?: string
    startDate?: string
    endDate?: string
    limit?: number
  }
): Promise<ApiResponse<Array<{
  date: string
  inboundQuantity: number
  outboundQuantity: number
  adjustQuantity: number
  endQuantity: number
}>>> {
  const searchParams = new URLSearchParams()
  searchParams.set('productId', productId)
  
  if (params?.colorCode) searchParams.set('colorCode', params.colorCode)
  if (params?.startDate) searchParams.set('startDate', params.startDate)
  if (params?.endDate) searchParams.set('endDate', params.endDate)
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  
  const url = `${API_BASE}/history?${searchParams.toString()}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}
