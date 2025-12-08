// user/profile.ts
// 用户中心页

import authService from '../../services/auth.service';

interface UserInfo {
  username: string;
  role: string;
  email?: string;
  name?: string;
  avatar?: string;
}

Page({
  data: {
    userInfo: null as UserInfo | null,
    isLoggedIn: false,
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    // 每次显示页面时重新加载用户信息
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo() {
    // 检查登录状态
    const isLoggedIn = authService.isLoggedIn();

    if (isLoggedIn) {
      // 从存储获取用户信息
      const user = authService.getCurrentUser();

      if (user) {
        this.setData({
          userInfo: {
            username: user.username,
            role: user.role,
            email: user.email,
            // 优先显示真实姓名，其次用户名
            name: (user as any).name || user.username,
            // 头像字段兼容后端的 avatar / avatarUrl
            avatar: (user as any).avatar || (user as any).avatarUrl || '',
          },
          isLoggedIn: true,
        });
      } else {
        // 用户信息丢失,清除登录状态
        authService.logout();
        this.setData({
          userInfo: null,
          isLoggedIn: false,
        });
      }
    } else {
      this.setData({
        userInfo: null,
        isLoggedIn: false,
      });
    }
  },

  // 导航
  navigateToUserInfo() {
    if (!this.data.isLoggedIn) {
      this.showLoginTip();
      return;
    }

    wx.navigateTo({
      url: '/pages/user/user-info',
    });
  },

  navigateToFavorites() {
    if (!this.data.isLoggedIn) {
      this.showLoginTip();
      return;
    }

    wx.navigateTo({
      url: '/pages/user/favorites',
    });
  },

  navigateToHistory() {
    if (!this.data.isLoggedIn) {
      this.showLoginTip();
      return;
    }

    wx.navigateTo({
      url: '/pages/user/history',
    });
  },

  navigateToSettings() {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none',
    });
  },

  navigateToAbout() {
    wx.showModal({
      title: '关于我们',
      content: '库存管理小程序 v1.0.0\n\n一个简洁高效的库存管理解决方案',
      showCancel: false,
    });
  },

  navigateToHelp() {
    wx.showToast({
      title: '帮助中心功能开发中',
      icon: 'none',
    });
  },

  // 登录
  onLogin() {
    wx.reLaunch({
      url: '/pages/auth/login',
    });
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗?',
      success: res => {
        if (res.confirm) {
          // 清除登录状态
          authService.logout();

          this.setData({
            isLoggedIn: false,
            userInfo: null,
          });

          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500,
          });

          // 延迟跳转到登录页
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/auth/login',
            });
          }, 1500);
        }
      },
    });
  },

  // 显示登录提示
  showLoginTip() {
    wx.showModal({
      title: '提示',
      content: '该功能需要登录后使用',
      confirmText: '去登录',
      success: res => {
        if (res.confirm) {
          this.onLogin();
        }
      },
    });
  },
});
