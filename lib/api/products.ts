// 产品API客户端
// 遵循全栈开发执行手册：使用TanStack Query进行状态管理

import { 
  Product, 
  ProductCreateInput, 
  ProductUpdateInput, 
  ProductQueryParams,
  ProductListResponse,
  ProductResponse,
  ProductErrorResponse
} from '@/lib/types/product'

const API_BASE = '/api/products'

// 获取产品列表
export async function getProducts(params: ProductQueryParams = {}): Promise<ProductListResponse> {
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value))
    }
  })

  const url = `${API_BASE}?${searchParams.toString()}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData: ProductErrorResponse = await response.json()
    throw new Error(errorData.error || '获取产品列表失败')
  }

  return response.json()
}

// 获取单个产品
export async function getProduct(id: string): Promise<ProductResponse> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData: ProductErrorResponse = await response.json()
    throw new Error(errorData.error || '获取产品详情失败')
  }

  return response.json()
}

// 创建产品
export async function createProduct(data: ProductCreateInput): Promise<ProductResponse> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData: ProductErrorResponse = await response.json()
    throw new Error(errorData.error || '创建产品失败')
  }

  return response.json()
}

// 更新产品
export async function updateProduct(data: ProductUpdateInput): Promise<ProductResponse> {
  const response = await fetch(`${API_BASE}/${data.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData: ProductErrorResponse = await response.json()
    throw new Error(errorData.error || '更新产品失败')
  }

  return response.json()
}

// 删除产品
export async function deleteProduct(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData: ProductErrorResponse = await response.json()
    throw new Error(errorData.error || '删除产品失败')
  }

  return response.json()
}

// TanStack Query 查询键工厂
export const productQueryKeys = {
  all: ['products'] as const,
  lists: () => [...productQueryKeys.all, 'list'] as const,
  list: (params: ProductQueryParams) => [...productQueryKeys.lists(), params] as const,
  details: () => [...productQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...productQueryKeys.details(), id] as const,
}
