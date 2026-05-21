const { getProduct } = require('../../utils/catalog');
const {
  shouldRefreshCatalog,
  withCatalogCacheBuster,
} = require('../../utils/catalog-cache');
const {
  getPlanCount,
  hasPlanItem,
  removePlanProduct,
  upsertPlanItem,
} = require('../../utils/loading-plan');

function previewImages(urls, current) {
  const imageUrls = uniqueImageUrls(urls || []);
  if (imageUrls.length === 0) return;

  wx.previewImage({
    current: current || imageUrls[0],
    urls: imageUrls,
  });
}

function normalizeImageUrlForComparison(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const withoutQuery = raw.split(/[?#]/)[0].replace(/\/+$/, '');
  try {
    return decodeURIComponent(withoutQuery);
  } catch (_error) {
    return withoutQuery;
  }
}

function uniqueImageUrls(urls) {
  const seen = {};
  const result = [];

  (urls || []).forEach(url => {
    const trimmed = String(url || '').trim();
    const key = normalizeImageUrlForComparison(trimmed);
    if (!trimmed || !key || seen[key]) return;

    seen[key] = true;
    result.push(trimmed);
  });

  return result;
}

function safeDecodeURIComponent(value) {
  const text = String(value || '');
  try {
    return decodeURIComponent(text);
  } catch (_error) {
    return text;
  }
}

function getGalleryImageUrls(product) {
  const mainImages =
    product.mainImageUrls && product.mainImageUrls.length > 0
      ? product.mainImageUrls
      : product.imageUrls;
  const imageUrls = product.thumbnailUrl
    ? [product.thumbnailUrl, ...(mainImages || [])]
    : mainImages || [];

  return uniqueImageUrls(imageUrls);
}

function openShelf(seriesId) {
  const encodedSeriesId = encodeURIComponent(seriesId);
  const url = `/pages/index/index?colorSeriesId=${encodedSeriesId}&seriesId=${encodedSeriesId}`;

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

function getStockBadge(product) {
  const label = String((product && product.stockLabel) || '').trim();
  if (!label) return { text: '', badgeClass: '' };

  return {
    text: label,
    badgeClass: /暂缺|无货|缺货/.test(label) ? 'out' : '',
  };
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
    planCount: 0,
    isInPlan: false,
  },

  onLoad(options) {
    const skipCache = shouldRefreshCatalog(this);
    this.setData({
      productId: safeDecodeURIComponent(options.productId || options.id),
    });
    this.loadProduct({ skipCache });
  },

  onShow() {
    this.refreshPlanState();

    if (shouldRefreshCatalog(this) && this.data.productId) {
      this.loadProduct({ keepContent: true, skipCache: true });
    }

    if (wx.showShareMenu) {
      wx.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    }
  },

  onShareAppMessage() {
    const product = this.data.product;
    const productId = encodeURIComponent(this.data.productId);
    return {
      title: getProductShareTitle(product),
      path: `/pages/product/detail?productId=${productId}&id=${productId}`,
      imageUrl:
        product && product.thumbnailUrl ? product.thumbnailUrl : undefined,
    };
  },

  onShareTimeline() {
    const product = this.data.product;
    const productId = encodeURIComponent(this.data.productId);
    return {
      title: getProductShareTitle(product),
      query: `productId=${productId}&id=${productId}`,
      imageUrl:
        product && product.thumbnailUrl ? product.thumbnailUrl : undefined,
    };
  },

  onPullDownRefresh() {
    this.loadProduct({ skipCache: true }).finally(() =>
      wx.stopPullDownRefresh()
    );
  },

  async loadProduct(options = {}) {
    if (wx.showNavigationBarLoading) {
      wx.showNavigationBarLoading();
    }

    this.setData({
      loading: !(options.keepContent && this.data.product),
      error: '',
    });

    try {
      const product = await getProduct(
        this.data.productId,
        withCatalogCacheBuster({}, options.skipCache)
      );
      const stockBadge = getStockBadge(product);
      const productView = {
        ...product,
        stockText: stockBadge.text,
        stockBadgeClass: stockBadge.badgeClass,
      };
      const galleryImageUrls = getGalleryImageUrls(product);
      this.setData({
        currentImage: 0,
        currentImageNumber: 1,
        galleryImageUrls,
        imageTotal: galleryImageUrls.length,
        product: productView,
        productId: product.id || this.data.productId,
        planCount: getPlanCount(),
        isInPlan: hasPlanItem(product),
        loading: false,
      });
    } catch (error) {
      this.setData({
        error: error.message || '加载失败',
        loading: false,
      });
    } finally {
      if (wx.hideNavigationBarLoading) {
        wx.hideNavigationBarLoading();
      }
    }
  },

  onRetryLoadTap() {
    this.loadProduct({ skipCache: true });
  },

  onBackHomeTap() {
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },

  refreshPlanState(product) {
    const currentProduct = product || this.data.product;
    this.setData({
      planCount: getPlanCount(),
      isInPlan: currentProduct ? hasPlanItem(currentProduct) : false,
    });
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

    openShelf(product.colorSeries.id);
  },

  onCopyProductModel() {
    const product = this.data.product;
    if (!product) return;

    const content = [`型号：${product.code}`, `产品名称：${product.name}`]
      .filter(Boolean)
      .join('\n');

    wx.setClipboardData({
      data: content,
      success() {
        wx.showToast({
          title: '已复制型号',
          icon: 'success',
        });
      },
    });
  },

  onPosterTap() {
    wx.navigateTo({
      url: `/pages/product/poster?productId=${encodeURIComponent(this.data.productId)}&id=${encodeURIComponent(this.data.productId)}`,
    });
  },

  onAddPlanTap() {
    const product = this.data.product;
    if (!product) return;

    if (this.data.isInPlan) {
      removePlanProduct(product);
      this.setData({
        planCount: getPlanCount(),
        isInPlan: false,
      });
      wx.showToast({
        title: '已取消加入',
        icon: 'none',
      });
      return;
    }

    const result = upsertPlanItem(product, 1);
    this.setData({
      planCount: getPlanCount(),
      isInPlan: true,
    });
    wx.showToast({
      title: result.existed ? '已在计划中' : '已加入计划',
      icon: result.existed ? 'none' : 'success',
    });
  },

  onPlanTap() {
    wx.navigateTo({
      url: '/pages/plan/index',
    });
  },

  onRelatedGroupTap(event) {
    wx.navigateTo({
      url: `/pages/group/detail?groupId=${encodeURIComponent(event.currentTarget.dataset.id)}&id=${encodeURIComponent(event.currentTarget.dataset.id)}`,
    });
  },
});
