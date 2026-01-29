/**
 * 罗马柱首页入口
 * 提供双入口：快速拼柱 + 产品查找
 */

const app = getApp<IAppOption>();

Page({
  data: {
    // 用户是否已登录
    isLoggedIn: false,
  },

  onLoad() {
    // 检查登录状态
    this.checkLoginStatus();
  },

  onShow() {
    // 每次显示时更新登录状态
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('auth_token');
    this.setData({
      isLoggedIn: !!token,
    });
  },

  /**
   * 开始快速拼柱流程
   */
  onStartBuild() {
    // 初始化全局状态
    app.globalData.columnBuildState = {
      step: 1,
      targetHeight: 0,
      faceTypes: [],
      currentFaceTypeIndex: 0,
      currentSlot: 'BODY',
      buildHeight: 0,
      delta: 0,
    };

    wx.navigateTo({
      url: '/pages/column/height/index',
    });
  },

  /**
   * 进入产品查找页面
   */
  onSearchMaterial() {
    wx.navigateTo({
      url: '/pages/column/material-search/index',
    });
  },

  /**
   * 返回首页
   */
  onBackHome() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.reLaunch({ url: '/pages/index/index' });
      },
    });
  },
});
