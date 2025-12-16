"use strict";
// API 配置
// 存储API基础地址和相关配置
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOKEN_KEY = exports.DEFAULT_HEADERS = exports.API_ENDPOINTS = exports.apiConfig = void 0;
/**
 * API 环境配置
 */
const ENV = {
    // 开发环境
    development: {
        // 真机联调时无法访问 localhost，开发环境默认指向线上 API
        baseURL: 'https://kucun.0595t.com/api',
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
function getCurrentEnv() {
    // 优先用 deviceInfo 判断 devtools（使用 wx.getDeviceInfo 替代已弃用的 wx.getSystemInfoSync），避免 accountInfo 异常时误判到 localhost
    try {
        const deviceInfo = wx.getDeviceInfo?.();
        if (deviceInfo?.platform === 'devtools') {
            return 'development';
        }
    }
    catch (_error) {
        // ignore
    }
    // 在开发者工具/开发版中 envVersion === 'develop'
    try {
        if (typeof wx.getAccountInfoSync === 'function') {
            const accountInfo = wx.getAccountInfoSync();
            return accountInfo.miniProgram.envVersion === 'develop'
                ? 'development'
                : 'production';
        }
    }
    catch (_error) {
        // ignore
    }
    // 兜底：生产环境（避免线上误打到 localhost 导致无法登录/无法请求）
    return 'production';
}
/**
 * API 配置
 */
exports.apiConfig = ENV[getCurrentEnv()];
/**
 * API 端点
 */
exports.API_ENDPOINTS = {
    // 认证相关
    AUTH: {
        LOGIN: '/auth/mini-login', // 小程序专用登录，不需要验证码
        REGISTER: '/auth/register',
        LOGOUT: '/auth/logout',
    },
    // 产品相关
    PRODUCTS: {
        LIST: '/products',
        DETAIL: (id) => `/products/${id}`,
        SEARCH: '/products/search',
    },
    // 分类相关
    CATEGORIES: {
        LIST: '/categories',
        DETAIL: (id) => `/categories/${id}`,
    },
    // 库存相关
    INVENTORY: {
        LIST: '/inventory',
        DETAIL: (id) => `/inventory/${id}`,
        CHECK: '/inventory/check-availability',
        ALERTS: '/inventory/alerts',
    },
    // 批次相关
    BATCHES: {
        LIST: '/batches',
        DETAIL: (id) => `/batches/${id}`,
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
exports.DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
};
/**
 * 存储 Token 的 key
 */
exports.TOKEN_KEY = 'auth_token';
