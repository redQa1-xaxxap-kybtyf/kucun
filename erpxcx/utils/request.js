const config = require('./config');

const ADMIN_TOKEN_KEY = 'mini_admin_token';
const ADMIN_USER_KEY = 'mini_admin_user';
const ADMIN_EXPIRES_AT_KEY = 'mini_admin_expires_at';
const DEFAULT_AUTH_TIMEOUT_MS = 20000;
const DEFAULT_PUBLIC_GET_TIMEOUT_MS = 10000;
const DEFAULT_PUBLIC_GET_RETRY_COUNT = 1;

let redirectingToLogin = false;

function clearAdminSession() {
  wx.removeStorageSync(ADMIN_TOKEN_KEY);
  wx.removeStorageSync(ADMIN_USER_KEY);
  wx.removeStorageSync(ADMIN_EXPIRES_AT_KEY);
}

function getResponseMessage(data, fallback) {
  return data.error || data.message || fallback;
}

function redirectToLogin() {
  if (redirectingToLogin) return;
  redirectingToLogin = true;

  wx.showToast({
    title: '登录已失效，请重新登录',
    icon: 'none',
  });

  wx.reLaunch({
    url: '/pages/admin/login',
    complete() {
      setTimeout(() => {
        redirectingToLogin = false;
      }, 500);
    },
  });
}

function buildErrorFromResponse(data, fallback) {
  const error = new Error(getResponseMessage(data, fallback));
  if (data && data.details) {
    error.details = data.details;
  }
  if (data && typeof data === 'object') {
    error.response = data;
  }
  return error;
}

function request(options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const requireAuth = Boolean(options.requireAuth || options.auth);
  const token = requireAuth ? wx.getStorageSync(ADMIN_TOKEN_KEY) : '';
  const useMiniProgramHeader = options.miniProgramHeader !== false;
  const isPublicGet = !requireAuth && method === 'GET';
  const timeout =
    options.timeout ||
    (isPublicGet ? DEFAULT_PUBLIC_GET_TIMEOUT_MS : DEFAULT_AUTH_TIMEOUT_MS);
  const retryCount =
    options.retry !== undefined
      ? Math.max(0, Number(options.retry) || 0)
      : isPublicGet
        ? DEFAULT_PUBLIC_GET_RETRY_COUNT
        : 0;

  return new Promise((resolve, reject) => {
    function send(attempt) {
      wx.request({
        url: `${config.apiBaseUrl}${options.url}`,
        method,
        data: options.data || {},
        timeout,
        header: {
          ...(useMiniProgramHeader ? { 'x-client-from': 'mini-program' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(token ? { 'x-mini-token': token } : {}),
          ...(options.header || {}),
        },
        success(response) {
          const data = response.data || {};

          if (
            response.statusCode >= 200 &&
            response.statusCode < 300 &&
            data.success
          ) {
            resolve(data.data);
            return;
          }

          if (
            isPublicGet &&
            response.statusCode >= 500 &&
            attempt < retryCount
          ) {
            send(attempt + 1);
            return;
          }

          if (response.statusCode === 401) {
            if (requireAuth || token) {
              clearAdminSession();
            }

            if (requireAuth && options.authRedirect !== false) {
              redirectToLogin();
              reject(new Error('登录状态已失效，请重新登录'));
              return;
            }

            reject(buildErrorFromResponse(data, '未授权访问'));
            return;
          }

          if (response.statusCode === 403) {
            reject(buildErrorFromResponse(data, '当前账号没有权限'));
            return;
          }

          if (response.statusCode === 400 || response.statusCode === 422) {
            console.warn('[request] 校验失败', {
              url: options.url,
              method,
              response: data,
            });
          }

          reject(buildErrorFromResponse(data, '请求失败'));
        },
        fail(error) {
          if (isPublicGet && attempt < retryCount) {
            send(attempt + 1);
            return;
          }

          const message = String((error && error.errMsg) || '');
          if (message.includes('timeout')) {
            reject(
              new Error('接口请求超时，请确认后端服务已启动并且地址正确')
            );
            return;
          }

          reject(new Error(message || '网络请求失败'));
        },
      });
    }

    send(0);
  });
}

module.exports = {
  request,
};
