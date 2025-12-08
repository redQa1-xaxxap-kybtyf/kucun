'use strict';
// products/detail.ts
// 产品详情页
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const auth_service_1 = __importDefault(require('../../services/auth.service'));
const product_service_1 = __importDefault(
  require('../../services/product.service')
);
Page({
  data: {
    productId: '',
    product: null,
    loading: false,
    // 是否允许查看数字库存（仅 admin / sales）
    canViewNumericInventory: false,
  },
  onLoad(options) {
    if (options.id) {
      const canView = auth_service_1.default.canViewNumericInventory();
      this.setData({ productId: options.id, canViewNumericInventory: canView });
      this.loadProductDetail();
    } else {
      wx.showToast({
        title: '产品ID缺失',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },
  // 加载产品详情
  async loadProductDetail() {
    this.setData({ loading: true });
    try {
      // 调用产品详情API
      const product = await product_service_1.default.getProductDetail(
        this.data.productId
      );
      this.setData({ product });
      // 更新导航栏标题为产品名称
      wx.setNavigationBarTitle({
        title: product.name,
      });
    } catch (error) {
      console.error('加载产品详情失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000,
      });
      // 失败后返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
    } finally {
      this.setData({ loading: false });
    }
  },
  // 预览图片
  previewImage(e) {
    const { url } = e.currentTarget.dataset;
    const product = this.data.product;
    if (product && product.images && product.images.length > 0) {
      wx.previewImage({
        current: url,
        urls: product.images,
      });
    }
  },
  // 联系客服
  onContactService() {
    wx.showToast({
      title: '客服功能开发中',
      icon: 'none',
    });
  },
  // 收藏
  onFavorite() {
    wx.showToast({
      title: '收藏成功',
      icon: 'success',
    });
  },
  // 查看库存详情
  navigateToInventory() {
    wx.navigateTo({
      url: `/pages/inventory/list?productId=${this.data.productId}`,
    });
  },
  // 分享
  onShareAppMessage() {
    const product = this.data.product;
    return {
      title: product?.name || '产品详情',
      path: `/pages/products/detail?id=${this.data.productId}`,
      imageUrl: product?.thumbnailUrl || '',
    };
  },
});
