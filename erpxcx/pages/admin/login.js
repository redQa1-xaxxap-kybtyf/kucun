const {
  getStoredAdmin,
  hideAdminShareMenu,
  login,
  saveAdminSession,
  validateAdminSession,
} = require('../../utils/admin');

Page({
  data: {
    username: '',
    password: '',
    loading: false,
  },

  async onLoad() {
    hideAdminShareMenu();

    const session = getStoredAdmin();
    if (!session.token) return;

    this.setData({ loading: true });
    try {
      const validSession = await validateAdminSession({
        authRedirect: false,
      });
      if (validSession) {
        wx.redirectTo({
          url: '/pages/admin/workspace',
        });
      }
    } catch (_error) {
      // 登录页不弹失效提示，留在当前页让用户重新登录。
    } finally {
      this.setData({ loading: false });
    }
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value });
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value });
  },

  async onSubmit() {
    const username = this.data.username.trim();
    const password = this.data.password;

    if (!username || !password) {
      wx.showToast({
        title: '请输入账号和密码',
        icon: 'none',
      });
      return;
    }

    this.setData({ loading: true });

    try {
      const data = await login(username, password);
      saveAdminSession(data);
      wx.redirectTo({
        url: '/pages/admin/workspace',
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  onHomeTap() {
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },

});
