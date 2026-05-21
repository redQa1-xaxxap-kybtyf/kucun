const { getStoredAdmin } = require('../../utils/admin');
const { getCatalog } = require('../../utils/catalog');
const {
  CATALOG_RESPONSE_CACHE_TTL_MS,
  shouldRefreshCatalog,
  withCatalogCacheBuster,
} = require('../../utils/catalog-cache');
const { splitByKeyword } = require('../../utils/highlight');
const {
  getPlanCount,
  getPlanItems,
  hasPlanItem,
  removePlanProduct,
  upsertPlanItem,
} = require('../../utils/loading-plan');

const HOT_SERIES_ID = 'hot';
const SEARCH_PAGE_SIZE = 24;
const ADMIN_TAP_THRESHOLD = 7;
const ADMIN_TAP_RESET_MS = 1500;

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

function normalizeSearchProducts(products, keyword) {
  const planItems = getPlanItems();
  return (products || []).map(product => {
    const stockBadge = getStockBadge(product);
    return {
      ...product,
      inPlan: hasPlanItem(product, planItems),
      stockText: stockBadge.text,
      stockBadgeClass: stockBadge.badgeClass,
      factTags: buildFactTags(product),
      codeParts: splitByKeyword(product.code, keyword),
      nameParts: splitByKeyword(product.name, keyword),
      specParts: splitByKeyword(product.specification, keyword),
    };
  });
}

function getDefaultPagination() {
  return {
    page: 1,
    pageSize: SEARCH_PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasMore: false,
  };
}

function getSearchLoadMoreText(pagination) {
  if (pagination && pagination.hasMore) return '上拉加载更多';
  return '';
}

function getVisibleSeries(series) {
  const items = series || [];
  const visible = items.filter(
    item => item.id === HOT_SERIES_ID || item.productCount > 0
  );
  return visible.length > 0 ? visible : items;
}

function getSelectedSeries(series, selectedSeriesId) {
  return (
    (series || []).find(item => item.id === selectedSeriesId) ||
    (series || [])[0] ||
    null
  );
}

function shouldWrapMiniTitle(label) {
  const text = String(label || '').trim();
  return text.length > 5 || /[0-9A-Za-z]/.test(text);
}

function normalizeGroups(groups, selectedSeriesId) {
  return (groups || []).map(group => ({
    ...group,
    displayTitle:
      group.kind === 'series'
        ? group.title || (group.colorSeries && group.colorSeries.name) || ''
        : selectedSeriesId !== HOT_SERIES_ID && group.componentType
          ? group.componentType.label || group.title
          : group.title,
    displayInitial: String(
      group.title || (group.colorSeries && group.colorSeries.name) || '图'
    ).slice(0, 2),
    displaySummary:
      group.kind === 'series'
        ? `${group.componentCount || (group.components || []).length || 0}个品种 · ${
            group.specificationCount || group.productCount || 0
          }种规格`
        : `${group.productCount || 0}款 · ${
            group.specificationCount || group.productCount || 0
          }种规格`,
    componentTags:
      group.kind === 'series'
        ? (group.components || []).map(component => ({
            ...component,
            titleClass: shouldWrapMiniTitle(component.label) ? 'wrap' : '',
          }))
        : [],
    componentCount:
      group.kind === 'series'
        ? group.componentCount || (group.components || []).length || 0
        : 0,
    firstComponentId:
      group.kind === 'series' && group.components && group.components[0]
        ? group.components[0].id
        : '',
    sampleProducts: (group.sampleProducts || []).slice(0, 6),
  }));
}

