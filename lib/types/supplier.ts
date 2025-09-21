// 供应商相关类型定义
// 遵循命名约定：前端使用 camelCase

// 供应商状态类型
export type SupplierStatus = 'active' | 'inactive';

// 供应商基础信息
export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  status: SupplierStatus;
  createdAt: string;
  updatedAt: string;
}

// 供应商创建输入
export interface SupplierCreateInput {
  name: string;
  phone?: string;
  address?: string;
}

// 供应商更新输入
export interface SupplierUpdateInput {
  name?: string;
  phone?: string;
  address?: string;
  status?: SupplierStatus;
}

// 供应商查询参数
export interface SupplierQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: SupplierStatus;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// 供应商表单数据
export interface SupplierFormData {
  name: string;
  phone?: string;
  address?: string;
}

// 批量删除供应商输入
export interface BatchDeleteSuppliersInput {
  supplierIds: string[];
}

// 批量删除结果
export interface BatchDeleteSuppliersResult {
  success: boolean;
  deletedCount: number;
  failedCount: number;
  failedSuppliers?: {
    id: string;
    name: string;
    reason: string;
  }[];
  message: string;
}

// 批量状态更新输入
export interface BatchUpdateSupplierStatusInput {
  supplierIds: string[];
  status: SupplierStatus;
}

// 批量状态更新结果
export interface BatchUpdateSupplierStatusResult {
  success: boolean;
  updatedCount: number;
  failedCount: number;
  failedSuppliers?: {
    id: string;
    name: string;
    reason: string;
  }[];
  message: string;
}
