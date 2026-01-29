'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const auth_service_1 = __importDefault(require('../../services/auth.service'));
const category_service_1 = __importDefault(
  require('../../services/category.service')
);
const product_service_1 = __importDefault(
  require('../../services/product.service')
);
const ui_1 = require('../../utils/ui');
// index.ts
// 库存管理小程序 - 首页
const INITIAL_DOCK_SPACER_PX = (() => {
  try {
    const info = wx.getWindowInfo();
    const safeAreaBottom =
      info.safeArea && typeof info.safeArea.bottom === 'number'
        ? Math.max(0, info.screenHeight - info.safeArea.bottom)
        : 0;
    return Math.ceil((180 * info.windowWidth) / 750 + safeAreaBottom);
  } catch (_error) {
    return 120;
  }
})();
Page({
  data: {
    // 搜索值
    searchValue: '',
    // UI 状态
    enableBackdropBlur: (0, ui_1.getEnableBackdropBlur)(),
    dockSpacerHeightPx: INITIAL_DOCK_SPACER_PX,
    headerOpacity: 0,
    scrollTop: 0,
    statusBarHeight: 20, // 默认值，onLoad会更新
    navBarHeight: 44,
    menuButtonWidth: 87, // 胶囊按钮宽
    // 统计数据
    stats: {
      totalProducts: 0,
      inStockProducts: 0,
      lowStockProducts: 0,
    },
    // 产品分类
    categories: [],
    selectedCategoryId: '',
    selectedCategoryName: '',
    // 热门产品
    hotProducts: [],
    // 加载状态
    loading: false,
    // 权限控制
    canViewNumericInventory: false,
    canCreateProduct: false,
  },
  onLoad() {
    // 计算头部布局
    this.calcLayout();
    // 初始化权限标记（仅 admin / sales 为 true）
    const canManage = auth_service_1.default.canViewNumericInventory();
    this.setData({
      canViewNumericInventory: canManage,
      canCreateProduct: canManage,
    });
  },
  onReady() {
    this.updateDockSpacerHeight();
  },
  // 每次页面显示时都刷新首页数据，确保 Web 端更新后小程序能及时看到
  onShow() {
    this.loadInitialData();
  },
  // 适配导航栏高度与胶囊按钮
  calcLayout() {
    // 推荐使用 wx.getWindowInfo 获取窗口信息，避免使用已废弃的 getSystemInfoSync
    const sysInfo = wx.getWindowInfo();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight =
      (menuButtonInfo.top - sysInfo.statusBarHeight) * 2 +
      menuButtonInfo.height;
    const safeAreaBottom =
      sysInfo.safeArea && typeof sysInfo.safeArea.bottom === 'number'
        ? Math.max(0, sysInfo.screenHeight - sysInfo.safeArea.bottom)
        : 0;
    const rpxToPx = rpx => (rpx * sysInfo.windowWidth) / 750;
    const dockSpacerHeightPx = Math.ceil(rpxToPx(180) + safeAreaBottom);
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      navBarHeight,
      menuButtonWidth: sysInfo.windowWidth - menuButtonInfo.left,
      dockSpacerHeightPx,
    });
  },
  updateDockSpacerHeight() {
    let windowInfo;
    try {
      windowInfo = wx.getWindowInfo();
    } catch (_error) {
      try {
        // 兜底：仅在极老基础库上使用 sync API
        windowInfo = wx.getSystemInfoSync();
      } catch (_innerError) {
        return;
      }
    }
    const rpxToPx = rpx => (rpx * windowInfo.windowWidth) / 750;
    const safeAreaBottom =
      windowInfo.safeArea && typeof windowInfo.safeArea.bottom === 'number'
        ? Math.max(0, windowInfo.screenHeight - windowInfo.safeArea.bottom)
        : 0;
    const bottomOffsetPx = rpxToPx(48);
    const extraPx = rpxToPx(16);
    const minSpacerPx = rpxToPx(180) + safeAreaBottom;
    const query = wx.createSelectorQuery().in(this);
    query.select('.floating-dock').boundingClientRect();
    query.exec(res => {
      const rect = Array.isArray(res) ? res[0] : undefined;
      const dockHeightPx =
        rect && typeof rect.height === 'number' ? rect.height : rpxToPx(120);
      const spacerPx = Math.max(
        Math.ceil(dockHeightPx + bottomOffsetPx + safeAreaBottom + extraPx),
        Math.ceil(minSpacerPx)
      );
      if (spacerPx !== this.data.dockSpacerHeightPx) {
        this.setData({ dockSpacerHeightPx: spacerPx });
      }
    });
  },
  // 页面滚动监听 (核心交互: 极光渐变)
  onScroll(e) {
    const scrollTop = e.detail.scrollTop;
    // 0-60px 渐变区间
    let headerOpacity = scrollTop / 60;
    if (headerOpacity > 1) headerOpacity = 1;
    if (headerOpacity < 0) headerOpacity = 0;
    this.setData({
      scrollTop,
      headerOpacity,
    });
  },
  // 下拉刷新
  onPullDownRefresh() {
    this.loadInitialData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },
  // 加载初始数据
  async loadInitialData() {
    this.setData({ loading: true });
    try {
      await Promise.all([this.loadCategories(), this.loadHotProducts()]);
    } catch (error) {
      console.error('加载数据失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },
  // 加载分类数据
  async loadCategories() {
    // 从后端获取原始分类（包含 parentId）
    const raw = await category_service_1.default.getCategories();
    // 建立 id -> 分类 的映射，便于计算分组与排序
    const map = new Map();
    raw.forEach(cat => map.set(cat.id, cat));
    // 以“1级分类”为单位构建卡片：
    // - parentId 为空的作为 1 级卡片
    // - parentId 不为空的作为对应 1 级卡片下的 2 级标签
    const groups = new Map();
    raw.forEach(cat => {
      const parentId = cat.parentId;
      if (!parentId) {
        // 创建或更新 1 级分组
        let group = groups.get(cat.id);
        if (!group) {
          group = { id: cat.id, name: cat.name, children: [] };
          groups.set(cat.id, group);
        } else {
          group.id = cat.id;
          group.name = cat.name;
        }
      } else {
        const parent = map.get(parentId);
        if (!parent) return;
        let group = groups.get(parent.id);
        if (!group) {
          group = { id: parent.id, name: parent.name, children: [] };
          groups.set(parent.id, group);
        }
        group.children.push({ id: cat.id, name: cat.name });
      }
    });
    // 按 1 级分类的 sortOrder 排序，保证卡片顺序稳定
    const categories = Array.from(groups.values()).sort((a, b) => {
      const pa = map.get(a.id);
      const pb = map.get(b.id);
      return (pa?.sortOrder ?? 0) - (pb?.sortOrder ?? 0);
    });
    this.setData({
      categories,
      selectedCategoryId: 'all',
    });
  },
  // 加载热门产品
  async loadHotProducts() {
    // 从后端获取产品列表（真实接口）
    const res = await product_service_1.default.getProducts({
      page: 1,
      limit: 12,
      status: 'active',
      includeInventory: true,
      includeStatistics: false,
    });
    const items = (res.items || []).filter(item => {
      const available =
        item.inventory && typeof item.inventory.availableQuantity === 'number'
          ? item.inventory.availableQuantity
          : 0;
      return available > 0;
    });
    // 优先按照库存数量排序，其次按照创建时间倒序
    items.sort((a, b) => {
      const aQty =
        a.inventory && typeof a.inventory.availableQuantity === 'number'
          ? a.inventory.availableQuantity
          : 0;
      const bQty =
        b.inventory && typeof b.inventory.availableQuantity === 'number'
          ? b.inventory.availableQuantity
          : 0;
      if (bQty !== aQty) {
        return bQty - aQty;
      }
      const aCreated = new Date(a.createdAt).getTime();
      const bCreated = new Date(b.createdAt).getTime();
      return bCreated - aCreated;
    });
    // 只保留前 8 个热门产品用于首页展示
    this.setData({
      hotProducts: items.slice(0, 8),
    });
  },
  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchValue: e.detail.value,
    });
  },
  // 触发搜索
  onSearch() {
    if (this.data.searchValue) {
      wx.navigateTo({
        // 与产品列表页约定使用 keyword 参数承载搜索词
        url: `/pages/products/list?keyword=${this.data.searchValue}`,
      });
    }
  },
  // 清除搜索
  onClearSearch() {
    this.setData({ searchValue: '' });
  },
  // 分类点击
  onCategoryTap(e) {
    const { id, name } = e.currentTarget.dataset;
    // 更新选中状态
    this.setData({
      selectedCategoryId: id,
      selectedCategoryName: id === 'all' ? '' : name,
    });
    // 跳转到产品列表页，按分类筛选
    wx.navigateTo({
      url: `/pages/products/list?categoryId=${id}&categoryName=${name}`,
    });
  },
  // 导航方法
  // 底部导航：回到首页（当前页为首页时不做跳转）
  navigateToHome() {
    // 首页本身，点击不做跳转（避免 reLaunch 造成闪烁/重复请求）
    return;
  },
  navigateToProducts() {
    wx.navigateTo({
      url: '/pages/products/list',
    });
  },
  navigateToInventory() {
    wx.navigateTo({
      url: '/pages/inventory/list',
    });
  },
  navigateToCreateProduct() {
    const canManage = auth_service_1.default.canViewNumericInventory();
    // 访客 / 普通用户：仅展示极光渐变效果，不做任何提示
    if (!canManage) {
      return;
    }
    // 管理员 / 销售：正常使用创建功能
    wx.navigateTo({
      url: '/pages/products/create',
    });
  },
  navigateToCategories() {
    wx.navigateTo({
      url: '/pages/categories/list',
    });
  },
  navigateToUser() {
    wx.navigateTo({
      url: '/pages/user/profile',
    });
  },
  navigateToProductDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/products/detail?id=${id}`,
    });
  },
  // 导航到罗马柱配砖功能
  navigateToColumn() {
    wx.navigateTo({
      url: '/pages/column/index/index',
    });
  },
  // 分享给好友
  onShareAppMessage() {
    return {
      title: '豪星陶瓷',
      path: '/pages/index/index',
      imageUrl: '',
    };
  },
  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '豪星陶瓷',
      query: '',
      imageUrl: '',
    };
  },
});