function buildViewState(data, selectedSeriesId, selectedComponentType, search) {
  const visibleSeries = getVisibleSeries(data.series);
  const selectedSeries = getSelectedSeries(visibleSeries, selectedSeriesId);
  const visibleComponents = (data.components || []).filter(
    item => item.id === 'all' || item.productCount > 0
  );
  const selectedComponent =
    visibleComponents.find(item => item.id === selectedComponentType) ||
    visibleComponents[0] ||
    null;
  const groups = normalizeGroups(data.groups, selectedSeriesId);
  const products = data.products || [];
  const pagination = data.pagination || getDefaultPagination();
  const productTotal = Number(pagination.total);
  const productCount =
    Number.isFinite(productTotal) && productTotal >= products.length
      ? productTotal
      : products.length;
  const bannerCoverUrl =
    (selectedSeries && selectedSeries.coverUrl) ||
    (groups.find(group => group.coverUrl) || {}).coverUrl ||
    (products.find(product => product.thumbnailUrl) || {}).thumbnailUrl ||
    '';

  return {
    bannerCoverUrl,
    groups,
    visibleSeries,
    visibleComponents,
    selectedSeriesName: selectedSeries ? selectedSeries.name : '',
    selectedComponentLabel: selectedComponent ? selectedComponent.label : '',
    selectedSeriesProductCount: selectedSeries
      ? selectedSeries.productCount || 0
      : 0,
    hasSeries: visibleSeries.length > 0,
    hasComponents: visibleComponents.length > 1,
    hasGroups: groups.length > 0,
    hasProducts: products.length > 0,
    isSearching: Boolean(search),
    emptyTitle: search ? '没有找到相关产品' : '还没有可展示的产品',
    emptyText: search
      ? '可以换型号、名称或规格再试。'
      : '产品正在整理中，请稍后查看。',
    productCount,
    loadedProductCount: products.length,
    pagination,
    hasMoreProducts: Boolean(pagination.hasMore),
    loadMoreText: getSearchLoadMoreText(pagination),
  };
}

function getCatalogCacheKey(params) {
  return [
    params.seriesId || 'hot',
    params.componentType || 'all',
    params.search || '',
    params.includeProducts ? 'with-products' : 'summary',
    params.page || 1,
    params.pageSize || SEARCH_PAGE_SIZE,
  ].join('|');
}

function readCatalogMemoryCache(cache, key) {
  const entry = cache && cache[key];
  if (!entry) return null;

  if (
    !entry.cachedAt ||
    Date.now() - entry.cachedAt > CATALOG_RESPONSE_CACHE_TTL_MS
  ) {
    delete cache[key];
    return null;
  }

  return entry.data || null;
}

function writeCatalogMemoryCache(cache, key, data) {
  if (!cache || !key || data === undefined || data === null) return;

  cache[key] = {
    cachedAt: Date.now(),
    data,
  };
}

