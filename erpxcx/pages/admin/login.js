const {
  getStoredAdmin,
  login,
  saveAdminSession,
} = require('../../utils/admin');

Page({
  data: {
    username: '',
    password: '',
    loading: false,
  },

  onLoad() {
    const session = getStoredAdmin();
    if (session.token) {
      wx.redirectTo({
        url: '/pages/admin/workspace',
      });
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
});
