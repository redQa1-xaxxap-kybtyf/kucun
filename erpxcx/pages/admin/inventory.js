const {
  hideAdminShareMenu,
  requireAdminSession,
} = require('../../utils/admin');
const { getInventories } = require('../../utils/inventory');

const PAGE_SIZE = 30;
const UNIT_LABELS = {
  piece: '件',
  sheet: '片',
};

function formatQuantity(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatNumberText(value) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return '';
  return Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toFixed(2).replace(/\.?0+$/, '');
}

function getUnitLabel(unit) {
  return UNIT_LABELS[unit] || unit || '片';
}

function buildPackageText(item, product) {
  const unitLabel = getUnitLabel(product.unit);
  const piecesPerUnit = Number(
    item.batchPiecesPerUnit || product.piecesPerUnit || 0
  );
  const weightText = formatNumberText(item.weight || product.weight);
  const parts = [];

  if (piecesPerUnit > 1) {
    parts.push(`1件=${formatNumberText(piecesPerUnit)}片`);
  }
  if (weightText) {
    parts.push(`${weightText}kg/${unitLabel}`);
  }
  if (parts.length === 0 && unitLabel) {
    parts.push(`单位：${unitLabel}`);
  }

  return parts.join(' · ');
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

  const thumbnailUrl =
    product.thumbnailUrl ||
    product.coverImageUrl ||
    product.imageUrl ||
    (Array.isArray(product.images) && product.images[0]) ||
    '';

  return {
    id:
      item.id ||
      product.id ||
      `${product.code || ''}-${item.batchNumber || ''}`,
    productId: product.id || item.productId,
    code: product.code || item.productCode || '-',
    name: product.name || item.productName || '-',
    specification: product.specification || item.specification || '',
    thumbnailUrl,
    packageText: buildPackageText(item, product),
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
    hasMore: false,
    search: '',
    inventories: [],
    page: 1,
    pagination: null,
  },

  onLoad() {
    hideAdminShareMenu();

    const session = requireAdminSession();
    if (!session) return;
    this.loadInventories();
  },

  onPullDownRefresh() {
    this.loadInventories({ reset: true }).finally(() =>
      wx.stopPullDownRefresh()
    );
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    this.loadInventories({ append: true });
  },

  onSearchInput(event) {
    this.setData({ search: event.detail.value });
  },

  onSearchConfirm() {
    this.loadInventories({ reset: true });
  },

  onClearSearch() {
    this.setData({ search: '' });
    this.loadInventories({ reset: true });
  },

  onRetryTap() {
    this.loadInventories({ reset: true });
  },

  async loadInventories(options = {}) {
    const append = Boolean(options.append);
    const page = append ? this.data.page : 1;
    this.setData({ loading: true, error: '' });

    try {
      const data = await getInventories({
        page,
        limit: PAGE_SIZE,
        search: this.data.search.trim(),
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
      const list = (data.inventories || []).map(normalizeInventory);
      const pagination = data.pagination || null;
      const inventories = append ? this.data.inventories.concat(list) : list;
      const hasMore = Boolean(
        pagination && pagination.page < pagination.totalPages
      );

      this.setData({
        hasMore,
        inventories,
        page: page + 1,
        pagination,
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

});
