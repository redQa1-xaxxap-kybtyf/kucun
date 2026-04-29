const { clearAdminSession, requireAdminSession } = require('../../utils/admin');

Page({
  data: {
    user: {},
  },

  onShow() {
    const session = requireAdminSession();
    if (!session) return;

    this.setData({
      user: session.user,
    });
  },

  onInventoryTap() {
    wx.navigateTo({
      url: '/pages/admin/inventory',
    });
  },

  onComingSoon() {
    wx.showToast({
      title: '下一批接入',
      icon: 'none',
    });
  },

  onLogout() {
    clearAdminSession();
    wx.redirectTo({
      url: '/pages/admin/login',
    });
  },
});
