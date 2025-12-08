// pages/user/user-info.ts
// 个人信息页

import authService from '../../services/auth.service';

interface UserInfo {
  id: string;
  username: string;
  name?: string;
  email?: string;
  role: string;
  avatar?: string;
}

Page({
  data: {
    user: null as UserInfo | null,
  },

  onLoad() {
    this.ensureLoggedIn();
  },

  onShow() {
    this.ensureLoggedIn();
  },

  ensureLoggedIn() {
    if (!authService.isLoggedIn()) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再查看个人信息',
        showCancel: false,
        success: () => {
          wx.reLaunch({
            url: '/pages/auth/login',
          });
        },
      });
      return;
    }

    const user = authService.getCurrentUser() as any;
    if (!user) {
      authService.clearAuth();
      wx.reLaunch({
        url: '/pages/auth/login',
      });
      return;
    }

    this.setData({
      user: {
        id: user.id,
        username: user.username,
        name: user.name || user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar || user.avatarUrl || '',
      },
    });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: res => {
        if (res.confirm) {
          authService.logout();
        }
      },
    });
  },
});
