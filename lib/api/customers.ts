// 客户管理 API 客户端
// 使用 TanStack Query 进行服务器状态管理
// 遵循命名约定：API响应 camelCase

import { 
  Customer, 
  CustomerQueryParams, 
  CustomerListResponse, 
  CustomerDetailResponse,
  CustomerCreateInput,
  CustomerUpdateInput 
} from '@/lib/types/customer'

// API 基础配置
const API_BASE = '/api/customers'

// 查询键工厂 - 用于 TanStack Query 缓存管理
export const customerQueryKeys = {
  all: ['customers'] as const,
  lists: () => [...customerQueryKeys.all, 'list'] as const,
  list: (params: CustomerQueryParams) => [...customerQueryKeys.lists(), params] as const,
  details: () => [...customerQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerQueryKeys.details(), id] as const,
  hierarchy: () => [...customerQueryKeys.all, 'hierarchy'] as const,
  hierarchyByParent: (parentId?: string) => [...customerQueryKeys.hierarchy(), parentId] as const,
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

// 获取客户列表
export async function getCustomers(params: CustomerQueryParams = {}): Promise<CustomerListResponse> {
  const searchParams = new URLSearchParams()
  
  // 构建查询参数
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.search) searchParams.set('search', params.search)
  if (params.sortBy) searchParams.set('sortBy', params.sortBy)
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)
  if (params.parentCustomerId) searchParams.set('parentCustomerId', params.parentCustomerId)
  if (params.customerType) searchParams.set('customerType', params.customerType)
  if (params.level) searchParams.set('level', params.level)
  if (params.region) searchParams.set('region', params.region)

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

// 获取客户详情
export async function getCustomer(id: string): Promise<CustomerDetailResponse> {
  const response = await fetch(`${API_BASE}/${id}`, {
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

// 创建客户
export async function createCustomer(data: CustomerCreateInput): Promise<ApiResponse<Customer>> {
  const response = await fetch(API_BASE, {
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

// 更新客户
export async function updateCustomer(data: CustomerUpdateInput): Promise<ApiResponse<Customer>> {
  const { id, ...updateData } = data
  
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 删除客户
export async function deleteCustomer(id: string): Promise<ApiResponse<{ id: string }>> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
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

// 获取客户层级结构
export async function getCustomerHierarchy(parentId?: string): Promise<ApiResponse<Customer[]>> {
  const searchParams = new URLSearchParams()
  if (parentId) searchParams.set('parentId', parentId)
  
  const url = `${API_BASE}/hierarchy?${searchParams.toString()}`
  
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

// 搜索客户（用于选择器）
export async function searchCustomers(query: string, excludeId?: string): Promise<ApiResponse<Customer[]>> {
  const searchParams = new URLSearchParams()
  searchParams.set('search', query)
  searchParams.set('limit', '20') // 限制搜索结果数量
  if (excludeId) searchParams.set('excludeId', excludeId)
  
  const url = `${API_BASE}/search?${searchParams.toString()}`
  
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

// 验证客户层级关系（防止循环引用）
export async function validateCustomerHierarchy(
  customerId: string, 
  parentCustomerId: string
): Promise<ApiResponse<{ valid: boolean; reason?: string }>> {
  const response = await fetch(`${API_BASE}/${customerId}/validate-hierarchy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ parentCustomerId }),
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 获取客户统计信息
export async function getCustomerStats(id: string): Promise<ApiResponse<{
  totalOrders: number
  totalAmount: number
  lastOrderDate?: string
  averageOrderAmount: number
  orderFrequency: string
}>> {
  const response = await fetch(`${API_BASE}/${id}/stats`, {
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

// 批量操作
export async function batchUpdateCustomers(
  ids: string[], 
  updates: Partial<CustomerUpdateInput>
): Promise<ApiResponse<{ updated: number; failed: string[] }>> {
  const response = await fetch(`${API_BASE}/batch`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids, updates }),
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 批量删除客户
export async function batchDeleteCustomers(ids: string[]): Promise<ApiResponse<{ deleted: number; failed: string[] }>> {
  const response = await fetch(`${API_BASE}/batch`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  })

  if (!response.ok) {
    const errorData: ApiError = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 导出客户数据
export async function exportCustomers(params: CustomerQueryParams = {}): Promise<Blob> {
  const searchParams = new URLSearchParams()
  
  // 构建查询参数
  if (params.search) searchParams.set('search', params.search)
  if (params.parentCustomerId) searchParams.set('parentCustomerId', params.parentCustomerId)
  if (params.customerType) searchParams.set('customerType', params.customerType)
  if (params.level) searchParams.set('level', params.level)
  if (params.region) searchParams.set('region', params.region)

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
