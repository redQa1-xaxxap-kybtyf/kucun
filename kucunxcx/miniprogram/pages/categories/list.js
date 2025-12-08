'use strict';
// categories/list.ts
// 分类浏览页
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const category_service_1 = __importDefault(
  require('../../services/category.service')
);
Page({
  data: {
    searchValue: '',
    // 统计数据
    totalCategories: 0,
    activeCategories: 0,
    totalProducts: 0,
    // 分类列表
    categories: [],
    allCategories: [], // 保存原始数据用于搜索
    loading: false,
  },
  onLoad() {
    this.loadCategories();
  },
  // 下拉刷新
  onPullDownRefresh() {
    this.loadCategories();
    wx.stopPullDownRefresh();
  },
  // 加载分类数据
  async loadCategories() {
    this.setData({ loading: true });
    try {
      // 从API获取分类数据
      const categories = await category_service_1.default.getCategories();
      // 添加expanded字段并计算产品数量
      const categoriesWithExpanded = categories.map(cat => ({
        ...cat,
        expanded: false,
        // 如果后端没有返回productCount，使用_count
        productCount: cat.productCount || (cat._count?.products ?? 0),
      }));
      // 计算统计数据
      const totalCategories = this.countAllCategories(categoriesWithExpanded);
      const totalProducts = categoriesWithExpanded.reduce(
        (sum, cat) => sum + (cat.productCount || 0),
        0
      );
      this.setData({
        categories: categoriesWithExpanded,
        allCategories: categoriesWithExpanded, // 保存原始数据
        totalCategories,
        activeCategories: categories.filter(c => c.status === 'active').length,
        totalProducts,
      });
    } catch (error) {
      console.error('加载分类失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000,
      });
    } finally {
      this.setData({ loading: false });
    }
  },
  // 递归统计所有分类数量（包含子分类）
  countAllCategories(categories) {
    let count = categories.length;
    categories.forEach(cat => {
      if (cat.children && cat.children.length > 0) {
        count += this.countAllCategories(cat.children);
      }
    });
    return count;
  },
  // 搜索
  onSearch() {
    const keyword = this.data.searchValue.trim().toLowerCase();
    if (!keyword) {
      // 恢复原始数据
      this.setData({ categories: this.data.allCategories });
      return;
    }
    // 过滤分类
    const filteredCategories = this.data.allCategories.filter(cat => {
      const matchParent =
        cat.name.toLowerCase().includes(keyword) ||
        cat.code.toLowerCase().includes(keyword);
      const matchChildren =
        cat.children &&
        cat.children.some(
          child =>
            child.name.toLowerCase().includes(keyword) ||
            child.code.toLowerCase().includes(keyword)
        );
      return matchParent || matchChildren;
    });
    this.setData({ categories: filteredCategories });
  },
  onSearchChange(e) {
    this.setData({ searchValue: e.detail });
  },
  // 展开/收起子分类
  toggleExpand(e) {
    const { id } = e.currentTarget.dataset;
    const categories = this.data.categories.map(cat => {
      if (cat.id === id) {
        return { ...cat, expanded: !cat.expanded };
      }
      return cat;
    });
    this.setData({ categories });
  },
  // 点击分类，跳转到产品列表
  onCategoryTap(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/products/list?categoryId=${id}&categoryName=${name}`,
    });
  },
  // 分享
  onShareAppMessage() {
    return {
      title: '产品分类浏览',
      path: '/pages/categories/list',
    };
  },
});
