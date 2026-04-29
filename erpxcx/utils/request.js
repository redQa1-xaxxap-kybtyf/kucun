const config = require('./config');

function request(options) {
  const token = wx.getStorageSync('mini_admin_token');
  const useMiniProgramHeader = options.miniProgramHeader !== false;

  return new Promise((resolve, reject) => {
    wx.request({
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

        reject(new Error(data.error || data.message || '请求失败'));
      },
      fail(error) {
        reject(error);
      },
    });
  });
}

module.exports = {
  request,
};
