const {
  buildGoodsRequestItems,
  buildPlanItemView,
  buildPlanSummary,
  buildSimplePlanText,
  buildPlanText,
  clearPlanItems,
  getPlanItems,
  removePlanItem,
  updatePlanItem,
} = require('../../utils/loading-plan');
const { submitGoodsRequest } = require('../../utils/goods-requests');

const CONTACT_KEY = 'mini_goods_request_contact';

function buildViewState(items) {
  const planItems = getPlanItemsFrom(items)
    .map(buildPlanItemView)
    .filter(Boolean);
  const summary = buildPlanSummary(planItems);

  return {
    hasItems: planItems.length > 0,
    planItems,
    summaryText: summary.summaryText,
    weightNote: summary.weightNote,
  };
}

function getPlanItemsFrom(items) {
  return Array.isArray(items) ? items : [];
}

function toValidQuantity(value, fallback) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return fallback;

  return Math.round(numberValue * 100) / 100;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizePhone(value) {
  return normalizeText(value)
    .replace(/[＋]/g, '+')
    .replace(/[－—–]/g, '-')
    .replace(/[\s()-]/g, '')
    .replace(/^\+?86/, '');
}

function loadSavedContact() {
  const saved = wx.getStorageSync(CONTACT_KEY);
  if (!saved || typeof saved !== 'object') return {};

  return {
    customerName: normalizeText(saved.customerName),
    customerPhone: normalizePhone(saved.customerPhone),
    contactAddress: normalizeText(saved.contactAddress),
  };
}

