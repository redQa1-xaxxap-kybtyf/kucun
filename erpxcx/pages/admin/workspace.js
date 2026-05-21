const {
  clearAdminSession,
  hideAdminShareMenu,
  requireAdminSession,
  validateAdminSession,
} = require('../../utils/admin');

Page({
  data: {
    user: {},
  },

  async onShow() {
    hideAdminShareMenu();

    const session = requireAdminSession();
    if (!session) return;

    this.setData({
      user: session.user,
    });

    try {
      const validSession = await validateAdminSession();
      if (validSession) {
        this.setData({
          user: validSession.user,
        });
      }
    } catch (_error) {
      this.setData({
        user: {},
      });
    }
  },

  onInventoryTap() {
    wx.navigateTo({
      url: '/pages/admin/inventory',
    });
  },

  onSalesOrderTap() {
    wx.navigateTo({
      url: '/pages/admin/sales-order',
    });
  },

  onProductsTap() {
    wx.navigateTo({
      url: '/pages/admin/products',
    });
  },

  onCatalogTap() {
    wx.navigateTo({
      url: '/pages/admin/catalog',
    });
  },

  onProductListingTap() {
    wx.navigateTo({
      url: '/pages/admin/products',
    });
  },

  onPaymentTap() {
    wx.navigateTo({
      url: '/pages/admin/payment',
    });
  },

  onHomeTap() {
    wx.reLaunch({
      url: '/pages/index/index',
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
    wx.reLaunch({
      url: '/pages/admin/login',
    });
  },

});
