const { getProduct } = require('../../utils/catalog');

function previewImages(urls, current) {
  const imageUrls = (urls || []).filter(Boolean);
  if (imageUrls.length === 0) return;

  wx.previewImage({
    current: current || imageUrls[0],
    urls: imageUrls,
  });
}

Page({
  data: {
    loading: true,
    error: '',
    productId: '',
    product: null,
    currentImage: 0,
    currentImageNumber: 1,
    imageTotal: 0,
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
      this.setData({
        currentImage: 0,
        currentImageNumber: 1,
        imageTotal: (product.imageUrls || []).length,
        product,
        loading: false,
      });
    } catch (error) {
      this.setData({
        error: error.message || '加载失败',
        loading: false,
      });
    }
  },

  onImageChange(event) {
    this.setData({
      currentImage: event.detail.current,
      currentImageNumber: event.detail.current + 1,
    });
  },

  onPreviewGallery(event) {
    const product = this.data.product;
    if (!product) return;

    previewImages(product.imageUrls, event.currentTarget.dataset.current);
  },

  onPreviewEffectImage(event) {
    const product = this.data.product;
    if (!product) return;

    previewImages(
      product.effectImageUrls,
      event.currentTarget.dataset.current
    );
  },

  onRelatedProductTap(event) {
    wx.navigateTo({
      url: `/pages/product/detail?id=${event.currentTarget.dataset.id}`,
    });
  },

  onRelatedGroupTap(event) {
    wx.navigateTo({
      url: `/pages/group/detail?id=${encodeURIComponent(event.currentTarget.dataset.id)}`,
    });
  },
});
