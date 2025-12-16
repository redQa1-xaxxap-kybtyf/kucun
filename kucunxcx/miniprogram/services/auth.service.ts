// 认证服务
// 封装所有认证相关的 API 请求

import { API_ENDPOINTS, TOKEN_KEY } from '../config/api';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  UserInfo,
} from '../types/auth';
import type { MiniProgramUser } from '../types/user';
import { post } from '../utils/request';

/**
 * 认证服务类
 */
class AuthService {
  /**
   * 用户登录
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      // 登录请求不需要Token
      const response = await post<LoginResponse>(
        API_ENDPOINTS.AUTH.LOGIN,
        credentials,
        { needAuth: false }
      );

      // 保存Token和用户信息
      if (response.token) {
        wx.setStorageSync(TOKEN_KEY, response.token);
        wx.setStorageSync('user_info', response.user);

        // 保存Token过期时间（如果有）
        if (response.expiresIn) {
          const expiresAt = Date.now() + response.expiresIn * 1000;
          wx.setStorageSync('token_expires_at', expiresAt);
        }
      }

      return response;
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  }

  /**
   * 用户注册
   */
  async register(data: RegisterRequest): Promise<LoginResponse> {
    try {
      const response = await post<LoginResponse>(
        API_ENDPOINTS.AUTH.REGISTER,
        data,
        { needAuth: false }
      );

      // 注册成功后自动保存Token
      if (response.token) {
        wx.setStorageSync(TOKEN_KEY, response.token);
        wx.setStorageSync('user_info', response.user);
      }

      return response;
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    }
  }

  /**
   * 退出登录
   */
  async logout(): Promise<void> {
    try {
      // 可选：调用后端登出接口
      // await post(API_ENDPOINTS.AUTH.LOGOUT)

      // 清除本地存储
      wx.removeStorageSync(TOKEN_KEY);
      wx.removeStorageSync('user_info');
      wx.removeStorageSync('token_expires_at');

      // 跳转到登录页
      wx.reLaunch({
        url: '/pages/auth/login',
      });
    } catch (error) {
      console.error('退出登录失败:', error);
      // 即使失败也清除本地数据
      wx.removeStorageSync(TOKEN_KEY);
      wx.removeStorageSync('user_info');
      wx.reLaunch({
        url: '/pages/auth/login',
      });
    }
  }

  /**
   * 检查是否已登录
   */
  isLoggedIn(): boolean {
    const token = wx.getStorageSync(TOKEN_KEY);
    if (!token) {
      return false;
    }

    // 检查Token是否过期
    const expiresAt = wx.getStorageSync('token_expires_at');
    if (expiresAt && Date.now() > expiresAt) {
      // Token已过期，清除
      this.clearAuth();
      return false;
    }

    return true;
  }

  /**
   * 获取当前用户信息
   */
  getCurrentUser(): (UserInfo & MiniProgramUser) | null {
    try {
      return wx.getStorageSync('user_info');
    } catch (_error) {
      return null;
    }
  }

  /**
   * 获取Token
   */
  getToken(): string | null {
    try {
      return wx.getStorageSync(TOKEN_KEY);
    } catch (_error) {
      return null;
    }
  }

  /**
   * 清除认证信息
   */
  clearAuth(): void {
    wx.removeStorageSync(TOKEN_KEY);
    wx.removeStorageSync('user_info');
    wx.removeStorageSync('token_expires_at');
  }

  /**
   * 检查并跳转登录页
   */
  checkAuthAndRedirect(): boolean {
    if (!this.isLoggedIn()) {
      wx.reLaunch({
        url: '/pages/auth/login',
      });
      return false;
    }
    return true;
  }

  /**
   * 判断当前用户是否有查看库存数字的权限
   * 仅 admin / sales 可以查看具体数量
   */
  canViewNumericInventory(): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.role) return false;

    const role = String(user.role).toLowerCase();
    return role === 'admin' || role === 'sales';
  }

  /**
   * 判断当前用户是否有编辑产品的权限
   * 目前约定：管理员和销售人员都可以在小程序中编辑产品
   */
  canEditProduct(): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.role) return false;

    const role = String(user.role).toLowerCase();
    return role === 'admin' || role === 'sales';
  }
}

// 导出单例
export const authService = new AuthService();
export default authService;
