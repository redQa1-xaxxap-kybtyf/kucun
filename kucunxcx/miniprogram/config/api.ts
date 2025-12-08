// API 配置
// 存储API基础地址和相关配置

/**
 * API 环境配置
 */
const ENV = {
  // 开发环境
  development: {
    baseURL: 'http://localhost:3000/api',
    timeout: 30000,
  },
  // 生产环境
  production: {
    // 正式版小程序使用的真实接口地址
    baseURL: 'https://kucun.0595t.com/api',
    timeout: 30000,
  },
};

/**
 * 当前环境
 * 微信小程序可以通过 wx.getAccountInfoSync() 判断
 */
function getCurrentEnv(): 'development' | 'production' {
  // 在开发者工具中返回 development
  // 在正式版中返回 production
  try {
    const accountInfo = wx.getAccountInfoSync();
    return accountInfo.miniProgram.envVersion === 'develop'
      ? 'development'
      : 'production';
  } catch (_error) {
    // 默认返回开发环境
    return 'development';
  }
}

/**
 * API 配置
 */
export const apiConfig = ENV[getCurrentEnv()];

/**
 * API 端点
 */
export const API_ENDPOINTS = {
  // 认证相关
  AUTH: {
    LOGIN: '/auth/mini-login', // 小程序专用登录，不需要验证码
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
  },

  // 产品相关
  PRODUCTS: {
    LIST: '/products',
    DETAIL: (id: string) => `/products/${id}`,
    SEARCH: '/products/search',
  },

  // 分类相关
  CATEGORIES: {
    LIST: '/categories',
    DETAIL: (id: string) => `/categories/${id}`,
  },

  // 库存相关
  INVENTORY: {
    LIST: '/inventory',
    DETAIL: (id: string) => `/inventory/${id}`,
    CHECK: '/inventory/check-availability',
    ALERTS: '/inventory/alerts',
  },

  // 批次相关
  BATCHES: {
    LIST: '/batches',
    DETAIL: (id: string) => `/batches/${id}`,
    MATCH: '/batches/match',
  },

  // 个人中心相关（收藏、浏览历史等）
  PROFILE: {
    FAVORITES: '/profile/favorites',
    HISTORY: '/profile/history',
  },
};

/**
 * 请求头配置
 */
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

/**
 * 存储 Token 的 key
 */
export const TOKEN_KEY = 'auth_token';
