const { request } = require('./request');

const ADMIN_TOKEN_KEY = 'mini_admin_token';
const ADMIN_USER_KEY = 'mini_admin_user';
const ADMIN_EXPIRES_AT_KEY = 'mini_admin_expires_at';

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
  const expiresAt = Number(wx.getStorageSync(ADMIN_EXPIRES_AT_KEY) || 0);

  if (expiresAt > 0 && Date.now() >= expiresAt) {
    clearAdminSession();
    return {
      token: '',
      user: null,
    };
  }

  return {
    token: wx.getStorageSync(ADMIN_TOKEN_KEY),
    user: wx.getStorageSync(ADMIN_USER_KEY),
  };
}

function saveAdminSession(data) {
  const expiresIn = Number(data.expiresIn || 0);

  wx.setStorageSync(ADMIN_TOKEN_KEY, data.token);
  wx.setStorageSync(ADMIN_USER_KEY, data.user);
  if (expiresIn > 0) {
    wx.setStorageSync(ADMIN_EXPIRES_AT_KEY, Date.now() + expiresIn * 1000);
  } else {
    wx.removeStorageSync(ADMIN_EXPIRES_AT_KEY);
  }
}

function clearAdminSession() {
  wx.removeStorageSync(ADMIN_TOKEN_KEY);
  wx.removeStorageSync(ADMIN_USER_KEY);
  wx.removeStorageSync(ADMIN_EXPIRES_AT_KEY);
}

function hideAdminShareMenu() {
  if (!wx.hideShareMenu) return;

  wx.hideShareMenu({
    menus: ['shareAppMessage', 'shareTimeline'],
  });
}

async function validateAdminSession(options = {}) {
  const session = getStoredAdmin();
  if (!session.token) {
    return null;
  }

  const user = await request({
    url: '/api/profile',
    requireAuth: true,
    authRedirect: options.authRedirect,
  });

  const nextSession = {
    token: wx.getStorageSync(ADMIN_TOKEN_KEY),
    user: {
      ...(session.user || {}),
      ...user,
    },
  };

  wx.setStorageSync(ADMIN_USER_KEY, nextSession.user);
  return nextSession;
}

function requireAdminSession() {
  const session = getStoredAdmin();

  if (!session.token) {
    wx.reLaunch({
      url: '/pages/admin/login',
    });
    return null;
  }

  return session;
}

module.exports = {
  clearAdminSession,
  getStoredAdmin,
  hideAdminShareMenu,
  login,
  requireAdminSession,
  saveAdminSession,
  validateAdminSession,
};
