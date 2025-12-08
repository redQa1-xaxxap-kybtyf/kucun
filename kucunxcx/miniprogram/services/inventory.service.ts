// 库存服务

import type {
  InventoryItem,
  InventoryListResponse,
  InventoryQueryParams,
} from '../types/inventory';
import { request } from '../utils/request';

class InventoryService {
  /**
   * 获取库存列表
   */
  async getInventoryList(
    params: InventoryQueryParams = {}
  ): Promise<InventoryListResponse> {
    // 直接将参数传递给 request，它会自动处理查询字符串
    const response = await request<InventoryListResponse>({
      url: '/inventory',
      method: 'GET',
      params, // buildURL 函数会自动过滤 undefined/null 并构建查询字符串
      // 游客查看库存列表时，不强制跳转登录
      autoRedirectOn401: false,
    });
    return response;
  }

  /**
   * 获取库存详情
   */
  async getInventoryDetail(id: string): Promise<InventoryItem> {
    return await request<InventoryItem>({
      url: `/inventory/${id}`,
      method: 'GET',
      autoRedirectOn401: false,
    });
  }
}

export default new InventoryService();
