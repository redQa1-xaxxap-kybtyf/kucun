const {
  hideAdminShareMenu,
  requireAdminSession,
} = require('../../utils/admin');
const { getProducts } = require('../../utils/products');
const { createSalesOrder, getCustomers } = require('../../utils/sales');

const UNIT_LABELS = {
  piece: '件',
  sheet: '片',
  package: '件',
};

function todayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function money(value) {
  return Math.round(value * 100) / 100;
}

function roundQuantity(value) {
  return Math.round(value * 100) / 100;
}

function formatPieceCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

function normalizeUnitLabel(unit) {
  return UNIT_LABELS[unit] || unit || '片';
}

function getSheetQuantity(item) {
  const displayQuantity = toNumber(item.quantity);
  const piecesPerUnit = toNumber(item.piecesPerUnit) || 1;

  if (item.unit === '件' && piecesPerUnit > 1) {
    return roundQuantity(displayQuantity * piecesPerUnit);
  }

  return roundQuantity(displayQuantity);
}

function buildStockText(availableQuantity, unit, piecesPerUnit) {
  const availableText = formatPieceCount(availableQuantity);

  if (unit === '件' && piecesPerUnit > 1) {
    const packageQuantity = availableQuantity / piecesPerUnit;
    return `可用 ${formatPieceCount(packageQuantity)} 件（${availableText} 片）`;
  }

  if (piecesPerUnit > 1) {
    const packageQuantity = availableQuantity / piecesPerUnit;
    return `可用 ${availableText} 片（约 ${formatPieceCount(packageQuantity)} 件）`;
  }

  return `可用 ${availableText} ${unit || '片'}`;
}

function getPhoneTail(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
}

function buildCustomerDisplay(customer) {
  const name = customer.name || '-';
  const phoneTail = getPhoneTail(customer.phone);
  return phoneTail ? `${name} (${phoneTail})` : name;
}

function buildItemSummary(item) {
  const quantity = toNumber(item.quantity);
  const unitPrice = toNumber(item.unitPrice);
  const piecesPerUnit = toNumber(item.piecesPerUnit) || 1;
  const unit = item.unit || '片';
  const availableQuantity = toNumber(item.availableQuantity);
  const sheetQuantity = getSheetQuantity({ ...item, unit, piecesPerUnit });
  const subtotal = money(quantity * unitPrice);

  let subtotalText = '';
  if (quantity > 0 && unitPrice > 0) {
    subtotalText = `¥${subtotal.toFixed(2)}`;
  }

  let quantityHelperText = '';
  if (quantity > 0 && unit === '件' && piecesPerUnit > 1) {
    quantityHelperText = `折合 ${formatPieceCount(sheetQuantity)} 片`;
  } else if (quantity > 0 && piecesPerUnit > 1) {
    const wholePackages = Math.floor(quantity / piecesPerUnit);
    const remainder = quantity - wholePackages * piecesPerUnit;
    if (remainder === 0 && wholePackages > 0) {
      quantityHelperText = `约 ${wholePackages} 件`;
    } else if (wholePackages > 0) {
      quantityHelperText = `约 ${wholePackages} 件 + ${formatPieceCount(remainder)} ${unit}`;
    } else {
      quantityHelperText = `不足 1 件`;
    }
  }

  return {
    ...item,
    availableText: buildStockText(availableQuantity, unit, piecesPerUnit),
    sheetQuantity,
    subtotal,
    subtotalText,
    quantityHelperText,
    quantityLabel: `数量（${unit}）`,
    priceLabel: `单价（元/${unit}）`,
    packageInfoText:
      piecesPerUnit > 1 ? `1 件 = ${formatPieceCount(piecesPerUnit)} 片` : '',
  };
}

function normalizeProduct(product) {
  const inventory = product.inventory || {};
  const piecesPerUnit = toNumber(product.piecesPerUnit) || 1;
  const unit = normalizeUnitLabel(product.unit || product.unitLabel);
  const availableQuantity = toNumber(inventory.availableQuantity);
  const thumbnailUrl =
    product.thumbnailUrl ||
    product.coverImageUrl ||
    product.imageUrl ||
    (Array.isArray(product.images) && product.images[0]) ||
    '';
  return {
    id: product.id,
    code: product.code || '-',
    name: product.name || '-',
    specification: product.specification || '',
    thumbnailUrl,
    piecesPerUnit,
    unit,
    availableQuantity,
    availableText: buildStockText(availableQuantity, unit, piecesPerUnit),
  };
}

function normalizeCustomer(customer) {
  const phone = customer.phone || '';
  const address = customer.address || '';
  return {
    id: customer.id,
    name: customer.name || '-',
    phone,
    address,
    displayName: buildCustomerDisplay({
      name: customer.name || '-',
      phone,
    }),
    displayMeta: phone || address || '客户',
  };
}

