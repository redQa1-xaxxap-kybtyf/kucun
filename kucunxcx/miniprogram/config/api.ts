// API 配置
// 存储API基础地址和相关配置

/**
 * API 环境配置
 */
const ENV = {
  // 开发环境
  development: {
    // 开发者工具/体验版默认指向线上 API（便于线上联调测试）
    // 如需切换到本地/测试环境，请通过 storage 覆盖（见 API_BASE_URL_KEY）
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
 * 可选：通过 storage 覆盖 API baseURL
 * - 便于在开发者工具/真机联调时切换到测试环境或内网环境
 */
export const API_BASE_URL_KEY = 'api_base_url';

function normalizeBaseURL(url: string): string {
  return url.replace(/\/+$/, '');
}

type DeviceInfoLike = {
  platform?: string;
};

function getApiConfig(): { baseURL: string; timeout: number } {
  // 1) 优先使用手动覆盖的 baseURL
  try {
    const override = wx.getStorageSync(API_BASE_URL_KEY);
    if (typeof override === 'string' && override.trim()) {
      return {
        baseURL: normalizeBaseURL(override.trim()),
        timeout: ENV.production.timeout,
      };
    }
  } catch (_error) {
    // ignore
  }

  // 2) 开发者工具：走开发环境（默认 localhost）
  try {
    const deviceInfo: DeviceInfoLike | null =
      typeof wx.getDeviceInfo === 'function'
        ? (wx.getDeviceInfo() as DeviceInfoLike)
        : null;
    if (deviceInfo?.platform === 'devtools') {
      return ENV.development;
    }
  } catch (_error) {
    // ignore
  }

  // 3) 其他场景：默认生产环境（避免真机联调误打到 localhost）
  return ENV.production;
}

/**
 * API 配置
 */
export const apiConfig = getApiConfig();

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

  // 上传相关
  UPLOAD: {
    QINIU_TOKEN: '/upload/qiniu-token', // 获取七牛云上传 Token
  },

  // 罗马柱（快速拼柱）相关
  COLUMN: {
    // 素材相关
    MATERIALS: '/column/materials',
    MATERIAL_DETAIL: (id: string) => `/column/materials/${id}`,

    // 方案生成
    GENERATE_SCHEME: '/column/generate-scheme',
    CHANGE_CUT_POSITION: '/column/change-cut-position',

    // 收藏
    FAVORITES: '/column/favorites',

    // 方案管理
    SCHEMES: '/column/schemes',
    SCHEME_DETAIL: (id: string) => `/column/schemes/${id}`,
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
