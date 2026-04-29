const { getProduct } = require('../../utils/catalog');

Page({
  data: {
    loading: true,
    error: '',
    productId: '',
    product: null,
    currentImage: 0,
  },

  onLoad(options) {
    this.setData({ productId: options.id || '' });
    this.loadProduct();
  },

  onShow() {
    if (wx.showShareMenu) {
      wx.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    }
  },

  onShareAppMessage() {
    const product = this.data.product;
    return {
      title: product ? `${product.name}｜${product.code}` : '外墙罗马柱产品',
      path: `/pages/product/detail?id=${this.data.productId}`,
      imageUrl:
        product && product.thumbnailUrl ? product.thumbnailUrl : undefined,
    };
  },

  onShareTimeline() {
    const product = this.data.product;
    return {
      title: product ? `${product.name}｜${product.code}` : '外墙罗马柱产品',
      query: `id=${this.data.productId}`,
      imageUrl:
        product && product.thumbnailUrl ? product.thumbnailUrl : undefined,
    };
  },

  async loadProduct() {
    this.setData({ loading: true, error: '' });

    try {
      const product = await getProduct(this.data.productId);
      this.setData({ product, loading: false });
    } catch (error) {
      this.setData({
        error: error.message || '加载失败',
        loading: false,
      });
    }
  },

  onImageChange(event) {
    this.setData({ currentImage: event.detail.current });
  },

  onRelatedProductTap(event) {
    wx.navigateTo({
      url: `/pages/product/detail?id=${event.currentTarget.dataset.id}`,
    });
  },
});
