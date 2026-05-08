import { request } from './request';

export function login(username, password) {
  return request({
    url: '/api/auth/mini-login',
    method: 'POST',
    data: {
      username,
      password,
    },
  });
}

export function getStoredAdmin() {
  return {
    token: uni.getStorageSync('mini_admin_token') || '',
    user: uni.getStorageSync('mini_admin_user') || null,
  };
}

export function saveAdminSession(data) {
  uni.setStorageSync('mini_admin_token', data.token);
  uni.setStorageSync('mini_admin_user', data.user);
}

export function clearAdminSession() {
  uni.removeStorageSync('mini_admin_token');
  uni.removeStorageSync('mini_admin_user');
}

export function requireAdminSession() {
  const session = getStoredAdmin();

  if (!session.token) {
    uni.navigateTo({
      url: '/pages/admin/login/index',
    });
    return null;
  }

  return session;
}
