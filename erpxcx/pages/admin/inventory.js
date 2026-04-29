const { requireAdminSession } = require('../../utils/admin');
const { getInventories } = require('../../utils/inventory');

function formatQuantity(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeInventory(item) {
  const product = item.product || {};
  const totalQuantity = formatQuantity(item.quantity || item.totalQuantity);
  const reservedQuantity = formatQuantity(item.reservedQuantity);
  const availableQuantity = formatQuantity(
    item.availableQuantity !== undefined
      ? item.availableQuantity
      : totalQuantity - reservedQuantity
  );

  return {
    id:
      item.id ||
      product.id ||
      `${product.code || ''}-${item.batchNumber || ''}`,
    productId: product.id || item.productId,
    code: product.code || item.productCode || '-',
    name: product.name || item.productName || '-',
    specification: product.specification || item.specification || '',
    batchNumber: item.batchNumber || '未填批次',
    location: item.location || '未填库位',
    quantity: totalQuantity,
    reservedQuantity,
    availableQuantity,
    stockStatus: availableQuantity > 0 ? '有货' : '暂缺',
  };
}

Page({
  data: {
    loading: false,
    error: '',
    search: '',
    inventories: [],
    pagination: null,
  },

  onLoad() {
    const session = requireAdminSession();
    if (!session) return;
    this.loadInventories();
  },

  onPullDownRefresh() {
    this.loadInventories().finally(() => wx.stopPullDownRefresh());
  },

  onSearchInput(event) {
    this.setData({ search: event.detail.value });
  },

  onSearchConfirm() {
    this.loadInventories();
  },

  onClearSearch() {
    this.setData({ search: '' });
    this.loadInventories();
  },

  async loadInventories() {
    this.setData({ loading: true, error: '' });

    try {
      const data = await getInventories({
        page: 1,
        limit: 30,
        search: this.data.search.trim(),
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      this.setData({
        inventories: (data.inventories || []).map(normalizeInventory),
        pagination: data.pagination || null,
        loading: false,
      });
    } catch (error) {
      const message = error.message || '库存加载失败';
      this.setData({
        error: message,
        loading: false,
      });

      if (message.includes('未授权')) {
        wx.redirectTo({
          url: '/pages/admin/login',
        });
      }
    }
  },

  onScanTap() {
    wx.scanCode({
      onlyFromCamera: false,
      success: result => {
        this.setData({ search: result.result });
        this.loadInventories();
      },
      fail: () => {
        wx.showToast({
          title: '未识别到编码',
          icon: 'none',
        });
      },
    });
  },
});
