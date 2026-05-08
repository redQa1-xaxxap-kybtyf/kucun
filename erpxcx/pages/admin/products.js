const {
  hideAdminShareMenu,
  requireAdminSession,
} = require('../../utils/admin');
const { getProducts } = require('../../utils/products');

const STATUS_TABS = [
  { label: '正常产品', value: 'active' },
  { label: '全部', value: 'all' },
  { label: '已停用', value: 'inactive' },
];

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

function normalizeProduct(item) {
  const inventory = item.inventory || {};
  const images = Array.isArray(item.images) ? item.images : [];
  const totalQuantity = formatQuantity(inventory.totalQuantity);
  const availableQuantity = formatQuantity(inventory.availableQuantity);

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
  };
}

Page({
  data: {
    error: '',
    hasMore: false,
    loading: false,
    page: 1,
    pagination: null,
    products: [],
    search: '',
    status: 'active',
    statusTabs: STATUS_TABS,
  },

  onLoad() {
    hideAdminShareMenu();

    const session = requireAdminSession();
    if (!session) return;
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

  onStatusTap(event) {
    this.setData({
      page: 1,
      products: [],
      status: event.currentTarget.dataset.status,
    });
    this.loadProducts({ reset: true });
  },

  onEditTap(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({
        title: '产品ID缺失，请刷新后重试',
        icon: 'none',
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/admin/product-form?id=${encodeURIComponent(id)}`,
    });
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
    this.setData({ loading: true, error: '' });

    try {
      const params = {
        page,
        limit: 20,
        search: this.data.search.trim(),
      };
      if (this.data.status !== 'all') {
        params.status = this.data.status;
      }

      const data = await getProducts(params);
      const list = (data.data || []).map(normalizeProduct);
      const pagination = data.pagination || null;
      const products = reset ? list : this.data.products.concat(list);
      const hasMore = Boolean(
        pagination && pagination.page < pagination.totalPages
      );

      this.setData({
        hasMore,
        loading: false,
        page: page + 1,
        pagination,
        products,
      });
    } catch (error) {
      const message = error.message || '产品加载失败';
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

});
