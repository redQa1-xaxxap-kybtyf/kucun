'use strict';
// 认证服务
// 封装所有认证相关的 API 请求
Object.defineProperty(exports, '__esModule', { value: true });
exports.authService = void 0;
const api_1 = require('../config/api');
const request_1 = require('../utils/request');
/**
 * 认证服务类
 */
class AuthService {
  /**
   * 用户登录
   */
  async login(credentials) {
    try {
      // 登录请求不需要Token
      const response = await (0, request_1.post)(
        api_1.API_ENDPOINTS.AUTH.LOGIN,
        credentials,
        { needAuth: false }
      );
      // 保存Token和用户信息
      if (response.token) {
        wx.setStorageSync(api_1.TOKEN_KEY, response.token);
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
  async register(data) {
    try {
      const response = await (0, request_1.post)(
        api_1.API_ENDPOINTS.AUTH.REGISTER,
        data,
        { needAuth: false }
      );
      // 注册成功后自动保存Token
      if (response.token) {
        wx.setStorageSync(api_1.TOKEN_KEY, response.token);
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
  async logout() {
    try {
      // 可选：调用后端登出接口
      // await post(API_ENDPOINTS.AUTH.LOGOUT)
      // 清除本地存储
      wx.removeStorageSync(api_1.TOKEN_KEY);
      wx.removeStorageSync('user_info');
      wx.removeStorageSync('token_expires_at');
      // 跳转到登录页
      wx.reLaunch({
        url: '/pages/auth/login',
      });
    } catch (error) {
      console.error('退出登录失败:', error);
      // 即使失败也清除本地数据
      wx.removeStorageSync(api_1.TOKEN_KEY);
      wx.removeStorageSync('user_info');
      wx.reLaunch({
        url: '/pages/auth/login',
      });
    }
  }
  /**
   * 检查是否已登录
   */
  isLoggedIn() {
    const token = wx.getStorageSync(api_1.TOKEN_KEY);
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
  getCurrentUser() {
    try {
      return wx.getStorageSync('user_info');
    } catch (_error) {
      return null;
    }
  }
  /**
   * 获取Token
   */
  getToken() {
    try {
      return wx.getStorageSync(api_1.TOKEN_KEY);
    } catch (_error) {
      return null;
    }
  }
  /**
   * 清除认证信息
   */
  clearAuth() {
    wx.removeStorageSync(api_1.TOKEN_KEY);
    wx.removeStorageSync('user_info');
    wx.removeStorageSync('token_expires_at');
  }
  /**
   * 检查并跳转登录页
   */
  checkAuthAndRedirect() {
    if (!this.isLoggedIn()) {
      wx.reLaunch({
        url: '/pages/auth/login',
      });
      return false;
    }
    return true;
  }
}
// 导出单例
exports.authService = new AuthService();
exports.default = exports.authService;
