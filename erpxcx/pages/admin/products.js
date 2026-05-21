const {
  hideAdminShareMenu,
  requireAdminSession,
} = require('../../utils/admin');
const { markCatalogDirty } = require('../../utils/catalog-cache');
const {
  getCatalogSettings,
  updateProductCatalogDisplays,
} = require('../../utils/catalog-settings');
const { getProducts } = require('../../utils/products');

const STATUS_TABS = [
  { label: '已上架', value: 'visible' },
  { label: '待设置', value: 'unconfigured' },
  { label: '已隐藏', value: 'hidden' },
  { label: '全部', value: 'all' },
  { label: '已停用', value: 'inactive' },
];

const FETCH_ALL_PAGE_LIMIT = 100;
const FETCH_ALL_MAX_PAGES = 50;
const BATCH_UPDATE_CHUNK_SIZE = 200;

let searchTimer = null;
let pendingSearchReload = false;

function formatQuantity(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getCategoryDisplayName(category) {
  if (!category) return '未分类';

  const fullPath = String(category.fullPath || '').trim();
  if (fullPath) return fullPath;

  const name = String(category.name || '').trim();
  if (!name) return '未分类';

  const parentName = getCategoryDisplayName(category.parent);
  return parentName && parentName !== '未分类'
    ? `${parentName} / ${name}`
    : name;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  return [];
}

function isClientDisplayFilter(status) {
  return ['visible', 'unconfigured', 'hidden'].includes(status);
}

function getServerStatus(status) {
  if (isClientDisplayFilter(status)) return 'active';
  if (status === 'inactive') return 'inactive';
  if (status === 'active') return 'active';
  return '';
}

function getPageLimitForStatus(status) {
  return status === 'hidden' || status === 'unconfigured'
    ? FETCH_ALL_PAGE_LIMIT
    : 20;
}

function matchesProductStatus(product, status) {
  if (status === 'all') return true;
  if (status === 'inactive') return product.status !== 'active';
  if (status === 'hidden') {
    return product.status === 'active' && product.hidden;
  }
  if (status === 'unconfigured') {
    return product.status === 'active' && !product.hidden && !product.configured;
  }
  if (status === 'visible') {
    return product.status === 'active' && !product.hidden;
  }

  return product.status === status;
}

function normalizeProduct(item, context = {}) {
  const inventory = item.inventory || {};
  const images = Array.isArray(item.images) ? item.images : [];
  const totalQuantity = formatQuantity(inventory.totalQuantity);
  const availableQuantity = formatQuantity(inventory.availableQuantity);
  const overrides = context.overrides || {};
  const seriesMap = context.seriesMap || {};
  const componentMap = context.componentMap || {};
  const override = overrides[item.id] || {};
  const seriesName = override.seriesId ? seriesMap[override.seriesId] : '';
  const componentName = override.componentType
    ? componentMap[override.componentType]
    : '';
  const configured = Boolean(seriesName && componentName);
  const hidden = override.visible === false;
  const active = item.status === 'active';
  let displayBadge;
  let displayBadgeClass;
  let displayState;
  let miniStatusLabel;

  if (!active) {
    displayBadge = configured ? `${seriesName} · ${componentName}` : '商品已停用';
    displayBadgeClass = 'inactive';
    displayState = 'inactive';
    miniStatusLabel = '已停用';
  } else if (hidden) {
    displayBadge = configured ? `${seriesName} · ${componentName}` : '未设置分类';
    displayBadgeClass = 'hidden';
    displayState = 'hidden';
    miniStatusLabel = '已隐藏';
  } else if (configured) {
    displayBadge = `${seriesName} · ${componentName}`;
    displayBadgeClass = 'configured';
    displayState = 'visible';
    miniStatusLabel = '已上架';
  } else {
    displayBadge = '还没选花色和品种';
    displayBadgeClass = 'unconfigured';
    displayState = 'unconfigured';
    miniStatusLabel = '未上架';
  }

  return {
    id: item.id,
    code: item.code || '-',
    name: item.name || '-',
    specification: item.specification || '未填写规格',
    categoryName: getCategoryDisplayName(item.category),
    coverUrl: item.thumbnailUrl || (images[0] && images[0].url) || '',
    status: item.status || 'active',
    statusLabel: item.status === 'inactive' ? '已停用' : '正常',
    stockText: totalQuantity > 0 ? `库存 ${totalQuantity}` : '暂无库存',
    availableText: availableQuantity > 0 ? `可用 ${availableQuantity}` : '',
    totalQuantity,
    availableQuantity,
    configured,
    hidden,
    displayBadge,
    displayBadgeClass,
    displayState,
    miniStatusLabel,
    selected: Boolean((context.selectedProductIds || {})[item.id]),
  };
}

function getOptionName(items, index, field) {
  const item = items[index];
  return item ? item[field] || '请选择' : '请选择';
}

Page({
  data: {
    error: '',
    hasMore: false,
    batchMode: false,
    batchSaving: false,
    batchVisible: true,
    batchSeriesIndex: -1,
    batchComponentIndex: -1,
    batchSeriesName: '请选择花色',
    batchComponentName: '请选择品种',
    colorSeries: [],
    componentTypes: [],
    seriesMap: {},
    componentMap: {},
    productOverrides: {},
    loading: false,
    loadingAll: false,
    page: 1,
    pagination: null,
    products: [],
    search: '',
    selectAllProgress: '',
    selectedCount: 0,
    selectedProductIds: {},
    status: 'visible',
    statusTabs: STATUS_TABS,
  },

  onLoad() {
    hideAdminShareMenu();

    const session = requireAdminSession();
    if (!session) return;
    this.loadCatalogOptions();
    this.loadProducts({ reset: true });
  },

  onShow() {
    hideAdminShareMenu();

    if (this.data.products.length > 0) {
      this.loadProducts({ reset: true });
    }
  },

  onPullDownRefresh() {
    this.loadProducts({ reset: true }).finally(() => wx.stopPullDownRefresh());
  },

  onUnload() {
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
    pendingSearchReload = false;
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    this.loadProducts();
  },

  onSearchInput(event) {
    this.setData({ search: event.detail.value });

    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    searchTimer = setTimeout(() => {
      searchTimer = null;
      this.loadProducts({ reset: true });
    }, 500);
  },

  onSearchConfirm() {
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
    this.loadProducts({ reset: true });
  },

  onClearSearch() {
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
    this.setData({ search: '' });
    this.loadProducts({ reset: true });
  },

  onRetryTap() {
    this.loadProducts({ reset: true });
  },

  onStatusTap(event) {
    const nextStatus = event.currentTarget.dataset.status;
    if (nextStatus === this.data.status) return;
    this.setData({
      page: 1,
      products: [],
      status: nextStatus,
    });
    this.loadProducts({ reset: true });
  },

  onEditTap(event) {
    if (this.data.batchMode) {
      this.onToggleProductSelect(event);
      return;
    }

    const id = event.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({
        title: '商品ID缺失，请刷新后重试',
        icon: 'none',
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/admin/product-form?id=${encodeURIComponent(id)}`,
    });
  },

  async loadCatalogOptions() {
    try {
      const settings = await getCatalogSettings();
      const colorSeries = normalizeList(settings.colorSeries).filter(
        item => item && item.id && item.visible !== false
      );
      const componentTypes = normalizeList(settings.componentTypes).filter(
        item => item && item.id && item.visible !== false
      );
      const allSeries = normalizeList(settings.colorSeries);
      const allComponents = normalizeList(settings.componentTypes);
      const seriesMap = {};
      allSeries.forEach(item => {
        if (item && item.id) seriesMap[item.id] = item.name || item.id;
      });
      const componentMap = {};
      allComponents.forEach(item => {
        if (item && item.id) componentMap[item.id] = item.label || item.id;
      });
      const productOverrides = settings.productOverrides || {};

      this.setData({
        colorSeries,
        componentTypes,
        seriesMap,
        componentMap,
        productOverrides,
        batchSeriesIndex: colorSeries.length > 0 ? 0 : -1,
        batchComponentIndex: componentTypes.length > 0 ? 0 : -1,
        batchSeriesName: getOptionName(colorSeries, 0, 'name'),
        batchComponentName: getOptionName(componentTypes, 0, 'label'),
        products: this.applySelection(
          this.data.products,
          this.data.selectedProductIds
        ),
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '分类加载失败',
        icon: 'none',
      });
    }
  },

  applySelection(products, selectedProductIds) {
    return products.map(product => ({
      ...product,
      selected: Boolean(selectedProductIds[product.id]),
    }));
  },

  updateSelectedState(selectedProductIds) {
    this.setData({
      selectedProductIds,
      selectedCount: Object.keys(selectedProductIds).length,
      products: this.applySelection(this.data.products, selectedProductIds),
    });
  },

  onBatchModeTap() {
    if (this.data.colorSeries.length === 0 || this.data.componentTypes.length === 0) {
      this.loadCatalogOptions();
    }

    this.setData({ batchMode: true });
  },

  onCancelBatchTap() {
    this.setData({ batchMode: false });
  },

  onToggleProductSelect(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;

    const selectedProductIds = { ...this.data.selectedProductIds };
    if (selectedProductIds[id]) {
      delete selectedProductIds[id];
    } else {
      selectedProductIds[id] = true;
    }

    this.updateSelectedState(selectedProductIds);
  },

  onSelectPageTap() {
    const products = this.data.products || [];
    if (products.length === 0) return;

    const allSelected = products.every(
      product => this.data.selectedProductIds[product.id]
    );
    const selectedProductIds = { ...this.data.selectedProductIds };

    for (const product of products) {
      if (allSelected) {
        delete selectedProductIds[product.id];
      } else {
        selectedProductIds[product.id] = true;
      }
    }

    this.updateSelectedState(selectedProductIds);
  },

  onBatchSeriesChange(event) {
    const index = Number(event.detail.value);
    this.setData({
      batchSeriesIndex: index,
      batchSeriesName: getOptionName(this.data.colorSeries, index, 'name'),
    });
  },

  onBatchComponentChange(event) {
    const index = Number(event.detail.value);
    this.setData({
      batchComponentIndex: index,
      batchComponentName: getOptionName(this.data.componentTypes, index, 'label'),
    });
  },

  onBatchVisibleChange(event) {
    this.setData({ batchVisible: event.detail.value });
  },

  async onApplyBatchTap() {
    const rawIds = Object.keys(this.data.selectedProductIds);
    const productIds = rawIds
      .map(id => String(id || '').trim())
      .filter(id => id.length > 0 && id.length <= 64);
    const series = this.data.colorSeries[this.data.batchSeriesIndex];
    const component = this.data.componentTypes[this.data.batchComponentIndex];

    if (productIds.length === 0) {
      wx.showToast({ title: '请先选择商品', icon: 'none' });
      return;
    }

    if (!series || !series.id || !component || !component.id) {
      wx.showToast({ title: '请选择花色和品种', icon: 'none' });
      return;
    }

    if (rawIds.length !== productIds.length) {
      console.warn('[products] 选中列表里有非法 id 已被过滤', {
        before: rawIds.length,
        after: productIds.length,
      });
    }

    this.setData({ batchSaving: true });

    try {
      const display = {
        seriesId: String(series.id),
        componentType: String(component.id),
        visible: Boolean(this.data.batchVisible),
      };
      let savedCount = 0;
      for (let offset = 0; offset < productIds.length; offset += BATCH_UPDATE_CHUNK_SIZE) {
        const chunk = productIds.slice(offset, offset + BATCH_UPDATE_CHUNK_SIZE);
        await updateProductCatalogDisplays(chunk, display);
        savedCount += chunk.length;
        if (productIds.length > BATCH_UPDATE_CHUNK_SIZE) {
          this.setData({
            selectAllProgress: `保存中 ${savedCount}/${productIds.length}`,
          });
        }
      }
      markCatalogDirty();
      wx.showToast({ title: `已设置 ${productIds.length} 个商品` });
      this.updateSelectedState({});
      this.setData({
        batchMode: false,
        batchSaving: false,
        selectAllProgress: '',
      });
      await this.loadCatalogOptions();
      this.loadProducts({ reset: true });
    } catch (error) {
      console.error('[products] 批量保存失败', {
        message: error.message,
        details: error.details,
        response: error.response,
      });
      this.setData({ batchSaving: false, selectAllProgress: '' });
      wx.showToast({
        title: error.message || '批量保存失败',
        icon: 'none',
      });
    }
  },

  async onSelectAllFilteredTap() {
    if (this.data.loadingAll) return;
    this.setData({ loadingAll: true, selectAllProgress: '正在统计...' });
    try {
      const ids = await this.fetchAllFilteredIds(progress => {
        this.setData({ selectAllProgress: progress });
      });
      const selectedProductIds = { ...this.data.selectedProductIds };
      ids.forEach(id => {
        selectedProductIds[id] = true;
      });
      this.updateSelectedState(selectedProductIds);
      this.setData({ loadingAll: false, selectAllProgress: '' });
      wx.showToast({ title: `已选 ${ids.length} 个商品` });
    } catch (error) {
      this.setData({ loadingAll: false, selectAllProgress: '' });
      wx.showToast({
        title: error.message || '加载全部失败',
        icon: 'none',
      });
    }
  },

  async fetchAllFilteredIds(onProgress) {
    const ids = [];
    const overrides = this.data.productOverrides || {};
    const seriesMap = this.data.seriesMap || {};
    const componentMap = this.data.componentMap || {};
    const search = this.data.search.trim();
    const status = this.data.status;
    const serverStatus = getServerStatus(status);

    for (let page = 1; page <= FETCH_ALL_MAX_PAGES; page += 1) {
      const params = {
        page,
        limit: FETCH_ALL_PAGE_LIMIT,
        search,
      };
      if (serverStatus) {
        params.status = serverStatus;
      }

      const data = await getProducts(params);
      const list = data.data || [];
      list.forEach(item => {
        const product = normalizeProduct(item, {
          overrides,
          seriesMap,
          componentMap,
        });
        if (matchesProductStatus(product, status)) ids.push(product.id);
      });

      const pagination = data.pagination || null;
      if (onProgress) {
        onProgress(`已加载 ${ids.length} 个`);
      }
      if (!pagination || pagination.page >= pagination.totalPages) {
        break;
      }
    }

    return ids;
  },

  async loadProducts(options = {}) {
    if (this.data.loading) {
      if (options.reset) {
        pendingSearchReload = true;
      }
      return;
    }

    const reset = Boolean(options.reset);
    const page = reset ? 1 : this.data.page;
    const status = this.data.status;
    this.setData({ loading: true, error: '' });

    try {
      const products = reset ? [] : this.data.products;
      const result = await this.fetchProductsPage(page, status, products);

      this.setData({
        hasMore: result.hasMore,
        loading: false,
        page: result.nextPage,
        pagination: result.pagination,
        products: this.applySelection(
          result.products,
          this.data.selectedProductIds
        ),
      });
    } catch (error) {
      const message = error.message || '商品加载失败';
      this.setData({ error: message, loading: false });
      if (message.includes('未授权')) {
        wx.redirectTo({ url: '/pages/admin/login' });
      }
    }

    if (pendingSearchReload) {
      pendingSearchReload = false;
      this.loadProducts({ reset: true });
    }
  },

  async fetchProductsPage(startPage, status, accumulated) {
    const context = {
      overrides: this.data.productOverrides,
      seriesMap: this.data.seriesMap,
      componentMap: this.data.componentMap,
      selectedProductIds: this.data.selectedProductIds,
    };
    const targetSize = accumulated.length + 20;
    let page = startPage;
    let pagination = null;
    let products = accumulated.slice();
    const serverStatus = getServerStatus(status);
    const needsClientFilter = isClientDisplayFilter(status);

    while (page <= FETCH_ALL_MAX_PAGES) {
      const params = {
        page,
        limit: getPageLimitForStatus(status),
        search: this.data.search.trim(),
      };
      if (serverStatus) {
        params.status = serverStatus;
      }

      const data = await getProducts(params);
      pagination = data.pagination || null;
      const list = (data.data || [])
        .map(item => normalizeProduct(item, context))
        .filter(product => matchesProductStatus(product, status));
      products = products.concat(list);
      page += 1;

      const hasNext = Boolean(
        pagination && pagination.page < pagination.totalPages
      );
      if (!needsClientFilter) break;
      if (!hasNext) break;
      if (products.length >= targetSize) break;
    }

    const finalHasMore = Boolean(
      pagination &&
        pagination.page < pagination.totalPages &&
        page <= FETCH_ALL_MAX_PAGES
    );

    return {
      products,
      pagination,
      hasMore: finalHasMore,
      nextPage: page,
    };
  },

});
