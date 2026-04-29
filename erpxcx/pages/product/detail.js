const { getProduct } = require('../../utils/catalog');

function previewImages(urls, current) {
  const imageUrls = (urls || []).filter(Boolean);
  if (imageUrls.length === 0) return;

  wx.previewImage({
    current: current || imageUrls[0],
    urls: imageUrls,
  });
}

function getGalleryImageUrls(product) {
  const mainImages =
    product.mainImageUrls && product.mainImageUrls.length > 0
      ? product.mainImageUrls
      : product.imageUrls;
  const imageUrls = product.thumbnailUrl
    ? [
        product.thumbnailUrl,
        ...(mainImages || []).filter(url => url !== product.thumbnailUrl),
      ]
    : mainImages || [];

  return imageUrls.filter(Boolean);
}

function openShelf(seriesId, componentType) {
  const url = `/pages/index/index?seriesId=${encodeURIComponent(seriesId)}&componentType=${encodeURIComponent(componentType || 'all')}`;

  wx.navigateTo({
    url,
    fail() {
      wx.redirectTo({ url });
    },
  });
}

function getProductShareTitle(product) {
  if (!product) return '外墙罗马柱产品';

  return (
    product.shareTitle ||
    [
      product.code,
      product.name,
      product.specification,
      product.packageText,
      product.weightText,
    ]
      .filter(Boolean)
      .join('｜') ||
    '外墙罗马柱产品'
  );
}

Page({
  data: {
    loading: true,
    error: '',
    productId: '',
    product: null,
    galleryImageUrls: [],
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
      title: getProductShareTitle(product),
      path: `/pages/product/detail?id=${this.data.productId}`,
      imageUrl:
        product && product.thumbnailUrl ? product.thumbnailUrl : undefined,
    };
  },

  onShareTimeline() {
    const product = this.data.product;
    return {
      title: getProductShareTitle(product),
      query: `id=${this.data.productId}`,
      imageUrl:
        product && product.thumbnailUrl ? product.thumbnailUrl : undefined,
    };
  },

  async loadProduct() {
    this.setData({ loading: true, error: '' });

    try {
      const product = await getProduct(this.data.productId);
      const galleryImageUrls = getGalleryImageUrls(product);
      this.setData({
        currentImage: 0,
        currentImageNumber: 1,
        galleryImageUrls,
        imageTotal: galleryImageUrls.length,
        product,
        productId: product.id || this.data.productId,
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

  onThumbTap(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    this.setData({
      currentImage: index,
      currentImageNumber: index + 1,
    });
  },

  onPreviewGallery(event) {
    const product = this.data.product;
    if (!product) return;

    previewImages(
      this.data.galleryImageUrls,
      event.currentTarget.dataset.current
    );
  },

  onPreviewEffectImage(event) {
    const product = this.data.product;
    if (!product) return;

    previewImages(product.effectImageUrls, event.currentTarget.dataset.current);
  },

  onSeriesShelfTap() {
    const product = this.data.product;
    if (!product) return;

    openShelf(product.colorSeries.id, product.componentType.id);
  },

  onPosterTap() {
    wx.navigateTo({
      url: `/pages/product/poster?id=${this.data.productId}`,
    });
  },

  onRelatedGroupTap(event) {
    wx.navigateTo({
      url: `/pages/group/detail?id=${encodeURIComponent(event.currentTarget.dataset.id)}`,
    });
  },
});
