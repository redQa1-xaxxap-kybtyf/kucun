'use strict';
// index.ts
// 库存管理小程序 - 首页
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g = Object.create(
        (typeof Iterator === 'function' ? Iterator : Object).prototype
      );
    return (
      (g.next = verb(0)),
      (g['throw'] = verb(1)),
      (g['return'] = verb(2)),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                    ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
var auth_service_1 = __importDefault(require('../../services/auth.service'));
var category_service_1 = require('../../services/category.service');
var product_service_1 = __importDefault(
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
  },
  onLoad: function () {
    this.calcLayout();
    this.updateGreeting();
    this.loadInitialData();
  },
  calcLayout: function () {
    // 获取系统信息
    var systemInfo = wx.getSystemInfoSync();
    var statusBarHeight = systemInfo.statusBarHeight;
    // 获取胶囊按钮位置
    var menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    // 计算导航栏高度 (胶囊顶部距离状态栏的间隙 * 2 + 胶囊高度)
    var gap = menuButtonInfo.top - statusBarHeight;
    var navBarHeight = gap * 2 + menuButtonInfo.height;
    this.setData({
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight,
      menuButtonHeight: menuButtonInfo.height,
      menuButtonWidth: menuButtonInfo.width,
      menuButtonTop: menuButtonInfo.top,
    });
  },
  updateGreeting: function () {
    var hour = new Date().getHours();
    var greeting = '你好';
    if (hour < 6) greeting = '夜深了';
    else if (hour < 12) greeting = '早上好';
    else if (hour < 14) greeting = '中午好';
    else if (hour < 18) greeting = '下午好';
    else greeting = '晚上好';
    this.setData({ greeting: greeting });
  },
  // 下拉刷新
  onPullDownRefresh: function () {
    this.loadInitialData();
    setTimeout(function () {
      wx.stopPullDownRefresh();
    }, 1000);
  },
  // 加载初始数据
  loadInitialData: function () {
    return __awaiter(this, void 0, void 0, function () {
      var error_1;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            this.setData({ loading: true });
            _a.label = 1;
          case 1:
            _a.trys.push([1, 3, 4, 5]);
            return [
              4 /*yield*/,
              Promise.all([
                this.loadBanners(),
                this.loadStats(),
                this.loadCategories(),
                this.loadHotProducts(),
              ]),
            ];
          case 2:
            _a.sent();
            return [3 /*break*/, 5];
          case 3:
            error_1 = _a.sent();
            console.error('加载数据失败:', error_1);
            wx.showToast({
              title: '加载失败',
              icon: 'none',
            });
            return [3 /*break*/, 5];
          case 4:
            this.setData({ loading: false });
            return [7 /*endfinally*/];
          case 5:
            return [2 /*return*/];
        }
      });
    });
  },
  // 加载轮播图
  loadBanners: function () {
    return __awaiter(this, void 0, void 0, function () {
      var mockBanners;
      return __generator(this, function (_a) {
        mockBanners = [
          {
            id: '1',
            title: '夏季清仓大促',
            subtitle: '全场低至 5 折起',
            imageUrl: '',
            bgColor: '#0071E3',
          },
          {
            id: '2',
            title: '新品上市',
            subtitle: '探索最新的瓷砖系列',
            imageUrl: '',
            bgColor: '#34C759',
          },
          {
            id: '3',
            title: '库存盘点通知',
            subtitle: '本月底将进行系统维护',
            imageUrl: '',
            bgColor: '#FF9500',
          },
        ];
        this.setData({ banners: mockBanners });
        return [2 /*return*/];
      });
    });
  },
  onBannerChange: function (e) {
    this.setData({ currentBannerIndex: e.detail.current });
  },
  // 加载统计数据
  loadStats: function () {
    return __awaiter(this, void 0, void 0, function () {
      return __generator(this, function (_a) {
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
        return [2 /*return*/];
      });
    });
  },
  // 加载分类数据
  loadCategories: function () {
    return __awaiter(this, void 0, void 0, function () {
      var categories, error_2;
      var _a;
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            _b.trys.push([0, 2, , 3]);
            return [
              4 /*yield*/,
              category_service_1.categoryService.getCategories(),
            ];
          case 1:
            categories = _b.sent();
            this.setData({
              categories: categories,
              selectedCategoryId:
                ((_a = categories[0]) === null || _a === void 0
                  ? void 0
                  : _a.id) || '',
            });
            return [3 /*break*/, 3];
          case 2:
            error_2 = _b.sent();
            console.error('加载分类失败:', error_2);
            wx.showToast({
              title: '分类加载失败',
              icon: 'none',
            });
            return [3 /*break*/, 3];
          case 3:
            return [2 /*return*/];
        }
      });
    });
  },
  // 加载热门产品
  loadHotProducts: function () {
    return __awaiter(this, void 0, void 0, function () {
      var res, items, error_3;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            _a.trys.push([0, 2, , 3]);
            return [
              4 /*yield*/,
              product_service_1.default.getProducts({
                page: 1,
                limit: 12,
                status: 'active',
                includeInventory: true,
                includeStatistics: false,
              }),
            ];
          case 1:
            res = _a.sent();
            items = (res.items || []).filter(function (item) {
              var available =
                item.inventory &&
                typeof item.inventory.availableQuantity === 'number'
                  ? item.inventory.availableQuantity
                  : 0;
              return available > 0;
            });
            // 优先按可用库存从高到低排序，其次按创建时间倒序
            items.sort(function (a, b) {
              var aQty =
                a.inventory && typeof a.inventory.availableQuantity === 'number'
                  ? a.inventory.availableQuantity
                  : 0;
              var bQty =
                b.inventory && typeof b.inventory.availableQuantity === 'number'
                  ? b.inventory.availableQuantity
                  : 0;
              if (bQty !== aQty) {
                return bQty - aQty;
              }
              var aCreated = new Date(a.createdAt).getTime();
              var bCreated = new Date(b.createdAt).getTime();
              return bCreated - aCreated;
            });
            this.setData({
              hotProducts: items.slice(0, 8),
            });
            return [3 /*break*/, 3];
          case 2:
            error_3 = _a.sent();
            console.error('加载热门产品失败:', error_3);
            return [3 /*break*/, 3];
          case 3:
            return [2 /*return*/];
        }
      });
    });
  },
  // 搜索功能
  onSearchInput: function (e) {
    // 实时更新搜索框内容，避免 data 为 undefined
    this.setData({ searchValue: e.detail.value || '' });
  },
  onSearch: function (e) {
    var value =
      (e && e.detail && e.detail.value) || this.data.searchValue || '';
    console.log('搜索:', value);
    // 跳转到产品列表页并传递搜索关键词
    wx.navigateTo({
      url: '/pages/products/list?keyword='.concat(value),
    });
  },
  // 清除搜索
  onClearSearch: function () {
    this.setData({ searchValue: '' });
  },
  // 分类点击
  onCategoryTap: function (e) {
    var id = e.currentTarget.dataset.id;
    this.setData({ selectedCategoryId: id });
    // TODO: 根据分类筛选产品
    console.log('选择分类:', id);
  },
  // 导航方法
  navigateToProducts: function () {
    wx.navigateTo({
      url: '/pages/products/list',
    });
  },
  navigateToInventory: function () {
    wx.navigateTo({
      url: '/pages/inventory/list',
    });
  },
  // 中间 + 号：创建产品
  navigateToCreateProduct: function () {
    wx.navigateTo({
      url: '/pages/products/create',
    });
  },
  navigateToCategories: function () {
    wx.navigateTo({
      url: '/pages/categories/list',
    });
  },
  navigateToUser: function () {
    wx.navigateTo({
      url: '/pages/user/profile',
    });
  },
  navigateToProductDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/products/detail?id='.concat(id),
    });
  },
});