Page({
  data: {
    loading: true,
    shelfLoading: false,
    error: '',
    selectedSeriesId: HOT_SERIES_ID,
    selectedComponentType: 'all',
    selectedSeriesName: '',
    selectedComponentLabel: '',
    selectedSeriesProductCount: 0,
    bannerCoverUrl: '',
    search: '',
    searchKeyword: '',
    visibleSeries: [],
    visibleComponents: [],
    groups: [],
    products: [],
    hasSeries: false,
    hasComponents: false,
    hasGroups: false,
    hasProducts: false,
    hasAdminSession: false,
    isSearching: false,
    emptyTitle: '',
    emptyText: '',
    productCount: 0,
    loadedProductCount: 0,
    pagination: getDefaultPagination(),
    hasMoreProducts: false,
    loadingMoreProducts: false,
    loadMoreText: '',
    planCount: 0,
  },

  onLoad(options) {
    this.catalogCache = {};
    this.catalogRequestId = 0;
    this.hasLoadedCatalog = false;
    const skipCache = shouldRefreshCatalog(this);
    const incomingSearch = String(options.search || '').trim();
    const incomingSeriesId =
      options.colorSeriesId || options.seriesId || HOT_SERIES_ID;
    this.setData({
      selectedSeriesId: incomingSeriesId,
      search: incomingSearch,
      searchKeyword: incomingSearch,
    });
    this.loadCatalog({ skipCache });
  },

  onShow() {
    const session = getStoredAdmin();
    this.setData({
      hasAdminSession: Boolean(session.token),
      planCount: getPlanCount(),
    });

    if (wx.showShareMenu) {
      wx.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    }

    if (
      this.data.isSearching &&
      this.data.products &&
      this.data.products.length > 0
    ) {
      const planItems = getPlanItems();
      const refreshed = this.data.products.map(product => ({
        ...product,
        inPlan: hasPlanItem(product, planItems),
      }));
      this.setData({ products: refreshed });
    }

    if (shouldRefreshCatalog(this) && this.hasLoadedCatalog) {
      this.catalogCache = {};
      this.setData({
        search: '',
        searchKeyword: '',
        selectedComponentType: 'all',
        selectedSeriesId: HOT_SERIES_ID,
      });
      this.loadCatalog({ keepShelf: true, skipCache: true });
    }
  },

  onPullDownRefresh() {
    this.loadCatalog({ skipCache: true }).finally(() =>
      wx.stopPullDownRefresh()
    );
  },

  onReachBottom() {
    if (this.data.isSearching) {
      this.loadMoreSearchProducts();
    }
  },

  onShareAppMessage() {
    const { selectedSeriesId } = this.data;
    const isAllSeries = selectedSeriesId === HOT_SERIES_ID;
    return {
      title: !isAllSeries
        ? `${this.data.selectedSeriesName}外墙罗马柱`
        : '外墙罗马柱产品',
      path: `/pages/index/index?colorSeriesId=${selectedSeriesId || HOT_SERIES_ID}&seriesId=${selectedSeriesId || HOT_SERIES_ID}`,
    };
  },

  onShareTimeline() {
    const { selectedSeriesId } = this.data;
    const isAllSeries = selectedSeriesId === HOT_SERIES_ID;
    return {
      title: !isAllSeries
        ? `${this.data.selectedSeriesName}外墙罗马柱`
        : '外墙罗马柱产品',
      query: `colorSeriesId=${selectedSeriesId || HOT_SERIES_ID}&seriesId=${selectedSeriesId || HOT_SERIES_ID}`,
    };
  },

  async requestCatalog(params) {
    const requestParams = {
      seriesId: params.seriesId || HOT_SERIES_ID,
      componentType: params.componentType || 'all',
      search: params.search || '',
      includeProducts:
        params.includeProducts !== undefined
          ? params.includeProducts
          : Boolean(params.search),
      page: params.page || 1,
      pageSize: params.pageSize || SEARCH_PAGE_SIZE,
    };
    const cacheKey = getCatalogCacheKey(requestParams);

    if (!params.skipCache) {
      const cached = readCatalogMemoryCache(this.catalogCache, cacheKey);
      if (cached) return cached;
    }

    const data = await getCatalog(
      withCatalogCacheBuster(requestParams, params.skipCache)
    );
    writeCatalogMemoryCache(this.catalogCache, cacheKey, data);

    return data;
  },

  findSeriesGroup(seriesId) {
    return (this.data.groups || []).find(
      group =>
        group.kind === 'series' &&
        group.colorSeries &&
        group.colorSeries.id === seriesId
    );
  },

  openGroupDetail(groupId) {
    if (!groupId) return;

    wx.navigateTo({
      url: `/pages/group/detail?groupId=${encodeURIComponent(groupId)}&id=${encodeURIComponent(groupId)}`,
    });
  },

  async loadCatalog(options = {}) {
    const keepShelf = Boolean(options.keepShelf);
    const requestId = (this.catalogRequestId || 0) + 1;
    this.catalogRequestId = requestId;

    if (options.skipCache) {
      this.catalogCache = {};
    }

    if (wx.showNavigationBarLoading) {
      wx.showNavigationBarLoading();
    }

    this.setData({
      loading: !keepShelf,
      shelfLoading: keepShelf,
      error: '',
    });

    try {
      const searchKeyword = this.data.searchKeyword;
      let selectedSeriesId = searchKeyword
        ? HOT_SERIES_ID
        : this.data.selectedSeriesId || HOT_SERIES_ID;
      let selectedComponentType = searchKeyword
        ? 'all'
        : this.data.selectedComponentType || 'all';
      let data = await this.requestCatalog({
        seriesId: selectedSeriesId,
        componentType: selectedComponentType,
        search: searchKeyword,
        includeProducts: Boolean(searchKeyword),
        page: 1,
        pageSize: SEARCH_PAGE_SIZE,
        skipCache: options.skipCache,
      });
      if (requestId !== this.catalogRequestId) return;

      let visibleSeries = getVisibleSeries(data.series);

      if (
        !searchKeyword &&
        visibleSeries.length > 0 &&
        !visibleSeries.some(series => series.id === selectedSeriesId)
      ) {
        selectedSeriesId = HOT_SERIES_ID;
        selectedComponentType = 'all';
        data = await this.requestCatalog({
          seriesId: selectedSeriesId,
          componentType: selectedComponentType,
          includeProducts: false,
          page: 1,
          pageSize: SEARCH_PAGE_SIZE,
          skipCache: options.skipCache,
        });
        if (requestId !== this.catalogRequestId) return;
        visibleSeries = getVisibleSeries(data.series);
      }

      this.hasLoadedCatalog = true;
      const rawProducts = data.products || [];
      const normalizedProducts = searchKeyword
        ? normalizeSearchProducts(rawProducts, searchKeyword)
        : rawProducts;
      this.setData({
        selectedSeriesId,
        selectedComponentType,
        groups: data.groups || [],
        products: normalizedProducts,
        ...buildViewState(
          { ...data, series: data.series || visibleSeries },
          selectedSeriesId,
          selectedComponentType,
          searchKeyword
        ),
        loading: false,
        shelfLoading: false,
        loadingMoreProducts: false,
      });
    } catch (error) {
      if (requestId !== this.catalogRequestId) return;

      this.setData({
        error: error.message || '加载失败',
        loading: false,
        shelfLoading: false,
        loadingMoreProducts: false,
      });
    } finally {
      if (requestId === this.catalogRequestId && wx.hideNavigationBarLoading) {
        wx.hideNavigationBarLoading();
      }
    }
  },

  async loadMoreSearchProducts() {
    if (
      this.data.loading ||
      this.data.loadingMoreProducts ||
      !this.data.hasMoreProducts
    ) {
      return;
    }

    const requestId = (this.catalogRequestId || 0) + 1;
    this.catalogRequestId = requestId;
    const searchKeyword = this.data.searchKeyword;
    const nextPage = Number(this.data.pagination.page || 1) + 1;

    this.setData({ loadingMoreProducts: true });

    try {
      const data = await this.requestCatalog({
        seriesId: HOT_SERIES_ID,
        componentType: 'all',
        search: searchKeyword,
        includeProducts: true,
        page: nextPage,
        pageSize: SEARCH_PAGE_SIZE,
      });
      if (requestId !== this.catalogRequestId) return;

      const nextProducts = normalizeSearchProducts(
        data.products || [],
        searchKeyword
      );
      const products = (this.data.products || []).concat(nextProducts);
      const pagination = data.pagination || getDefaultPagination();

      this.setData({
        products,
        pagination,
        productCount: pagination.total || products.length,
        loadedProductCount: products.length,
        hasProducts: products.length > 0,
        hasMoreProducts: Boolean(pagination.hasMore),
        loadMoreText: getSearchLoadMoreText(pagination),
        loadingMoreProducts: false,
      });
    } catch (error) {
      if (requestId !== this.catalogRequestId) return;
      this.setData({
        error: error.message || '加载失败',
        loadingMoreProducts: false,
      });
    }
  },

  onSeriesTap(event) {
    const seriesId = event.currentTarget.dataset.id || HOT_SERIES_ID;
    if (seriesId === this.data.selectedSeriesId && !this.data.searchKeyword) {
      return;
    }

    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' });
    }

    if (
      this.data.selectedSeriesId === HOT_SERIES_ID &&
      seriesId !== HOT_SERIES_ID
    ) {
      const seriesGroup = this.findSeriesGroup(seriesId);
      if (
        seriesGroup &&
        Number(seriesGroup.componentCount || 0) === 1 &&
        seriesGroup.firstComponentId
      ) {
        this.openGroupDetail(`${seriesId}__${seriesGroup.firstComponentId}`);
        return;
      }
    }

    this.setData({
      selectedSeriesId: seriesId,
      selectedComponentType: 'all',
      search: '',
      searchKeyword: '',
    });
    this.loadCatalog({ keepShelf: true });
  },

  onComponentTap(event) {
    const componentType = event.currentTarget.dataset.id || 'all';
    if (componentType === this.data.selectedComponentType) {
      return;
    }

    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' });
    }

    this.setData({
      selectedComponentType: componentType,
      search: '',
      searchKeyword: '',
    });
    this.loadCatalog({ keepShelf: true });
  },

  onSearchInput(event) {
    this.setData({
      search: event.detail.value,
    });
  },

  onSearchConfirm() {
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' });
    }
    const searchKeyword = this.data.search.trim();
    this.setData({
      searchKeyword,
      selectedComponentType: 'all',
    });
    this.loadCatalog();
  },

  onClearSearch() {
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' });
    }
    this.setData({
      search: '',
      searchKeyword: '',
      selectedComponentType: 'all',
    });
    this.loadCatalog();
  },

  onGroupTap(event) {
    const id = event.currentTarget.dataset.id;
    const kind = event.currentTarget.dataset.kind;
    const firstComponentId = event.currentTarget.dataset.firstComponentId;
    const componentCount = Number(
      event.currentTarget.dataset.componentCount || 0
    );
    const seriesId =
      event.currentTarget.dataset.seriesId ||
      (String(id || '').startsWith('series__')
        ? String(id).replace(/^series__/, '')
        : '');

    if (
      (kind === 'series' || String(id || '').startsWith('series__')) &&
      seriesId
    ) {
      if (componentCount === 1 && firstComponentId) {
        this.openGroupDetail(`${seriesId}__${firstComponentId}`);
        return;
      }

      this.setData({
        selectedSeriesId: seriesId,
        selectedComponentType: 'all',
        search: '',
        searchKeyword: '',
      });
      this.loadCatalog({ keepShelf: true });
      return;
    }

    this.openGroupDetail(id);
  },

  onComponentGroupTap(event) {
    this.openGroupDetail(event.currentTarget.dataset.id);
  },

  onProductTap(event) {
    wx.navigateTo({
      url: `/pages/product/detail?productId=${encodeURIComponent(event.currentTarget.dataset.id)}&id=${encodeURIComponent(event.currentTarget.dataset.id)}`,
    });
  },

  onAdminTap() {
    const session = getStoredAdmin();
    if (session.token) {
      wx.navigateTo({
        url: '/pages/admin/workspace',
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/admin/login',
    });
  },

  onSearchIconTap() {
    const value = String(this.data.search || '').trim();
    if (value) {
      this.onSearchConfirm();
      return;
    }

    const now = Date.now();
    const state = this.adminTapState || { count: 0, at: 0 };
    if (now - state.at > ADMIN_TAP_RESET_MS) {
      state.count = 0;
    }
    state.count += 1;
    state.at = now;
    this.adminTapState = state;

    if (state.count >= ADMIN_TAP_THRESHOLD) {
      this.adminTapState = { count: 0, at: 0 };
      this.onAdminTap();
    }
  },

  noop() {},

  onProductLongpress(event) {
    const productId = event.currentTarget.dataset.id;
    const product = (this.data.products || []).find(
      item => item.id === productId
    );
    if (!product) return;

    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'medium' });
    }

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

  onAddPlanTap(event) {
    const productId = event.currentTarget.dataset.id;
    const products = this.data.products || [];
    const product = products.find(item => item.id === productId);
    if (!product) return;

    if (wx.vibrateShort) {
      wx.vibrateShort({ type: product.inPlan ? 'light' : 'medium' });
    }

    let nextProducts;
    let toastTitle;
    let toastIcon;

    if (product.inPlan) {
      removePlanProduct(product);
      nextProducts = products.map(item =>
        item.id === productId ? { ...item, inPlan: false } : item
      );
      toastTitle = '已取消加入';
      toastIcon = 'none';
    } else {
      const result = upsertPlanItem(product, 1);
      nextProducts = products.map(item =>
        item.id === productId ? { ...item, inPlan: true } : item
      );
      toastTitle = result.existed ? '已在报货中' : '已加入报货';
      toastIcon = result.existed ? 'none' : 'success';
    }

    this.setData({
      products: nextProducts,
      planCount: getPlanCount(),
    });
    wx.showToast({
      title: toastTitle,
      icon: toastIcon,
    });
  },

  onPlanTap() {
    wx.navigateTo({
      url: '/pages/plan/index',
    });
  },
});
