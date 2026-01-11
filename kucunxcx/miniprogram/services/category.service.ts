// 分类服务
// 封装所有分类相关的 API 请求

import { API_ENDPOINTS } from '../config/api';
import type { Category } from '../types/category';
import { del, get, patch, post, put } from '../utils/request';

export interface CreateCategoryParams {
  name: string;
  code?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  status?: 'active' | 'inactive';
}

export interface UpdateCategoryParams {
  name?: string;
  code?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
}

/**
 * 分类服务类
 */
class CategoryService {
  /**
   * 获取分类列表
   */
  async getCategories(): Promise<Category[]> {
    return get<Category[]>(
      API_ENDPOINTS.CATEGORIES.LIST,
      {
        status: 'active', // 只获取启用的分类
      },
      {
        // 分类浏览允许游客模式，不自动跳转登录
        autoRedirectOn401: false,
      }
    );
  }

  /**
   * 获取分类详情
   */
  async getCategoryDetail(id: string): Promise<Category> {
    return get<Category>(API_ENDPOINTS.CATEGORIES.DETAIL(id), undefined, {
      autoRedirectOn401: false,
    });
  }

  /**
   * 创建分类
   */
  async createCategory(params: CreateCategoryParams): Promise<Category> {
    return post<Category>(API_ENDPOINTS.CATEGORIES.LIST, params);
  }

  /**
   * 更新分类
   */
  async updateCategory(id: string, params: UpdateCategoryParams): Promise<Category> {
    return put<Category>(API_ENDPOINTS.CATEGORIES.DETAIL(id), params);
  }

  /**
   * 更新分类状态
   */
  async updateCategoryStatus(
    id: string,
    status: 'active' | 'inactive'
  ): Promise<Category> {
    return patch<Category>(`${API_ENDPOINTS.CATEGORIES.DETAIL(id)}/status`, { status });
  }

  /**
   * 删除分类
   */
  async deleteCategory(id: string): Promise<void> {
    await del(API_ENDPOINTS.CATEGORIES.DETAIL(id));
  }
}

// 导出单例
export const categoryService = new CategoryService();
export default categoryService;
