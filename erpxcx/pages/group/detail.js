const { getProductGroup } = require('../../utils/catalog');
const { getPlanCount, upsertPlanItem } = require('../../utils/loading-plan');

function normalizeProduct(product) {
  return {
    ...product,
    specText: product.specification || '',
    stockText: product.stockLabel || '仓库现货',
  };
}

function matchesSearch(product, keyword) {
  if (!keyword) return true;

  const text = [
    product.code,
    product.name,
    product.specification,
    product.packageText,
    product.weightText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return text.includes(keyword.toLowerCase());
}

function buildVisibleProducts(group, search) {
  const products = group && Array.isArray(group.products) ? group.products : [];
  const keyword = String(search || '').trim();
  const visibleProducts = products
    .map(normalizeProduct)
    .filter(product => matchesSearch(product, keyword));

  return {
    productSearchKeyword: keyword,
    visibleProducts,
  };
}

Page({
  data: {
    loading: true,
    error: '',
    groupId: '',
    group: null,
    productSearch: '',
    productSearchKeyword: '',
    planCount: 0,
    visibleProducts: [],
  },

  onLoad(options) {
    this.setData({
      groupId: decodeURIComponent(options.id || ''),
    });
    this.loadGroup();
  },

  onShow() {
    this.setData({
      planCount: getPlanCount(),
    });

    if (wx.showShareMenu) {
      wx.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    }
  },

  onShareAppMessage(options = {}) {
    const dataset =
      options.target && options.target.dataset ? options.target.dataset : {};
    if (dataset.id) {
      return {
        title: dataset.title || '外墙罗马柱产品',
        path: `/pages/product/detail?id=${encodeURIComponent(dataset.id)}`,
        imageUrl: dataset.image || undefined,
      };
    }

    const group = this.data.group;
    return {
      title: group
        ? `${group.colorSeries.name}${group.componentType.label}｜产品图片`
        : '外墙罗马柱品种',
      path: `/pages/group/detail?id=${encodeURIComponent(this.data.groupId)}`,
      imageUrl: group && group.coverUrl ? group.coverUrl : undefined,
    };
  },

  onShareTimeline() {
    const group = this.data.group;
    return {
      title: group
        ? `${group.colorSeries.name}${group.componentType.label}｜产品图片`
        : '外墙罗马柱品种',
      query: `id=${encodeURIComponent(this.data.groupId)}`,
      imageUrl: group && group.coverUrl ? group.coverUrl : undefined,
    };
  },

  async loadGroup() {
    if (wx.showNavigationBarLoading) {
      wx.showNavigationBarLoading();
    }

    this.setData({ loading: true, error: '' });

    try {
      const group = await getProductGroup(this.data.groupId);
      if (group && wx.setNavigationBarTitle) {
        wx.setNavigationBarTitle({
          title: group.title || '产品列表',
        });
      }

      this.setData({
        group,
        loading: false,
        ...buildVisibleProducts(group, this.data.productSearch),
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

  onProductTap(event) {
    wx.navigateTo({
      url: `/pages/product/detail?id=${event.currentTarget.dataset.id}`,
    });
  },

  onAddPlanTap(event) {
    const productId = event.currentTarget.dataset.id;
    const product = this.data.visibleProducts.find(item => item.id === productId);
    if (!product) return;

    const result = upsertPlanItem(product, 1);
    this.setData({
      planCount: getPlanCount(),
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
      url: `/pages/group/detail?id=${encodeURIComponent(event.currentTarget.dataset.id)}`,
    });
  },

  onProductSearchInput(event) {
    const productSearch = event.detail.value;
    this.setData({
      productSearch,
      ...buildVisibleProducts(this.data.group, productSearch),
    });
  },

  onClearProductSearch() {
    this.setData({
      productSearch: '',
      ...buildVisibleProducts(this.data.group, ''),
    });
  },
});
