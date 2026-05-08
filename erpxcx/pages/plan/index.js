const {
  buildPlanItemView,
  buildPlanSummary,
  buildPlanText,
  clearPlanItems,
  getPlanItems,
  removePlanItem,
  updatePlanItem,
} = require('../../utils/loading-plan');

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

Page({
  data: {
    hasItems: false,
    planItems: [],
    summaryText: '',
    weightNote: '',
  },

  onLoad() {
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

  onQuantityMinus(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.data.planItems.find(current => current.id === id);
    if (!item) return;

    updatePlanItem(id, { quantity: Math.max(1, item.quantity - 1) });
    this.loadPlan();
  },

  onQuantityPlus(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.data.planItems.find(current => current.id === id);
    if (!item) return;

    updatePlanItem(id, { quantity: item.quantity + 1 });
    this.loadPlan();
  },

  onQuantityInput(event) {
    const id = event.currentTarget.dataset.id;
    updatePlanItem(id, { quantity: event.detail.value });
    this.loadPlan();
  },

  onQuantityUnitTap(event) {
    const id = event.currentTarget.dataset.id;
    const quantityUnit = event.currentTarget.dataset.unit;
    updatePlanItem(id, { quantityUnit });
    this.loadPlan();
  },

  onRemarkInput(event) {
    const id = event.currentTarget.dataset.id;
    updatePlanItem(id, { remark: event.detail.value });
    this.loadPlan();
  },

  onRemoveTap(event) {
    const id = event.currentTarget.dataset.id;
    removePlanItem(id);
    this.loadPlan();
  },

  onProductTap(event) {
    wx.navigateTo({
      url: `/pages/product/detail?id=${event.currentTarget.dataset.id}`,
    });
  },

  onBackHomeTap() {
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

  onClearTap() {
    if (!this.data.planItems.length) return;

    wx.showModal({
      title: '清空报货计划',
      content: '确认清空已选产品？',
      confirmColor: '#b42318',
      success: result => {
        if (!result.confirm) return;
        clearPlanItems();
        this.loadPlan();
      },
    });
  },
});
