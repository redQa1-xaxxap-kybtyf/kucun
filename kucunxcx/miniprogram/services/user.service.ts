// 用户相关服务（收藏、浏览历史等）

import { API_ENDPOINTS } from '../config/api';
import { appendMiniTokenForLocalUploads } from '../utils/media';
import { del, get, post } from '../utils/request';

import authService from './auth.service';

export interface FavoriteProduct {
  id: string;
  name: string;
  code: string;
  thumbnailUrl?: string;
  addedAt: string;
}

export interface HistoryProduct {
  id: string;
  name: string;
  code: string;
  thumbnailUrl?: string;
  viewedAt: string;
}

class UserService {
  /**
   * 获取当前用户收藏的产品列表
   */
  async getFavorites(): Promise<FavoriteProduct[]> {
    const list = await get<FavoriteProduct[]>(API_ENDPOINTS.PROFILE.FAVORITES);
    return (list || []).map(item => ({
      ...item,
      thumbnailUrl: item.thumbnailUrl
        ? appendMiniTokenForLocalUploads(item.thumbnailUrl)
        : item.thumbnailUrl,
    }));
  }

  /**
   * 切换收藏状态（收藏 / 取消收藏）
   * 后端会根据当前状态自动切换，并返回最新 isFavorite 状态
   */
  async toggleFavorite(productId: string): Promise<{ isFavorite: boolean }> {
    return post<{ isFavorite: boolean }>(API_ENDPOINTS.PROFILE.FAVORITES, {
      productId,
    });
  }

  /**
   * 清空当前用户的收藏
   */
  async clearFavorites(): Promise<void> {
    await del<void>(API_ENDPOINTS.PROFILE.FAVORITES);
  }

  /**
   * 获取浏览历史列表
   */
  async getHistory(): Promise<HistoryProduct[]> {
    const list = await get<HistoryProduct[]>(API_ENDPOINTS.PROFILE.HISTORY);
    return (list || []).map(item => ({
      ...item,
      thumbnailUrl: item.thumbnailUrl
        ? appendMiniTokenForLocalUploads(item.thumbnailUrl)
        : item.thumbnailUrl,
    }));
  }

  /**
   * 记录浏览历史（查看某个产品时调用）
   */
  async addHistory(productId: string): Promise<void> {
    // 未登录用户不记录浏览历史，直接跳过，避免多余的 401 请求
    if (!authService.isLoggedIn()) {
      return;
    }

    await post<void>(
      API_ENDPOINTS.PROFILE.HISTORY,
      { productId },
      {
        // 登录状态下如果 token 失效，仅在控制台报错，不强制跳登录
        autoRedirectOn401: false,
      }
    );
  }

  /**
   * 清空浏览历史
   */
  async clearHistory(): Promise<void> {
    await del<void>(API_ENDPOINTS.PROFILE.HISTORY);
  }
}

const userService = new UserService();

export default userService;
export { userService };
