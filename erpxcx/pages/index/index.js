const { getCatalog } = require('../../utils/catalog');

function resolveViewMeta(data, selectedSeriesId, selectedComponentType) {
  const series =
    (data.series || []).find(item => item.id === selectedSeriesId) ||
    (data.series || [])[0] ||
    {};
  const component =
    (data.components || []).find(item => item.id === selectedComponentType) ||
    (data.components || [])[0] ||
    {};

  return {
    resultSummary: `${(data.groups || []).length}组 · ${(data.products || []).length}款`,
    selectedComponentLabel: component.label || '全部',
    selectedSeriesName: series.name || '热门',
  };
}

Page({
  data: {
    loading: true,
    error: '',
    selectedSeriesId: 'hot',
    selectedComponentType: 'all',
    selectedSeriesName: '热门',
    selectedComponentLabel: '全部',
    resultSummary: '',
    search: '',
    series: [],
    components: [],
    groups: [],
    products: [],
  },

  onLoad(options) {
    this.setData({
      selectedSeriesId: options.seriesId || 'hot',
      selectedComponentType: options.componentType || 'all',
    });
    this.loadCatalog();
  },

  onShow() {
    if (wx.showShareMenu) {
      wx.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    }
  },

  onPullDownRefresh() {
    this.loadCatalog().finally(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage() {
    const { selectedSeriesId, selectedComponentType } = this.data;
    return {
      title: '外墙罗马柱花色货架',
      path: `/pages/index/index?seriesId=${selectedSeriesId}&componentType=${selectedComponentType}`,
    };
  },

  onShareTimeline() {
    const { selectedSeriesId, selectedComponentType } = this.data;
    return {
      title: '外墙罗马柱花色货架',
      query: `seriesId=${selectedSeriesId}&componentType=${selectedComponentType}`,
    };
  },

  async loadCatalog() {
    this.setData({ loading: true, error: '' });

    try {
      const data = await getCatalog({
        seriesId: this.data.selectedSeriesId,
        componentType: this.data.selectedComponentType,
        search: this.data.search,
      });

      this.setData({
        series: data.series || [],
        components: data.components || [],
        groups: data.groups || [],
        products: data.products || [],
        ...resolveViewMeta(
          data,
          this.data.selectedSeriesId,
          this.data.selectedComponentType
        ),
        loading: false,
      });
    } catch (error) {
      this.setData({
        error: error.message || '加载失败',
        loading: false,
      });
    }
  },

  onSeriesTap(event) {
    const seriesId = event.currentTarget.dataset.id;
    this.setData({
      selectedSeriesId: seriesId,
      selectedComponentType: 'all',
    });
    this.loadCatalog();
  },

  onComponentTap(event) {
    this.setData({
      selectedComponentType: event.currentTarget.dataset.id,
    });
    this.loadCatalog();
  },

  onSearchInput(event) {
    this.setData({
      search: event.detail.value,
    });
  },

  onSearchConfirm() {
    this.setData({
      selectedSeriesId: this.data.search ? 'hot' : this.data.selectedSeriesId,
      selectedComponentType: 'all',
    });
    this.loadCatalog();
  },

  onClearSearch() {
    this.setData({ search: '' });
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
});
