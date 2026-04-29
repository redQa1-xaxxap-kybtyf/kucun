Page({
  data: {
    username: '',
    password: '',
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value });
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value });
  },

  onSubmit() {
    wx.showToast({
      title: '管理端下一批开发',
      icon: 'none',
    });
  },
});
