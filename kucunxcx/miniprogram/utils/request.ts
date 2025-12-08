// 网络请求封装
// 统一处理微信小程序的 wx.request

import { apiConfig, DEFAULT_HEADERS, TOKEN_KEY } from '../config/api';

/**
 * API 响应格式
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 请求配置
 */
export interface RequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  needAuth?: boolean; // 是否需要携带认证 token
  // 是否在收到 401 时自动跳转到登录页
  // - true: 统一弹“请先登录”并跳转登录
  // - false: 只返回错误，不自动跳转，由调用方自行处理
  autoRedirectOn401?: boolean;
}

/**
 * 构建完整 URL（带查询参数）
 */
function buildURL(url: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
    )
    .join('&');

  return queryString ? `${url}?${queryString}` : url;
}

/**
 * 规范化请求头
 * - 过滤掉 undefined / null
 * - 确保值为字符串（微信小程序要求 header 值为 string）
 */
function normalizeHeaders(
  headers: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(headers)) {
    const value = headers[key];
    if (value === undefined || value === null) continue;
    result[key] = String(value);
  }
  return result;
}

/**
 * 获取存储的 Token
 */
function getToken(): string | null {
  try {
    return wx.getStorageSync(TOKEN_KEY);
  } catch (error) {
    console.error('获取 Token 失败:', error);
    return null;
  }
}

/**
 * 统一请求方法
 */
export function request<T = any>(config: RequestConfig): Promise<T> {
  return new Promise((resolve, reject) => {
    const {
      url,
      method = 'GET',
      data,
      params,
      headers = {},
      timeout = apiConfig.timeout,
      needAuth = true,
      autoRedirectOn401 = true,
    } = config;

    // 构建完整 URL
    const fullURL = apiConfig.baseURL + buildURL(url, params);

    // 构建请求头（过滤 undefined/null，保证值为字符串）
    const requestHeaders = normalizeHeaders({
      ...DEFAULT_HEADERS,
      // 标记来源为小程序，便于后端中间件区分游客接口
      'x-client-from': 'mini-program',
      ...headers,
    });

    // 如果需要认证，添加 Token
    if (needAuth) {
      const token = getToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    // 显示加载提示
    wx.showLoading({
      title: '加载中...',
      mask: true,
    });

    // 发起请求
    const requestOptions: WechatMiniprogram.RequestOption = {
      url: fullURL,
      method,
      data,
      header: requestHeaders,
      success(res) {
        // HTTP 状态码检查
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const raw = res.data as any;

          // 兼容两种返回格式：
          // 1) 标准格式：{ success, data, error, message }
          // 2) 直接返回业务数据（数组 / 对象 / 原始类型）
          if (raw && typeof raw === 'object' && 'success' in raw) {
            const response = raw as ApiResponse<T>;

            if (response.success) {
              // 如果有 data 字段，返回 data；否则返回整个 response
              resolve(
                (response.data !== undefined
                  ? response.data
                  : (response as any)) as T
              );
            } else {
              const error = response.error || response.message || '请求失败';
              wx.showToast({
                title: error,
                icon: 'none',
                duration: 2000,
              });
              reject(new Error(error));
            }
          } else {
            // 非标准格式：直接将后端返回的数据透传给调用方
            resolve(raw as T);
          }
        } else if (res.statusCode === 401) {
          // 未认证
          wx.showToast({
            title: '请先登录',
            icon: 'none',
          });
          // 清除 token
          wx.removeStorageSync(TOKEN_KEY);

          // 根据配置决定是否自动跳转到登录页
          if (autoRedirectOn401) {
            wx.redirectTo({
              url: '/pages/auth/login',
            });
          }

          reject(new Error('未认证'));
        } else if (res.statusCode === 403) {
          // 无权限
          wx.showToast({
            title: '无权访问',
            icon: 'none',
          });
          reject(new Error('无权限'));
        } else {
          // 其他错误
          const errorMsg = `请求失败 (${res.statusCode})`;
          wx.showToast({
            title: errorMsg,
            icon: 'none',
          });
          reject(new Error(errorMsg));
        }
      },
      fail(error) {
        console.error('请求失败:', error);

        // 判断错误类型
        let errorMessage = '网络请求失败';
        if (error.errMsg) {
          if (error.errMsg.includes('timeout')) {
            errorMessage = '请求超时';
          } else if (error.errMsg.includes('fail')) {
            errorMessage = '网络连接失败';
          }
        }

        wx.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000,
        });

        reject(new Error(errorMessage));
      },
      complete() {
        // 始终关闭加载中提示，避免遗漏
        wx.hideLoading();
      },
    };

    // 仅在配置了超时时间时设置，避免传入 undefined
    if (typeof timeout === 'number' && timeout > 0) {
      requestOptions.timeout = timeout;
    }

    wx.request(requestOptions);
  });
}

/**
 * GET 请求
 */
export function get<T = any>(
  url: string,
  params?: Record<string, any>,
  config?: Partial<RequestConfig>
): Promise<T> {
  return request<T>({
    url,
    method: 'GET',
    params,
    ...config,
  });
}

/**
 * POST 请求
 */
export function post<T = any>(
  url: string,
  data?: any,
  config?: Partial<RequestConfig>
): Promise<T> {
  return request<T>({
    url,
    method: 'POST',
    data,
    ...config,
  });
}

/**
 * PUT 请求
 */
export function put<T = any>(
  url: string,
  data?: any,
  config?: Partial<RequestConfig>
): Promise<T> {
  return request<T>({
    url,
    method: 'PUT',
    data,
    ...config,
  });
}

/**
 * DELETE 请求
 */
export function del<T = any>(
  url: string,
  config?: Partial<RequestConfig>
): Promise<T> {
  return request<T>({
    url,
    method: 'DELETE',
    ...config,
  });
}

/**
 * PATCH 请求
 */
export function patch<T = any>(
  url: string,
  data?: any,
  config?: Partial<RequestConfig>
): Promise<T> {
  return request<T>({
    url,
    method: 'PATCH',
    data,
    ...config,
  });
}
