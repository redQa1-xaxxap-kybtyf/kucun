const { getProductGroup } = require('../../utils/catalog');
const {
  shouldRefreshCatalog,
  withCatalogCacheBuster,
} = require('../../utils/catalog-cache');
const {
  getPlanCount,
  getPlanItems,
  hasPlanItem,
  removePlanProduct,
  upsertPlanItem,
} = require('../../utils/loading-plan');

const GROUP_PAGE_SIZE = 24;

function getStockBadge(product) {
  const label = String(product.stockLabel || '').trim();
  if (!label) return { text: '', badgeClass: '' };
  const isOut = /暂缺|无货|缺货/.test(label);
  return {
    text: label,
    badgeClass: isOut ? 'out' : '',
  };
}

function formatNumberText(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return '';
  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2).replace(/\.?0+$/, '');
}

function resolvePackageText(product) {
  if (product.packageText) return product.packageText;

  const piecesPerUnit = Number(product.piecesPerUnit);
  if (Number.isInteger(piecesPerUnit) && piecesPerUnit > 1) {
    return `1件=${piecesPerUnit}片`;
  }

  return '';
}

function formatPackageMetaText(packageText) {
  const text = String(packageText || '').trim();
  if (!text) return '';

  const match = text.match(/^1\s*件\s*[=＝]\s*(\d+(?:\.\d+)?)\s*片$/);
  return match ? `${match[1]}片/件` : text;
}

function resolveWeightText(product) {
  if (product.weightText) return product.weightText;

  const weightText = formatNumberText(product.weightKgPerUnit);
  return weightText ? `${weightText}kg/件` : '';
}

function buildFactTags(product) {
  const packageText = resolvePackageText(product);
  const weightText = resolveWeightText(product);

  return [
    packageText
      ? {
          label: '包装',
          value: formatPackageMetaText(packageText),
        }
      : null,
    weightText
      ? {
          label: '重量',
          value: weightText,
        }
      : null,
  ].filter(Boolean);
}

function normalizeProduct(product, planItems) {
  const specification = String(product.specification || '');
  const stockBadge = getStockBadge(product);

  return {
    ...product,
    inPlan: hasPlanItem(product, planItems),
    specText: specification,
    stockText: stockBadge.text,
    stockBadgeClass: stockBadge.badgeClass,
    factTags: buildFactTags(product),
  };
}

function buildVisibleProducts(group) {
  const products = group && Array.isArray(group.products) ? group.products : [];
  const planItems = getPlanItems();
  const visibleProducts = products.map(product =>
    normalizeProduct(product, planItems)
  );

  return { visibleProducts };
}

function getDefaultPagination() {
  return {
    page: 1,
    pageSize: GROUP_PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasMore: false,
  };
}

function buildListState(group, pagination) {
  const visibleState = buildVisibleProducts(group);
  const total = Number(pagination && pagination.total);
  const loaded = visibleState.visibleProducts.length;
  const safeTotal = Number.isFinite(total) && total >= loaded ? total : loaded;
  const hasMore = Boolean(pagination && pagination.hasMore);

  return {
    ...visibleState,
    hasMoreProducts: hasMore,
    listCountText: `${safeTotal}款`,
    loadMoreText: hasMore ? '上拉加载更多' : '',
  };
}

function mergeProducts(currentProducts, nextProducts) {
  const seen = {};
  const merged = [];

  (currentProducts || []).concat(nextProducts || []).forEach(product => {
    const id = String(product && product.id ? product.id : '');
    if (!id || seen[id]) return;
    seen[id] = true;
    merged.push(product);
  });

  return merged;
}

function safeDecodeURIComponent(value) {
  const text = String(value || '');
  try {
    return decodeURIComponent(text);
  } catch (_error) {
    return text;
  }
}