Page({
  data: {
    hasItems: false,
    planItems: [],
    summaryText: '',
    weightNote: '',
    customerName: '',
    customerPhone: '',
    contactAddress: '',
    submitRemarks: '',
    submitting: false,
    lastRequestNumber: '',
  },

  onLoad() {
    this.quantityDrafts = {};
    this.quantityBlurGuards = {};
    this.setData(loadSavedContact());
    this.loadPlan();
  },

  onShow() {
    this.loadPlan();
  },

  onShareAppMessage() {
    return {
      title: '报货计划',
      path: '/pages/plan/index',
    };
  },

  loadPlan() {
    this.setData(buildViewState(getPlanItems()));
  },

  findPlanItem(id) {
    return (
      getPlanItems().find(current => current.id === id) ||
      this.data.planItems.find(current => current.id === id)
    );
  },

  getDraftQuantity(id, fallback) {
    if (!this.quantityDrafts || this.quantityDrafts[id] === undefined) {
      return fallback;
    }

    return toValidQuantity(this.quantityDrafts[id], fallback);
  },

  clearQuantityDraft(id) {
    if (this.quantityDrafts) {
      delete this.quantityDrafts[id];
    }
  },

  markNextQuantityBlurIgnored(id) {
    if (!this.quantityBlurGuards) {
      this.quantityBlurGuards = {};
    }
    this.quantityBlurGuards[id] = {
      createdAt: Date.now(),
    };
  },

  onQuantityMinus(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.findPlanItem(id);
    if (!item) return;

    const quantity = this.getDraftQuantity(id, item.quantity);
    updatePlanItem(id, { quantity: Math.max(1, quantity - 1) });
    this.clearQuantityDraft(id);
    this.loadPlan();
  },

  onQuantityPlus(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.findPlanItem(id);
    if (!item) return;

    const quantity = this.getDraftQuantity(id, item.quantity);
    updatePlanItem(id, { quantity: quantity + 1 });
    this.clearQuantityDraft(id);
    this.loadPlan();
  },

  onQuantityTyping(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;

    if (!this.quantityDrafts) {
      this.quantityDrafts = {};
    }
    if (this.quantityBlurGuards) {
      delete this.quantityBlurGuards[id];
    }
    this.quantityDrafts[id] = event.detail.value;
  },

  onQuantityInput(event) {
    const id = event.currentTarget.dataset.id;
    const blurGuard = this.quantityBlurGuards && this.quantityBlurGuards[id];

    if (blurGuard && Date.now() - blurGuard.createdAt < 800) {
      delete this.quantityBlurGuards[id];
      this.clearQuantityDraft(id);
      return;
    }

    updatePlanItem(id, { quantity: event.detail.value });
    this.clearQuantityDraft(id);
    this.loadPlan();
  },

  onQuantityUnitTap(event) {
    const id = event.currentTarget.dataset.id;
    const quantityUnit = event.currentTarget.dataset.unit;
    const item = this.findPlanItem(id);
    if (!item || item.quantityUnit === quantityUnit) return;

    const draftQuantity = this.getDraftQuantity(id, item.quantity);
    updatePlanItem(id, { quantity: draftQuantity });
    updatePlanItem(id, { quantityUnit });
    this.clearQuantityDraft(id);
    this.markNextQuantityBlurIgnored(id);
    this.loadPlan();
  },

  onRemarkInput(event) {
    const id = event.currentTarget.dataset.id;
    updatePlanItem(id, { remark: event.detail.value });
    this.loadPlan();
  },

  onContactInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;

    this.setData({
      [field]: event.detail.value,
    });
  },

  onRemoveTap(event) {
    const id = event.currentTarget.dataset.id;
    removePlanItem(id);
    this.clearQuantityDraft(id);
    if (this.quantityBlurGuards) {
      delete this.quantityBlurGuards[id];
    }
    this.loadPlan();
  },

  onProductTap(event) {
    wx.navigateTo({
      url: `/pages/product/detail?productId=${encodeURIComponent(event.currentTarget.dataset.id)}&id=${encodeURIComponent(event.currentTarget.dataset.id)}`,
    });
  },

  onBackHomeTap() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },

  onCopyPlanTap() {
    const text = buildPlanText(this.data.planItems);
    if (!text) {
      wx.showToast({ title: '请先加入产品', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: '已复制计划' });
      },
    });
  },

  onCopySimplePlanTap() {
    const text = buildSimplePlanText(this.data.planItems);
    if (!text) {
      wx.showToast({ title: '请先加入产品', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: '已复制简版' });
      },
    });
  },

  async onSubmitGoodsRequestTap() {
    if (this.data.submitting) return;

    const customerPhone = normalizePhone(this.data.customerPhone);
    if (!customerPhone) {
      wx.showToast({ title: '请填写联系电话', icon: 'none' });
      return;
    }

    const items = buildGoodsRequestItems(this.data.planItems);
    if (!items.length) {
      wx.showToast({ title: '请先加入产品', icon: 'none' });
      return;
    }

    const customerName = normalizeText(this.data.customerName);
    const contactAddress = normalizeText(this.data.contactAddress);
    const remarks = normalizeText(this.data.submitRemarks);

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...', mask: true });

    try {
      const result = await submitGoodsRequest({
        customerName: customerName || null,
        customerPhone,
        contactAddress: contactAddress || null,
        remarks: remarks || null,
        items,
      });

      wx.setStorageSync(CONTACT_KEY, {
        customerName,
        customerPhone,
        contactAddress,
      });

      this.setData({
        lastRequestNumber: result.requestNumber || '',
      });

      wx.showModal({
        title: '报货单已提交',
        content: result.requestNumber
          ? `单号：${result.requestNumber}`
          : '已收到报货单',
        showCancel: false,
        confirmText: '知道了',
        complete: () => {
          clearPlanItems();
          this.quantityDrafts = {};
          this.quantityBlurGuards = {};
          this.setData({
            submitRemarks: '',
            ...buildViewState([]),
          });
        },
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '提交失败',
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },

  onClearTap() {
    if (!this.data.planItems.length) return;

    wx.showModal({
      title: '清空报货计划',
      content: '确认清空已选产品？',
      confirmColor: '#b42318',
      success: result => {
        if (!result.confirm) return;
        clearPlanItems();
        this.quantityDrafts = {};
        this.quantityBlurGuards = {};
        this.loadPlan();
      },
    });
  },
});
