// pages/auth/login.ts
// 登录页面

import authService from '../../services/auth.service';

Page({
  data: {
    username: '',
    password: '',
    loading: false,
    showPassword: false,
  },

  onLoad() {
    // 检查是否已登录
    if (authService.isLoggedIn()) {
      // 已登录，跳转到首页
      wx.reLaunch({
        url: '/pages/index/index',
      });
    }
  },

  // 输入用户名
  onUsernameInput(e: any) {
    this.setData({
      username: e.detail.value,
    });
  },

  // 输入密码
  onPasswordInput(e: any) {
    this.setData({
      password: e.detail.value,
    });
  },

  // 切换密码显示/隐藏
  togglePasswordVisibility() {
    this.setData({
      showPassword: !this.data.showPassword,
    });
  },

  // 登录
  async handleLogin() {
    // 验证输入
    if (!this.data.username.trim()) {
      wx.showToast({
        title: '请输入用户名',
        icon: 'none',
      });
      return;
    }

    if (!this.data.password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none',
      });
      return;
    }

    if (this.data.loading) {
      return;
    }

    this.setData({ loading: true });

    try {
      // 调用登录服务
      await authService.login({
        username: this.data.username,
        password: this.data.password,
      });

      // 登录成功
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500,
      });

      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/index/index',
        });
      }, 1500);
    } catch (error) {
      console.error('登录失败:', error);
      // 错误提示已在 request.ts 中处理
    } finally {
      this.setData({ loading: false });
    }
  },

  // 跳转到注册页面（暂未实现）
  navigateToRegister() {
    wx.showToast({
      title: '注册功能开发中',
      icon: 'none',
    });
    // TODO: 实现注册页面后取消注释
    // wx.navigateTo({
    //   url: '/pages/auth/register',
    // })
  },

  // 忘记密码（暂未实现）
  handleForgotPassword() {
    wx.showToast({
      title: '请联系管理员重置密码',
      icon: 'none',
      duration: 2000,
    });
  },

  // 测试账号提示
  showTestAccount() {
    wx.showModal({
      title: '测试账号',
      content: '用户名: admin\n密码: admin123\n\n或使用您的账号登录',
      showCancel: false,
      confirmText: '知道了',
    });
  },
});
