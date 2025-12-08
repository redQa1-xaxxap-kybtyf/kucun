'use strict';
// products/list.ts
// 产品列表页
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
    // 搜索
    searchValue: '',
    // 筛选
    showFilter: true,
    filterCategory: '0',
    filterStatus: '0',
    filterSort: '0',
    // 筛选选项
    categoryOptions: [
      { text: '全部分类', value: '0' },
      { text: '瓷砖', value: '1' },
      { text: '地板', value: '2' },
      { text: '墙砖', value: '3' },
      { text: '装饰材料', value: '4' },
    ],
    statusOptions: [
      { text: '全部状态', value: '0' },
      { text: '有库存', value: '1' },
      { text: '缺货', value: '2' },
      { text: '库存预警', value: '3' },
    ],
    sortOptions: [
      { text: '默认排序', value: '0' },
      { text: '库存从高到低', value: '1' },
      { text: '库存从低到高', value: '2' },
      { text: '名称A-Z', value: '3' },
    ],
    // 产品列表
    products: [],
    // 分页
    page: 1,
    pageSize: 10,
    total: 0,
    // 状态
    loading: false,
    finished: false,
    // 布局模式
    layoutMode: 'list',
    // 是否允许查看数字库存（仅 admin / sales）
    canViewNumericInventory: false,
  },
  async onLoad(options) {
    // 恢复用户保存的布局偏好
    const savedLayoutMode = wx.getStorageSync('layoutMode');
    if (
      savedLayoutMode &&
      ['list', 'grid-2', 'grid-3'].includes(savedLayoutMode)
    ) {
      this.setData({ layoutMode: savedLayoutMode });
    } else {
      // 默认使用双列模式（最佳实践）
      this.setData({ layoutMode: 'grid-2' });
    }
    // 从URL参数获取搜索关键词
    if (options.keyword) {
      this.setData({ searchValue: options.keyword });
    }
    // 从URL参数获取分类ID和名称
    if (options.categoryId) {
      this.setData({
        filterCategory: options.categoryId,
      });
      // 更新导航栏标题显示分类名称
      if (options.categoryName) {
        wx.setNavigationBarTitle({
          title: `${options.categoryName} - 产品列表`,
        });
      }
    }
    // 加载分类数据
    this.loadCategories();
    // 初始化库存权限标记（游客可以进入，只是看不到数字库存）
    const canView = auth_service_1.default.canViewNumericInventory();
    this.setData({ canViewNumericInventory: canView });
    // 加载产品列表
    this.loadProducts(true);
  },
  // 加载分类列表
  async loadCategories() {
    try {
      const categories = await category_service_1.default.getCategories();
      // 构建分类选项
      const categoryOptions = [
        { text: '全部分类', value: '0' },
        ...categories.map(cat => ({
          text: cat.name,
          value: cat.id,
        })),
      ];
      this.setData({ categoryOptions });
    } catch (error) {
      console.error('加载分类失败:', error);
      // 失败时使用默认选项，不影响产品加载
    }
  },
  onUnload() {
    // 保存用户的布局偏好
    wx.setStorageSync('layoutMode', this.data.layoutMode);
  },
  // 加载产品列表
  async loadProducts(reset = false) {
    if (this.data.loading) return;
    if (reset) {
      this.setData({
        page: 1,
        products: [],
        finished: false,
      });
    }
    this.setData({ loading: true });
    try {
      // 构建查询参数
      const queryParams = {
        page: this.data.page,
        limit: this.data.pageSize,
        includeInventory: true,
      };
      // 搜索关键词
      if (this.data.searchValue) {
        queryParams.search = this.data.searchValue;
      }
      // 分类筛选
      if (this.data.filterCategory !== '0') {
        queryParams.categoryId = this.data.filterCategory;
      }
      // 状态筛选
      if (this.data.filterStatus !== '0') {
        if (this.data.filterStatus === '1') {
          // 有库存 - 由后端筛选
          queryParams.status = 'active';
        }
        // 缺货和库存预警需要在前端过滤
      }
      // 排序
      if (this.data.filterSort !== '0') {
        switch (this.data.filterSort) {
          case '1': // 库存从高到低
            queryParams.sortBy = 'inventory.availableQuantity';
            queryParams.sortOrder = 'desc';
            break;
          case '2': // 库存从低到高
            queryParams.sortBy = 'inventory.availableQuantity';
            queryParams.sortOrder = 'asc';
            break;
          case '3': // 名称A-Z
            queryParams.sortBy = 'name';
            queryParams.sortOrder = 'asc';
            break;
          default:
            queryParams.sortBy = 'createdAt';
            queryParams.sortOrder = 'desc';
        }
      }
      // 调用产品服务
      const response = await product_service_1.default.getProducts(queryParams);
      // 根据库存状态在前端进行过滤
      let filteredItems = response.items;
      if (this.data.filterStatus !== '0') {
        filteredItems = response.items.filter(product => {
          const inventory = product.inventory;
          if (!inventory) return false;
          const total = inventory.totalQuantity ?? 0;
          const available = inventory.availableQuantity ?? 0;
          switch (this.data.filterStatus) {
            case '1': // 有库存
              return available > 0;
            case '2': // 缺货
              return available <= 0;
            case '3': {
              // 库存预警：有库存但较低
              if (available <= 0) return false;
              if (total > 0) {
                // 按比例判断：可用库存低于总库存的 20% 视为预警
                return available / total <= 0.2;
              }
              // 没有总库存信息时，使用绝对值阈值
              return available <= 20;
            }
            default:
              return true;
          }
        });
      }
      // 合并数据
      const newProducts = reset
        ? filteredItems
        : [...this.data.products, ...filteredItems];
      // 更新状态
      this.setData({
        products: newProducts,
        total: response.pagination.total,
        finished: !response.pagination.hasNextPage,
        page: this.data.page + 1,
      });
    } catch (error) {
      console.error('加载产品失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({
        loading: false,
      });
    }
  },
  // 搜索
  onSearch() {
    this.loadProducts(true);
  },
  onSearchChange(e) {
    this.setData({ searchValue: e.detail });
  },
  onClearSearch() {
    this.setData({ searchValue: '' });
    this.loadProducts(true);
  },
  // 筛选
  toggleFilter() {
    this.setData({ showFilter: !this.data.showFilter });
  },
  onCategoryChange(e) {
    this.setData({ filterCategory: e.detail });
    this.loadProducts(true);
  },
  onStatusChange(e) {
    this.setData({ filterStatus: e.detail });
    this.loadProducts(true);
  },
  onSortChange(e) {
    this.setData({ filterSort: e.detail });
    this.loadProducts(true);
  },
  // 下拉刷新（微信原生）
  onPullDownRefresh() {
    this.loadProducts(true);
    wx.stopPullDownRefresh();
  },
  // 上拉加载更多
  onLoadMore() {
    if (!this.data.finished && !this.data.loading) {
      this.loadProducts(false);
    }
  },
  // 导航到详情页
  navigateToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/products/detail?id=${id}`,
    });
  },
  // 切换到指定布局模式
  switchToLayout(e) {
    const targetMode = e.currentTarget.dataset.mode;
    const currentMode = this.data.layoutMode;
    // 如果点击当前模式，不做处理
    if (targetMode === currentMode) {
      return;
    }
    const modeNames = {
      list: '单列模式',
      'grid-2': '双列模式',
      'grid-3': '三列模式',
    };
    // 更新布局模式
    this.setData({
      layoutMode: targetMode,
    });
    // 保存用户偏好
    wx.setStorageSync('layoutMode', targetMode);
    // 显示切换提示
    wx.showToast({
      title: modeNames[targetMode],
      icon: 'none',
      duration: 800,
    });
    // 数据埋点（可选）
    // wx.reportAnalytics('layout_switch', {
    //   from: currentMode,
    //   to: targetMode,
    //   timestamp: Date.now()
    // })
  },
  // 兼容旧的 toggleLayout 方法（如果有其他地方调用）
  toggleLayout() {
    const modes = ['list', 'grid-2', 'grid-3'];
    const currentMode = this.data.layoutMode;
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    this.setData({ layoutMode: nextMode });
    wx.setStorageSync('layoutMode', nextMode);
    const modeNames = ['单列模式', '双列模式', '三列模式'];
    wx.showToast({
      title: modeNames[nextIndex],
      icon: 'none',
      duration: 800,
    });
  },
});
