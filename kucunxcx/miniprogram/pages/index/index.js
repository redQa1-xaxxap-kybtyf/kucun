'use strict';
// index.ts
// 库存管理小程序 - 首页
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
Page({
  data: {
    // 搜索值
    searchValue: '',
    // 问候语
    greeting: '',
    // 统计数据
    stats: {
      totalProducts: 0,
      inStockProducts: 0,
      lowStockProducts: 0,
    },
    // 产品分类
    categories: [],
    selectedCategoryId: '',
    // 热门产品
    hotProducts: [],
    // 轮播图
    banners: [],
    currentBannerIndex: 0,
    // 布局数据
    statusBarHeight: 20,
    navBarHeight: 44,
    menuButtonHeight: 32,
    menuButtonWidth: 87, // Default fallback
    menuButtonTop: 0,
    // 加载状态
    loading: false,
    // 是否允许查看数字库存（仅 admin / sales）
    canViewNumericInventory: false,
    // 是否允许创建产品（仅 admin / sales）
    canCreateProduct: false,
  },
  onLoad() {
    this.calcLayout();
    this.updateGreeting();
    // 初始化权限标记（仅 admin / sales 为 true）
    const canManage = auth_service_1.default.canViewNumericInventory();
    this.setData({
      canViewNumericInventory: canManage,
      canCreateProduct: canManage,
    });
    this.loadInitialData();
  },
  calcLayout() {
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight;
    // 获取胶囊按钮位置
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    // 计算导航栏高度 (胶囊顶部距离状态栏的间隙 * 2 + 胶囊高度)
    const gap = menuButtonInfo.top - statusBarHeight;
    const navBarHeight = gap * 2 + menuButtonInfo.height;
    this.setData({
      statusBarHeight,
      navBarHeight,
      menuButtonHeight: menuButtonInfo.height,
      menuButtonWidth: menuButtonInfo.width,
      menuButtonTop: menuButtonInfo.top,
    });
  },
  updateGreeting() {
    const hour = new Date().getHours();
    let greeting = '你好';
    if (hour < 6) greeting = '夜深了';
    else if (hour < 12) greeting = '早上好';
    else if (hour < 14) greeting = '中午好';
    else if (hour < 18) greeting = '下午好';
    else greeting = '晚上好';
    this.setData({ greeting });
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
      await Promise.all([
        this.loadBanners(),
        this.loadStats(),
        this.loadCategories(),
        this.loadHotProducts(),
      ]);
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
  // 加载轮播图
  async loadBanners() {
    const mockBanners = [
      {
        id: '1',
        title: '罗马柱外墙方案',
        subtitle: '适配高端别墅、会所立面',
        imageUrl: '',
        bgColor: '#0071E3',
      },
      {
        id: '2',
        title: '豪星外墙别墅砖',
        subtitle: '耐候抗污，一站式搭配罗马柱',
        imageUrl: '',
        bgColor: '#34C759',
      },
      {
        id: '3',
        title: '外墙砖现货库存',
        subtitle: '主流规格花色充足，随时可发货',
        imageUrl: '',
        bgColor: '#FF9500',
      },
    ];
    this.setData({ banners: mockBanners });
  },
  onBannerChange(e) {
    this.setData({ currentBannerIndex: e.detail.current });
  },
  // 加载统计数据
  async loadStats() {
    // TODO: 实际项目中从API获取
    // const res = await wx.request({ url: '/api/stats' })
    // 模拟数据
    this.setData({
      stats: {
        totalProducts: 156,
        inStockProducts: 142,
        lowStockProducts: 8,
      },
    });
  },
  // 加载分类数据
  async loadCategories() {
    try {
      const categories = await category_service_1.default.getCategories();
      this.setData({
        categories,
        selectedCategoryId: (categories[0] && categories[0].id) || '',
      });
    } catch (error) {
      console.error('加载分类失败:', error);
      wx.showToast({
        title: '分类加载失败',
        icon: 'none',
      });
    }
  },
  // 加载热门产品
  async loadHotProducts() {
    try {
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
      this.setData({
        hotProducts: items.slice(0, 8),
      });
    } catch (error) {
      console.error('加载热门产品失败:', error);
    }
  },
  // 搜索功能
  onSearchInput(e) {
    // 实时更新搜索框内容，避免 data 为 undefined
    this.setData({ searchValue: e.detail.value || '' });
  },
  onSearch(e) {
    const value =
      (e && e.detail && e.detail.value) || this.data.searchValue || '';
    console.log('搜索:', value);
    // 跳转到产品列表页并传递搜索关键词
    wx.navigateTo({
      url: `/pages/products/list?keyword=${value}`,
    });
  },
  // 清除搜索
  onClearSearch() {
    this.setData({ searchValue: '' });
  },
  // 分类点击
  onCategoryTap(e) {
    const { id, name } = e.currentTarget.dataset;
    // 先更新选中态，给用户一个视觉反馈
    this.setData({ selectedCategoryId: id });
    // 跳转到产品列表页，按分类筛选
    wx.navigateTo({
      url: `/pages/products/list?categoryId=${id}&categoryName=${name}`,
    });
  },
  // 导航方法
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
  // 中间 + 号：创建产品
  navigateToCreateProduct() {
    const canManage = auth_service_1.default.canViewNumericInventory();
    // 未登录：提示登录
    if (!auth_service_1.default.isLoggedIn()) {
      wx.showModal({
        title: '提示',
        content: '登录后可以使用更多高级功能，是否前往登录？',
        confirmText: '去登录',
        cancelText: '暂不登录',
        success: res => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/auth/login',
            });
          }
        },
      });
      return;
    }
    // 已登录但无权限
    if (!canManage) {
      wx.showToast({
        title: '当前账号无权使用此功能',
        icon: 'none',
      });
      return;
    }
    // 有权限：跳转创建产品
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
