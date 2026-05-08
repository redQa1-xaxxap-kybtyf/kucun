const config = require('./config');

const ADMIN_TOKEN_KEY = 'mini_admin_token';
const ADMIN_USER_KEY = 'mini_admin_user';
const ADMIN_EXPIRES_AT_KEY = 'mini_admin_expires_at';

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

function request(options = {}) {
  const token = wx.getStorageSync(ADMIN_TOKEN_KEY);
  const useMiniProgramHeader = options.miniProgramHeader !== false;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.apiBaseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: options.timeout || 20000,
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

        if (response.statusCode === 401) {
          clearAdminSession();

          if (options.requireAuth && options.authRedirect !== false) {
            redirectToLogin();
            reject(new Error('登录状态已失效，请重新登录'));
            return;
          }

          reject(new Error(getResponseMessage(data, '未授权访问')));
          return;
        }

        if (response.statusCode === 403) {
          reject(new Error(getResponseMessage(data, '当前账号没有权限')));
          return;
        }

        reject(new Error(getResponseMessage(data, '请求失败')));
      },
      fail(error) {
        const message = String((error && error.errMsg) || '');
        if (message.includes('timeout')) {
          reject(
            new Error('接口请求超时，请确认 ERP 后端已启动并且地址正确')
          );
          return;
        }

        reject(new Error(message || '网络请求失败'));
      },
    });
  });
}

module.exports = {
  request,
};
