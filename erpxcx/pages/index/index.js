const { getStoredAdmin } = require('../../utils/admin');
const { getCatalog } = require('../../utils/catalog');

const CATALOG_DIRTY_KEY = 'mini_catalog_dirty_at';
const HOT_SERIES_ID = 'hot';

function getVisibleSeries(series) {
  return (series || []).filter(item => item.productCount > 0);
}

function getSelectedSeries(series, selectedSeriesId) {
  return (
    (series || []).find(item => item.id === selectedSeriesId) ||
    (series || [])[0] ||
    null
  );
}

function normalizeGroups(groups) {
  return (groups || []).map(group => ({
    ...group,
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
  const groups = normalizeGroups(data.groups);
  const products = data.products || [];
  const productCount = products.length;
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
  };
}

function getCatalogCacheKey(params) {
  return [
    params.seriesId || 'hot',
    params.componentType || 'all',
    params.search || '',
  ].join('|');
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
  },

  onLoad(options) {
    this.catalogCache = {};
    this.catalogRequestId = 0;
    this.hasLoadedCatalog = false;
    this.setData({
      selectedSeriesId: options.seriesId || HOT_SERIES_ID,
    });
    this.loadCatalog();
  },

  onShow() {
    const session = getStoredAdmin();
    this.setData({
      hasAdminSession: Boolean(session.token),
    });

    if (wx.showShareMenu) {
      wx.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    }

    const catalogDirtyAt = wx.getStorageSync(CATALOG_DIRTY_KEY);
    if (catalogDirtyAt) {
      wx.removeStorageSync(CATALOG_DIRTY_KEY);

      if (this.hasLoadedCatalog) {
        this.catalogCache = {};
        this.setData({
          search: '',
          searchKeyword: '',
          selectedComponentType: 'all',
          selectedSeriesId: HOT_SERIES_ID,
        });
        this.loadCatalog({ keepShelf: true, skipCache: true });
      }
    }
  },

  onPullDownRefresh() {
    this.loadCatalog({ skipCache: true }).finally(() =>
      wx.stopPullDownRefresh()
    );
  },

  onShareAppMessage() {
    const { selectedSeriesId } = this.data;
    const isAllSeries = selectedSeriesId === HOT_SERIES_ID;
    return {
      title: !isAllSeries
        ? `${this.data.selectedSeriesName}外墙罗马柱`
        : '外墙罗马柱产品',
      path: `/pages/index/index?seriesId=${selectedSeriesId || HOT_SERIES_ID}`,
    };
  },

  onShareTimeline() {
    const { selectedSeriesId } = this.data;
    const isAllSeries = selectedSeriesId === HOT_SERIES_ID;
    return {
      title: !isAllSeries
        ? `${this.data.selectedSeriesName}外墙罗马柱`
        : '外墙罗马柱产品',
      query: `seriesId=${selectedSeriesId || HOT_SERIES_ID}`,
    };
  },

  async requestCatalog(params) {
    const requestParams = {
      seriesId: params.seriesId || HOT_SERIES_ID,
      componentType: params.componentType || 'all',
      search: params.search || '',
    };
    const cacheKey = getCatalogCacheKey(requestParams);

    if (!params.skipCache && this.catalogCache[cacheKey]) {
      return this.catalogCache[cacheKey];
    }

    const data = await getCatalog(requestParams);
    this.catalogCache[cacheKey] = data;

    return data;
  },

  async loadCatalog(options = {}) {
    const keepShelf = Boolean(options.keepShelf);
    const requestId = (this.catalogRequestId || 0) + 1;
    this.catalogRequestId = requestId;

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
          skipCache: options.skipCache,
        });
        if (requestId !== this.catalogRequestId) return;
        visibleSeries = getVisibleSeries(data.series);
      }

      this.hasLoadedCatalog = true;
      this.setData({
        selectedSeriesId,
        selectedComponentType,
        groups: data.groups || [],
        products: data.products || [],
        ...buildViewState(
          { ...data, series: data.series || visibleSeries },
          selectedSeriesId,
          selectedComponentType,
          searchKeyword
        ),
        loading: false,
        shelfLoading: false,
      });
    } catch (error) {
      if (requestId !== this.catalogRequestId) return;

      this.setData({
        error: error.message || '加载失败',
        loading: false,
        shelfLoading: false,
      });
    } finally {
      if (requestId === this.catalogRequestId && wx.hideNavigationBarLoading) {
        wx.hideNavigationBarLoading();
      }
    }
  },

  onSeriesTap(event) {
    const seriesId = event.currentTarget.dataset.id || HOT_SERIES_ID;
    if (seriesId === this.data.selectedSeriesId && !this.data.searchKeyword) {
      return;
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
    const searchKeyword = this.data.search.trim();
    this.setData({
      searchKeyword,
      selectedComponentType: 'all',
    });
    this.loadCatalog();
  },

  onClearSearch() {
    this.setData({
      search: '',
      searchKeyword: '',
      selectedComponentType: 'all',
    });
    this.loadCatalog();
  },

  onGroupTap(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/group/detail?id=${encodeURIComponent(id)}`,
    });
  },

  onProductTap(event) {
    wx.navigateTo({
      url: `/pages/product/detail?id=${event.currentTarget.dataset.id}`,
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
});
