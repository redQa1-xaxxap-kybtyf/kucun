const {
  hideAdminShareMenu,
  requireAdminSession,
} = require('../../utils/admin');
const { createPayment, getReceivableOrders } = require('../../utils/finance');
const { getCustomers } = require('../../utils/sales');

const PAYMENT_METHODS = [
  { label: '微信转账', value: 'wechat_transfer' },
  { label: '现金', value: 'cash' },
  { label: '农业银行收款码', value: 'abc_qr' },
  { label: '工商银行收款码', value: 'icbc_qr' },
  { label: '建设银行收款码', value: 'ccb_qr' },
  { label: '兴业银行收款码', value: 'cib_qr' },
];

const PAYMENT_TYPES = [
  { label: '订单收款', value: 'order_payment' },
  { label: '预收款', value: 'prepayment' },
];

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

function formatMoney(value) {
  return toNumber(value).toFixed(2);
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

function normalizeOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber || '-',
    status: order.status || '',
    totalAmount: formatMoney(order.totalAmount),
    paidAmount: formatMoney(order.paidAmount),
    remainingAmount: toNumber(order.remainingAmount),
    remainingAmountText: formatMoney(order.remainingAmount),
  };
}

Page({
  data: {
    amount: '',
    customerSearch: '',
    customers: [],
    isSaving: false,
    loadingCustomers: false,
    loadingOrders: false,
    methodIndex: 0,
    orders: [],
    paymentDate: todayText(),
    paymentMethods: PAYMENT_METHODS,
    paymentType: 'order_payment',
    paymentTypes: PAYMENT_TYPES,
    remarks: '',
    selectedMethodLabel: PAYMENT_METHODS[0].label,
    selectedCustomer: null,
    selectedOrder: null,
  },

  onLoad() {
    hideAdminShareMenu();

    const session = requireAdminSession();
    if (!session) return;
    this.loadCustomers();
  },

  onTypeTap(event) {
    const paymentType = event.currentTarget.dataset.type;
    this.setData({
      amount: '',
      orders: [],
      paymentType,
      selectedOrder: null,
    });
    if (paymentType === 'order_payment' && this.data.selectedCustomer) {
      this.loadOrders();
    }
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

    this.setData({
      selectedCustomer: customer,
      selectedOrder: null,
    });

    if (this.data.paymentType === 'order_payment') {
      this.loadOrders(customer.id);
    }
  },

  async loadOrders(customerId) {
    const targetCustomerId =
      customerId || (this.data.selectedCustomer && this.data.selectedCustomer.id);
    if (!targetCustomerId) return;

    this.setData({ loadingOrders: true });
    try {
      const data = await getReceivableOrders({
        customerId: targetCustomerId,
        includeVoided: false,
      });
      const orders = (data.data || [])
        .map(normalizeOrder)
        .filter(
          order =>
            order.remainingAmount > 0 &&
            order.status !== 'draft' &&
            order.status !== 'cancelled'
        );
      this.setData({ loadingOrders: false, orders });
    } catch (error) {
      this.setData({ loadingOrders: false });
      wx.showToast({
        title: error.message || '订单加载失败',
        icon: 'none',
      });
    }
  },

  onRefreshOrders() {
    if (this.data.loadingOrders) return;
    this.loadOrders();
  },

  onOrderTap(event) {
    const order = this.data.orders.find(
      item => item.id === event.currentTarget.dataset.id
    );
    if (!order) return;
    this.setData({
      amount: order.remainingAmount.toFixed(2),
      selectedOrder: order,
    });
  },

  onAmountInput(event) {
    this.setData({ amount: event.detail.value });
  },

  onMethodChange(event) {
    const methodIndex = Number(event.detail.value);
    this.setData({
      methodIndex,
      selectedMethodLabel: this.data.paymentMethods[methodIndex].label,
    });
  },

  onPaymentDateChange(event) {
    this.setData({ paymentDate: event.detail.value });
  },

  onRemarksInput(event) {
    this.setData({ remarks: event.detail.value });
  },

  validatePayment() {
    if (!this.data.selectedCustomer) return '请选择客户';
    if (this.data.paymentType === 'order_payment' && !this.data.selectedOrder) {
      return '请选择要收款的销售单';
    }
    const amount = toNumber(this.data.amount);
    if (amount <= 0) return '请输入收款金额';
    if (
      this.data.paymentType === 'order_payment' &&
      amount > this.data.selectedOrder.remainingAmount
    ) {
      return '收款金额不能超过应收金额';
    }
    return '';
  },

  buildPayload() {
    const amount = toNumber(this.data.amount);
    const method = this.data.paymentMethods[this.data.methodIndex];
    const payload = {
      paymentType: this.data.paymentType,
      customerId: this.data.selectedCustomer.id,
      paymentMethod: method.value,
      paymentAmount: amount,
      actualPaymentAmount: amount,
      roundingAmount: 0,
      paymentDate: this.data.paymentDate,
      remarks: this.data.remarks.trim(),
    };

    if (this.data.paymentType === 'order_payment') {
      payload.salesOrderId = this.data.selectedOrder.id;
    }

    return payload;
  },

  async onSubmit() {
    if (this.data.isSaving) return;

    const message = this.validatePayment();
    if (message) {
      wx.showToast({ title: message, icon: 'none' });
      return;
    }

    const amount = formatMoney(this.data.amount);
    const customerName =
      this.data.selectedCustomer.displayName || this.data.selectedCustomer.name;
    const orderLine =
      this.data.paymentType === 'order_payment' && this.data.selectedOrder
        ? `\n销售单：${this.data.selectedOrder.orderNumber}`
        : '';

    wx.showModal({
      title: '确认登记收款',
      content: `${customerName}${orderLine}\n金额：¥${amount}\n方式：${this.data.selectedMethodLabel}\n日期：${this.data.paymentDate}`,
      confirmText: '确认登记',
      success: result => {
        if (result.confirm) {
          this.submitPayment();
        }
      },
    });
  },

  async submitPayment() {
    if (this.data.isSaving) return;

    this.setData({ isSaving: true });
    try {
      const payment = await createPayment(this.buildPayload());
      const statusText =
        payment.status === 'pending' ? '待确认到账' : '已登记到账';
      wx.showModal({
        title: '收款已登记',
        content: `${payment.paymentNumber || ''} ${statusText}`,
        showCancel: false,
        success: () => {
          wx.navigateBack();
        },
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '登记失败',
        icon: 'none',
      });
    } finally {
      this.setData({ isSaving: false });
    }
  },

});