Page({
  data: {
    loading: true,
    error: '',
    errorType: '',
    groupId: '',
    group: null,
    productSearch: '',
    planCount: 0,
    switchingGroup: false,
    loadingMoreProducts: false,
    hasMoreProducts: false,
    pagination: getDefaultPagination(),
    listCountText: '0款',
    loadMoreText: '',
    visibleProducts: [],
  },

  onLoad(options) {
    this.groupRequestId = 0;
    const skipCache = shouldRefreshCatalog(this);
    this.setData({
      groupId: safeDecodeURIComponent(options.groupId || options.id),
    });
    this.loadGroup({ skipCache });
  },

  onPullDownRefresh() {
    this.loadGroup({ skipCache: true }).finally(() =>
      wx.stopPullDownRefresh()
    );
  },

  onReachBottom() {
    this.loadMoreProducts();
  },

  onShow() {
    const nextState = {
      planCount: getPlanCount(),
    };
    if (this.data.group) {
      Object.assign(
        nextState,
        buildListState(this.data.group, this.data.pagination)
      );
    }
    this.setData(nextState);

    if (shouldRefreshCatalog(this) && this.data.groupId) {
      this.loadGroup({
        keepContent: true,
        skipCache: true,
      });
    }

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
        path: `/pages/product/detail?productId=${encodeURIComponent(dataset.id)}&id=${encodeURIComponent(dataset.id)}`,
        imageUrl: dataset.image || undefined,
      };
    }

    const group = this.data.group;
    return {
      title: group
        ? `${group.colorSeries.name}${group.componentType.label}｜产品图片`
        : '外墙罗马柱品种',
      path: `/pages/group/detail?groupId=${encodeURIComponent(this.data.groupId)}&id=${encodeURIComponent(this.data.groupId)}`,
      imageUrl: group && group.coverUrl ? group.coverUrl : undefined,
    };
  },

  onShareTimeline() {
    const group = this.data.group;
    return {
      title: group
        ? `${group.colorSeries.name}${group.componentType.label}｜产品图片`
        : '外墙罗马柱品种',
      query: `groupId=${encodeURIComponent(this.data.groupId)}&id=${encodeURIComponent(this.data.groupId)}`,
      imageUrl: group && group.coverUrl ? group.coverUrl : undefined,
    };
  },

  async loadGroup(options = {}) {
    const append = Boolean(options.append && this.data.group);
    const keepContent = Boolean((options.keepContent || append) && this.data.group);
    const requestId = (this.groupRequestId || 0) + 1;
    this.groupRequestId = requestId;
    const page = append
      ? Number(this.data.pagination.page || 1) + 1
      : 1;

    if (wx.showNavigationBarLoading) {
      wx.showNavigationBarLoading();
    }

    this.setData({
      loading: !keepContent && !append,
      switchingGroup: keepContent && !append,
      loadingMoreProducts: append,
      error: '',
      errorType: '',
    });

    try {
      const group = await getProductGroup(
        this.data.groupId,
        withCatalogCacheBuster(
          {
            page,
            pageSize: GROUP_PAGE_SIZE,
          },
          options.skipCache
        )
      );
      if (requestId !== this.groupRequestId) return;

      if (group && wx.setNavigationBarTitle) {
        wx.setNavigationBarTitle({
          title: group.title || '产品列表',
        });
      }
      const nextGroup =
        append && this.data.group
          ? {
              ...group,
              products: mergeProducts(
                this.data.group.products || [],
                group.products || []
              ),
            }
          : group;
      const pagination = group.pagination || getDefaultPagination();

      this.setData({
        group: nextGroup,
        pagination,
        loading: false,
        switchingGroup: false,
        loadingMoreProducts: false,
        ...buildListState(nextGroup, pagination),
      });
    } catch (error) {
      if (requestId !== this.groupRequestId) return;

      const message = error.message || '加载失败';
      const isMissing = /不存在|未找到|找不到/.test(message);
      this.setData({
        error: message,
        errorType: isMissing ? 'missing' : 'network',
        loading: false,
        switchingGroup: false,
        loadingMoreProducts: false,
      });
    } finally {
      if (requestId === this.groupRequestId && wx.hideNavigationBarLoading) {
        wx.hideNavigationBarLoading();
      }
    }
  },

  loadMoreProducts() {
    if (
      this.data.loading ||
      this.data.switchingGroup ||
      this.data.loadingMoreProducts ||
      !this.data.hasMoreProducts
    ) {
      return;
    }

    this.loadGroup({
      append: true,
    });
  },

  onBackHomeTap() {
    wx.switchTab({
      url: '/pages/index/index',
      fail() {
        wx.reLaunch({ url: '/pages/index/index' });
      },
    });
  },

  onRetryLoadTap() {
    this.loadGroup({ skipCache: true });
  },

  onProductTap(event) {
    wx.navigateTo({
      url: `/pages/product/detail?productId=${encodeURIComponent(event.currentTarget.dataset.id)}&id=${encodeURIComponent(event.currentTarget.dataset.id)}`,
    });
  },

  onProductLongpress(event) {
    const productId = event.currentTarget.dataset.id;
    const product = this.data.visibleProducts.find(
      item => item.id === productId
    );
    if (!product) return;

    if (!product.thumbnailUrl) {
      wx.showToast({ title: '该产品没有图片可分享', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '准备分享...', mask: true });
    wx.downloadFile({
      url: product.thumbnailUrl,
      success: result => {
        wx.hideLoading();
        if (result.statusCode !== 200 || !result.tempFilePath) {
          wx.showToast({
            title: '图片获取失败，请用右上角菜单转发',
            icon: 'none',
          });
          return;
        }

        if (typeof wx.showShareImageMenu === 'function') {
          wx.showShareImageMenu({
            path: result.tempFilePath,
            fail: () => {
              wx.previewImage({ urls: [result.tempFilePath] });
            },
          });
        } else {
          wx.previewImage({ urls: [result.tempFilePath] });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '图片下载失败，请用右上角菜单转发',
          icon: 'none',
        });
      },
    });
  },

  noop() {},

  onAddPlanTap(event) {
    const productId = event.currentTarget.dataset.id;
    const product = this.data.visibleProducts.find(
      item => item.id === productId
    );
    if (!product) return;

    if (product.inPlan) {
      removePlanProduct(product);
      this.setData({
        planCount: getPlanCount(),
        ...buildListState(this.data.group, this.data.pagination),
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
      ...buildListState(this.data.group, this.data.pagination),
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
    const groupId = safeDecodeURIComponent(event.currentTarget.dataset.id);
    if (!groupId || groupId === this.data.groupId || this.data.switchingGroup) {
      return;
    }

    this.setData({
      groupId,
      productSearch: '',
      pagination: getDefaultPagination(),
    });
    this.loadGroup({ keepContent: true });
  },

  onProductSearchInput(event) {
    this.setData({ productSearch: event.detail.value });
  },

  onProductSearchConfirm() {
    const keyword = String(this.data.productSearch || '').trim();
    if (!keyword) return;
    wx.reLaunch({
      url: `/pages/index/index?search=${encodeURIComponent(keyword)}`,
    });
  },

  onClearProductSearch() {
    this.setData({ productSearch: '' });
  },
});
