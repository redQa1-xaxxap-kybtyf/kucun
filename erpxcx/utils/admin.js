const { request } = require('./request');

function login(username, password) {
  return request({
    url: '/api/auth/mini-login',
    method: 'POST',
    data: {
      username,
      password,
    },
  });
}

function getStoredAdmin() {
  return {
    token: wx.getStorageSync('mini_admin_token'),
    user: wx.getStorageSync('mini_admin_user'),
  };
}

function saveAdminSession(data) {
  wx.setStorageSync('mini_admin_token', data.token);
  wx.setStorageSync('mini_admin_user', data.user);
}

function clearAdminSession() {
  wx.removeStorageSync('mini_admin_token');
  wx.removeStorageSync('mini_admin_user');
}

function requireAdminSession() {
  const session = getStoredAdmin();

  if (!session.token) {
    wx.redirectTo({
      url: '/pages/admin/login',
    });
    return null;
  }

  return session;
}

module.exports = {
  clearAdminSession,
  getStoredAdmin,
  login,
  requireAdminSession,
  saveAdminSession,
};
