// 分类服务
// 封装所有分类相关的 API 请求

import { API_ENDPOINTS } from '../config/api';
import type { Category } from '../types/category';
import { get } from '../utils/request';

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
}

// 导出单例
export const categoryService = new CategoryService();
export default categoryService;
