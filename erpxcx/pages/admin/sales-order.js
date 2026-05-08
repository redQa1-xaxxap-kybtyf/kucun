const {
  hideAdminShareMenu,
  requireAdminSession,
} = require('../../utils/admin');
const { getProducts } = require('../../utils/products');
const { createSalesOrder, getCustomers } = require('../../utils/sales');

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

function normalizeProduct(product) {
  const inventory = product.inventory || {};
  return {
    id: product.id,
    code: product.code || '-',
    name: product.name || '-',
    specification: product.specification || '',
    piecesPerUnit: product.piecesPerUnit || 1,
    availableQuantity: toNumber(inventory.availableQuantity),
  };
}

function normalizeCustomer(customer) {
  return {
    id: customer.id,
    name: customer.name || '-',
    phone: customer.phone || '',
    address: customer.address || '',
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
      wx.showToast({ title: '已添加该产品', icon: 'none' });
      return;
    }

    const items = this.data.items.concat({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      specification: product.specification,
      piecesPerUnit: product.piecesPerUnit,
      availableQuantity: product.availableQuantity,
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
    const total = items.reduce(
      (sum, item) => sum + toNumber(item.quantity) * toNumber(item.unitPrice),
      0
    );
    this.setData({
      itemTotal: money(total).toFixed(2),
      items,
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
        const quantity = toNumber(item.quantity);
        const unitPrice = toNumber(item.unitPrice);
        return {
          productId: item.productId,
          productCode: item.productCode,
          specification: item.specification,
          quantity,
          unitPrice,
          displayUnit: '片',
          displayQuantity: quantity,
          piecesPerUnit: item.piecesPerUnit || 1,
          subtotal: money(quantity * unitPrice),
        };
      }),
      feeItems: [],
    };
  },

  onSaveDraft() {
    this.submitOrder('draft');
  },

  onConfirmOrder() {
    wx.showModal({
      title: '确认开单',
      content: '确认后会进入正式销售流程。若库存批次复杂，建议先保存草稿后在 PC 端完善。',
      confirmText: '确认',
      success: result => {
        if (result.confirm) {
          this.submitOrder('confirmed');
        }
      },
    });
  },

  async submitOrder(status) {
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
