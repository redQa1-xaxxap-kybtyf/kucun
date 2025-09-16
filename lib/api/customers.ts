/**
 * 客户管理API
 * 严格遵循全栈项目统一约定规范
 */

import { ApiResponse, PaginatedResponse } from '@/lib/types/api'
import {
  Customer,
  CustomerQueryParams,
  CustomerCreateInput,
  CustomerUpdateInput
} from '@/lib/types/customer'

/**
 * API基础URL
 */
const API_BASE = '/api/customers'

/**
 * 查询键工厂
 */
export const customerQueryKeys = {
  all: ['customers'] as const,
  lists: () => [...customerQueryKeys.all, 'list'] as const,
  list: (params: CustomerQueryParams) => [...customerQueryKeys.lists(), params] as const,
  details: () => [...customerQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerQueryKeys.details(), id] as const,
  hierarchy: (id?: string) => [...customerQueryKeys.all, 'hierarchy', id] as const,
}

/**
 * 获取客户列表
 */
export async function getCustomers(params: CustomerQueryParams): Promise<PaginatedResponse<Customer>> {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value))
    }
  })

  const response = await fetch(`${API_BASE}?${searchParams.toString()}`)

  if (!response.ok) {
    throw new Error(`获取客户列表失败: ${response.statusText}`)
  }

  const data: ApiResponse<PaginatedResponse<Customer>> = await response.json()

  if (!data.success) {
    throw new Error(data.error || '获取客户列表失败')
  }

  return data.data!
}

/**
 * 获取客户详情
 */
export async function getCustomer(id: string): Promise<Customer> {
  const response = await fetch(`${API_BASE}/${id}`)

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('客户不存在')
    }
    throw new Error(`获取客户详情失败: ${response.statusText}`)
  }

  const data: ApiResponse<Customer> = await response.json()

  if (!data.success) {
    throw new Error(data.error || '获取客户详情失败')
  }

  return data.data!
}

/**
 * 创建客户
 */
export async function createCustomer(customerData: CustomerCreateInput): Promise<Customer> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customerData),
  })

  if (!response.ok) {
    throw new Error(`创建客户失败: ${response.statusText}`)
  }

  const data: ApiResponse<Customer> = await response.json()

  if (!data.success) {
    throw new Error(data.error || '创建客户失败')
  }

  return data.data!
}

/**
 * 更新客户
 */
export async function updateCustomer(id: string, customerData: CustomerUpdateInput): Promise<Customer> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customerData),
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('客户不存在')
    }
    throw new Error(`更新客户失败: ${response.statusText}`)
  }

  const data: ApiResponse<Customer> = await response.json()

  if (!data.success) {
    throw new Error(data.error || '更新客户失败')
  }

  return data.data!
}

/**
 * 删除客户
 */
export async function deleteCustomer(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('客户不存在')
    }
    throw new Error(`删除客户失败: ${response.statusText}`)
  }

  const data: ApiResponse<void> = await response.json()

  if (!data.success) {
    throw new Error(data.error || '删除客户失败')
  }
}
