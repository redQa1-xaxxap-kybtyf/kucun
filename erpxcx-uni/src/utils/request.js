import config from './config';

export function getToken() {
  return uni.getStorageSync('mini_admin_token') || '';
}

export function request(options) {
  const token = getToken();
  const useMiniProgramHeader = options.miniProgramHeader !== false;

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${config.apiBaseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        ...(useMiniProgramHeader ? { 'x-client-from': 'mini-program' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
          uni.removeStorageSync('mini_admin_token');
          uni.removeStorageSync('mini_admin_user');
        }

        reject(new Error(data.error || data.message || '请求失败'));
      },
      fail(error) {
        reject(error);
      },
    });
  });
}