Page({
  data: {
    customerSearch: '',
    customers: [],
    itemTotal: '0.00',
    items: [],
    isSaving: false,
    loadingCustomers: false,
    loadingProducts: false,
    orderDate: todayText(),
    productSearch: '',
    products: [],
    remarks: '',
    savingStatus: '',
    selectedCustomer: null,
  },

  onLoad() {
    hideAdminShareMenu();

    const session = requireAdminSession();
    if (!session) return;
    this.loadCustomers();
  },

  onCustomerSearchInput(event) {
    this.setData({ customerSearch: event.detail.value });
  },

  onCustomerSearchConfirm() {
    this.loadCustomers();
  },

  async loadCustomers() {
    this.setData({ loadingCustomers: true });
    try {
      const data = await getCustomers({
        search: this.data.customerSearch.trim(),
      });
      this.setData({
        customers: (data.data || []).map(normalizeCustomer),
        loadingCustomers: false,
      });
    } catch (error) {
      this.setData({ loadingCustomers: false });
      wx.showToast({
        title: error.message || '客户加载失败',
        icon: 'none',
      });
    }
  },

  onCustomerTap(event) {
    const customer = this.data.customers.find(
      item => item.id === event.currentTarget.dataset.id
    );
    if (!customer) return;
    this.setData({ selectedCustomer: customer });
  },

  onOrderDateChange(event) {
    this.setData({ orderDate: event.detail.value });
  },

  onProductSearchInput(event) {
    this.setData({ productSearch: event.detail.value });
  },

  onProductSearchConfirm() {
    if (!this.data.productSearch.trim()) {
      wx.showToast({ title: '请输入产品关键词', icon: 'none' });
      return;
    }
    this.loadProducts();
  },

  async loadProducts() {
    this.setData({ loadingProducts: true });
    try {
      const data = await getProducts({
        limit: 12,
        search: this.data.productSearch.trim(),
        status: 'active',
      });
      this.setData({
        loadingProducts: false,
        products: (data.data || []).map(normalizeProduct),
      });
    } catch (error) {
      this.setData({ loadingProducts: false });
      wx.showToast({
        title: error.message || '产品加载失败',
        icon: 'none',
      });
    }
  },

  onProductTap(event) {
    const product = this.data.products.find(
      item => item.id === event.currentTarget.dataset.id
    );
    if (!product) return;

    if (this.data.items.some(item => item.productId === product.id)) {
      wx.showToast({ title: '该产品已添加', icon: 'none' });
      return;
    }

    const items = this.data.items.concat({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      specification: product.specification,
      piecesPerUnit: product.piecesPerUnit,
      unit: normalizeUnitLabel(product.unit),
      availableQuantity: product.availableQuantity,
      availableText: product.availableText,
      quantity: '',
      unitPrice: '',
    });
    this.updateItems(items);
  },

  onItemInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    const items = this.data.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: event.detail.value } : item
    );
    this.updateItems(items);
  },

  onRemoveItem(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.updateItems(this.data.items.filter((_, itemIndex) => itemIndex !== index));
  },

  onRemarksInput(event) {
    this.setData({ remarks: event.detail.value });
  },

  updateItems(items) {
    const enriched = items.map(item => buildItemSummary(item));
    const total = enriched.reduce(
      (sum, item) => sum + toNumber(item.subtotal),
      0
    );
    this.setData({
      itemTotal: money(total).toFixed(2),
      items: enriched,
    });
  },

  validateOrder(status) {
    if (!this.data.selectedCustomer) return '请选择客户';
    if (this.data.items.length === 0) return '请至少添加一个产品';

    for (let i = 0; i < this.data.items.length; i += 1) {
      const item = this.data.items[i];
      if (toNumber(item.quantity) <= 0) {
        return `第 ${i + 1} 行数量必须大于 0`;
      }
      if (
        status === 'confirmed' &&
        getSheetQuantity(item) > toNumber(item.availableQuantity)
      ) {
        return `第 ${i + 1} 行数量超过可用库存（${item.availableText || '库存不足'}）`;
      }
      if (toNumber(item.unitPrice) < 0) {
        return `第 ${i + 1} 行单价不能为负`;
      }
    }

    if (status === 'confirmed' && Number(this.data.itemTotal) <= 0) {
      return '确认开单前请填写单价';
    }

    return '';
  },

  buildPayload(status) {
    return {
      customerId: this.data.selectedCustomer.id,
      status,
      orderType: 'NORMAL',
      orderDate: this.data.orderDate,
      remarks: this.data.remarks.trim(),
      items: this.data.items.map(item => {
        const displayQuantity = toNumber(item.quantity);
        const rawUnitPrice = toNumber(item.unitPrice);
        const quantity = getSheetQuantity(item);
        const subtotal = money(displayQuantity * rawUnitPrice);
        const pieceUnitPrice =
          item.unit === '件' && quantity > 0
            ? money(subtotal / quantity)
            : rawUnitPrice;
        return {
          productId: item.productId,
          productCode: item.productCode,
          specification: item.specification,
          quantity,
          unitPrice: pieceUnitPrice,
          displayUnit: item.unit || '片',
          displayQuantity,
          piecesPerUnit: item.piecesPerUnit || 1,
          subtotal,
        };
      }),
      feeItems: [],
    };
  },

  onSaveDraft() {
    this.submitOrder('draft');
  },

  onConfirmOrder() {
    if (this.data.isSaving) return;

    const message = this.validateOrder('confirmed');
    if (message) {
      wx.showToast({ title: message, icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认开单',
      content: `${this.data.selectedCustomer.displayName || this.data.selectedCustomer.name}\n${this.data.items.length} 个产品，合计 ¥${this.data.itemTotal}\n确认后会进入正式销售流程。`,
      confirmText: '确认',
      success: result => {
        if (result.confirm) {
          this.submitOrder('confirmed');
        }
      },
    });
  },

  async submitOrder(status) {
    if (this.data.isSaving) return;

    const message = this.validateOrder(status);
    if (message) {
      wx.showToast({ title: message, icon: 'none' });
      return;
    }

    this.setData({ isSaving: true, savingStatus: status });
    try {
      const order = await createSalesOrder(this.buildPayload(status));
      wx.showModal({
        title: '开单成功',
        content: `销售单 ${order.orderNumber || ''} 已创建`,
        showCancel: false,
        success: () => {
          wx.navigateBack();
        },
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '开单失败',
        icon: 'none',
      });
    } finally {
      this.setData({ isSaving: false, savingStatus: '' });
    }
  },

});
