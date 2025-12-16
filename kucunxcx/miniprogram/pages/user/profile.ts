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
    canCreateProduct: false,
    statusBarHeight: 0,
    navBarHeight: 44,
    navHeight: 44,
  },

  onLoad() {
    this.initCustomNav();
    this.loadUserInfo();
  },

  onShow() {
    // 每次显示页面时重新加载用户信息
    this.loadUserInfo();
  },

  // 初始化自定义导航栏高度（适配不同机型/状态栏）
  initCustomNav() {
    try {
      // 使用新推荐 API，避免 wx.getSystemInfoSync 的弃用警告
      const windowInfo = wx.getWindowInfo();
      const statusBarHeight = windowInfo.statusBarHeight || 0;

      // 胶囊按钮仅在非 tab 首页等场景可靠，这里拿不到也能回退到 44
      let navBarHeight = 44;
      try {
        const menu = wx.getMenuButtonBoundingClientRect?.();
        if (menu && menu.top && menu.bottom) {
          navBarHeight = menu.bottom + menu.top - statusBarHeight;
        }
      } catch (_error) {
        // ignore
      }

      const navHeight = statusBarHeight + navBarHeight;
      this.setData({ statusBarHeight, navBarHeight, navHeight });
    } catch (_error) {
      // ignore
    }
  },

  // 加载用户信息
  loadUserInfo() {
    // 检查登录状态
    const isLoggedIn = authService.isLoggedIn();
    const canManage = authService.canViewNumericInventory();

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
          canCreateProduct: canManage,
        });
      } else {
        // 用户信息丢失,清除登录状态
        authService.logout();
        this.setData({
          userInfo: null,
          isLoggedIn: false,
          canCreateProduct: false,
        });
      }
    } else {
      this.setData({
        userInfo: null,
        isLoggedIn: false,
        canCreateProduct: false,
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

  // 底部导航（与首页保持一致）
  navigateToProducts() {
    wx.navigateTo({
      url: '/pages/products/list',
    });
  },

  navigateToInventory() {
    wx.navigateTo({
      url: '/pages/inventory/list',
    });
  },

  navigateToCreateProduct() {
    const canManage = authService.canViewNumericInventory();

    // 访客 / 普通用户：仅展示极光渐变效果，不做任何提示
    if (!canManage) {
      return;
    }

    wx.navigateTo({
      url: '/pages/products/create',
    });
  },

  navigateToCategories() {
    wx.navigateTo({
      url: '/pages/categories/list',
    });
  },

  navigateToUser() {
    try {
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    } catch (_error) {
      // ignore
    }
  },
});
