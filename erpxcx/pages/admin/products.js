const { requireAdminSession } = require('../../utils/admin');
const {
  deleteProduct,
  getProducts,
  updateProductStatus,
} = require('../../utils/products');

const STATUS_TABS = [
  { label: '正常', value: 'active' },
  { label: '全部', value: 'all' },
  { label: '已下架', value: 'inactive' },
];

function formatQuantity(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeProduct(item) {
  const inventory = item.inventory || {};
  const statistics = item.statistics || {};
  const images = Array.isArray(item.images) ? item.images : [];
  const totalQuantity = formatQuantity(inventory.totalQuantity);
  const availableQuantity = formatQuantity(inventory.availableQuantity);
  const inventoryRecordsCount = formatQuantity(
    statistics.inventoryRecordsCount
  );
  const salesOrderItemsCount = formatQuantity(
    statistics.salesOrderItemsCount
  );
  const inboundRecordsCount = formatQuantity(statistics.inboundRecordsCount);
  const hasBusinessRecords =
    totalQuantity > 0 ||
    inventoryRecordsCount > 0 ||
    salesOrderItemsCount > 0 ||
    inboundRecordsCount > 0;

  return {
    id: item.id,
    code: item.code || '-',
    name: item.name || '-',
    specification: item.specification || '未填写规格',
    categoryName: item.category ? item.category.name : '未分类',
    coverUrl: item.thumbnailUrl || (images[0] && images[0].url) || '',
    status: item.status || 'active',
    statusLabel: item.status === 'inactive' ? '已下架' : '正常',
    totalQuantity,
    availableQuantity,
    canDelete: !hasBusinessRecords,
    blockReason:
      '已有库存、入库记录或销售记录。为保证账实一致，请下架，不要删除。',
  };
}

Page({
  data: {
    actionId: '',
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
    const session = requireAdminSession();
    if (!session) return;
    this.loadProducts({ reset: true });
  },

  onShow() {
    if (this.data.products.length > 0) {
      this.loadProducts({ reset: true });
    }
  },

  onPullDownRefresh() {
    this.loadProducts({ reset: true }).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    this.loadProducts();
  },

  onSearchInput(event) {
    this.setData({ search: event.detail.value });
  },

  onSearchConfirm() {
    this.loadProducts({ reset: true });
  },

  onClearSearch() {
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

  onAddTap() {
    wx.navigateTo({
      url: '/pages/admin/product-form',
    });
  },

  onEditTap(event) {
    wx.navigateTo({
      url: `/pages/admin/product-form?id=${event.currentTarget.dataset.id}`,
    });
  },

  async loadProducts(options = {}) {
    if (this.data.loading) return;

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
  },

  onToggleStatus(event) {
    const id = event.currentTarget.dataset.id;
    const product = this.data.products.find(item => item.id === id);
    if (!product) return;

    const nextStatus = product.status === 'active' ? 'inactive' : 'active';
    const actionText = nextStatus === 'active' ? '上架' : '下架';

    wx.showModal({
      title: `${actionText}产品`,
      content: `${actionText}后会同步影响小程序前台展示。`,
      confirmText: actionText,
      success: async result => {
        if (!result.confirm) return;
        await this.updateStatus(id, nextStatus);
      },
    });
  },

  onDeleteTap(event) {
    const id = event.currentTarget.dataset.id;
    const product = this.data.products.find(item => item.id === id);
    if (!product) return;

    if (!product.canDelete) {
      wx.showModal({
        title: '不能直接删除',
        content: product.blockReason,
        cancelText: '知道了',
        confirmText: '下架',
        success: async result => {
          if (result.confirm) {
            await this.updateStatus(id, 'inactive');
          }
        },
      });
      return;
    }

    wx.showModal({
      title: '删除产品',
      content: `确定删除 ${product.name}？删除后不可恢复。`,
      confirmText: '删除',
      confirmColor: '#b42318',
      success: async result => {
        if (!result.confirm) return;
        await this.deleteProduct(id);
      },
    });
  },

  async updateStatus(id, status) {
    this.setData({ actionId: id });
    try {
      await updateProductStatus(id, status);
      wx.showToast({ title: status === 'active' ? '已上架' : '已下架' });
      await this.loadProducts({ reset: true });
    } catch (error) {
      wx.showToast({
        title: error.message || '操作失败',
        icon: 'none',
      });
    } finally {
      this.setData({ actionId: '' });
    }
  },

  async deleteProduct(id) {
    this.setData({ actionId: id });
    try {
      await deleteProduct(id);
      wx.showToast({ title: '已删除' });
      await this.loadProducts({ reset: true });
    } catch (error) {
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'none',
      });
    } finally {
      this.setData({ actionId: '' });
    }
  },
});
