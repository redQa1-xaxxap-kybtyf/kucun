'use strict';
// pages/auth/login.ts
// 登录页面
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const auth_service_1 = __importDefault(require('../../services/auth.service'));
const ui_1 = require('../../utils/ui');
Page({
  data: {
    username: '',
    password: '',
    loading: false,
    showPassword: false,
    enableBackdropBlur: (0, ui_1.getEnableBackdropBlur)(),
    // 是否需要展示隐私授权弹窗
    needPrivacyAuth: false,
    // 当前设备上是否已经同意过隐私指引（本地缓存标记）
    hasAgreedPrivacy: false,
  },
  onLoad() {
    // 绑定隐私授权回调（用于让 open-type="agreePrivacyAuthorization" 真正生效）
    // - 必须在触发 wx.requirePrivacyAuthorize() 后，用户点击该按钮并在这里 resolve，授权流程才会继续。
    // - 否则按钮可能“点了没反应”（体验版/正式版更常见）。
    try {
      const self = this;
      if (typeof wx.onNeedPrivacyAuthorization === 'function') {
        wx.onNeedPrivacyAuthorization(resolve => {
          self.__privacyResolveHandlers = self.__privacyResolveHandlers || [];
          self.__privacyResolveHandlers.push(resolve);
          this.setData({ needPrivacyAuth: true });
        });
      }
    } catch (_error) {
      // ignore
    }
    // 检查是否已登录
    if (auth_service_1.default.isLoggedIn()) {
      // 已登录，跳转到首页
      wx.reLaunch({
        url: '/pages/index/index',
      });
      return;
    }
    // 从本地缓存中读取是否已同意隐私指引
    try {
      const agreed = wx.getStorageSync('privacy_agreed');
      this.setData({
        hasAgreedPrivacy: !!agreed,
      });
    } catch (_error) {
      this.setData({
        hasAgreedPrivacy: false,
      });
    }
  },
  // 输入用户名
  onUsernameInput(e) {
    this.setData({
      username: e.detail.value,
    });
  },
  // 输入密码
  onPasswordInput(e) {
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
  // 实际执行登录逻辑（已通过隐私校验后调用）
  async performLogin() {
    // 防止重复提交
    if (this.data.loading) {
      return;
    }
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
    this.setData({ loading: true });
    try {
      // 调用登录服务
      await auth_service_1.default.login({
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
      // 兜底提示：避免“控制台有错但用户看不到”的情况
      const message =
        error instanceof Error ? error.message || '登录失败' : '登录失败';
      wx.showToast({
        title: message,
        icon: 'none',
        duration: 2000,
      });
    } finally {
      this.setData({ loading: false });
    }
  },
  // 点击登录按钮：先走隐私授权检查，再真正登录
  handleLogin() {
    // 正在请求中，直接返回
    if (this.data.loading) {
      return;
    }
    // 轻量反馈：确认“点击事件已触发”（避免体验版/正式版反馈为“点了没反应”）
    try {
      wx.vibrateShort?.({ type: 'light' });
    } catch (_error) {
      // ignore
    }
    // 提前做一次输入校验，避免还没输入就弹隐私弹窗，用户以为“没反应”
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
    // 如果本地尚未记录用户同意隐私指引，则先弹出隐私授权弹窗
    if (!this.data.hasAgreedPrivacy) {
      this.setData({ needPrivacyAuth: true });
      // 触发系统隐私授权流程，让 open-type="agreePrivacyAuthorization" 的按钮可点击后真正生效
      // 若当前基础库/版本不支持，则仅展示自定义弹窗
      try {
        const self = this;
        self.__pendingLoginAfterPrivacy = true;
        if (typeof wx.requirePrivacyAuthorize === 'function') {
          wx.requirePrivacyAuthorize({
            success: () => {
              // 用户已授权 or 刚刚授权完成
              if (!self.__pendingLoginAfterPrivacy) return;
              try {
                wx.setStorageSync('privacy_agreed', true);
              } catch (_error) {
                // ignore
              }
              this.setData({
                needPrivacyAuth: false,
                hasAgreedPrivacy: true,
              });
              this.performLogin();
            },
            fail: () => {
              // 用户拒绝或授权失败：保持弹窗，让用户自行选择
            },
          });
        }
      } catch (_error) {
        // ignore
      }
      return;
    }
    // 已同意隐私指引，直接执行登录
    this.performLogin();
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
  // 打开微信配置的《隐私保护指引》
  openPrivacyContract() {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract({});
    }
  },
  // 隐私弹窗：暂不同意 -> 引导以访客身份浏览
  onPrivacyRefuse() {
    // 若存在隐私授权 resolve，告知“拒绝”
    try {
      const self = this;
      self.__pendingLoginAfterPrivacy = false;
      const handlers = self.__privacyResolveHandlers || [];
      for (const resolve of handlers) {
        try {
          resolve({ event: 'disagree' });
        } catch (_error) {
          // ignore
        }
      }
      self.__privacyResolveHandlers = [];
    } catch (_error) {
      // ignore
    }
    this.setData({ needPrivacyAuth: false });
    wx.showToast({
      title: '您可以先以访客身份浏览，有需要时再登录',
      icon: 'none',
      duration: 2000,
    });
    // 可选：跳回首页作为访客浏览
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },
  // 隐私弹窗：用户点击官方「同意并继续」按钮后触发
  onPrivacyAgree() {
    // 若存在隐私授权 resolve，告知“同意”
    try {
      const self = this;
      const handlers = self.__privacyResolveHandlers || [];
      for (const resolve of handlers) {
        try {
          resolve({ buttonId: 'privacy-agree-btn', event: 'agree' });
        } catch (_error) {
          // ignore
        }
      }
      self.__privacyResolveHandlers = [];
    } catch (_error) {
      // ignore
    }
    // 记录本地已同意隐私指引，后续不再弹窗
    try {
      wx.setStorageSync('privacy_agreed', true);
    } catch (_error) {
      // 忽略本地存储错误，尽量不中断流程
    }
    this.setData({
      needPrivacyAuth: false,
      hasAgreedPrivacy: true,
    });
    // 若基础库不支持 requirePrivacyAuthorize，则直接走登录
    if (typeof wx.requirePrivacyAuthorize !== 'function') {
      this.performLogin();
    }
  },
});
