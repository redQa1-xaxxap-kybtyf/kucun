'use strict';
// categories/list.ts
// 分类浏览页
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
Object.defineProperty(exports, '__esModule', { value: true });
const category_service_1 = require('../../services/category.service');
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
  // 每次返回分类页时自动刷新一次，确保看到最新的分类结构
  onShow() {
    this.loadCategories();
  },
  // 下拉刷新
  onPullDownRefresh() {
    this.loadCategories();
    wx.stopPullDownRefresh();
  },
  // 加载分类数据
  loadCategories() {
    return __awaiter(this, void 0, void 0, function* () {
      this.setData({ loading: true });
      try {
        // 从API获取分类数据（扁平数组）
        const categories = yield category_service_1.default.getCategories();
        // 将扁平数组转换为树形结构
        const treeData = this.buildCategoryTree(categories);
        // 计算统计数据
        const totalCategories = this.countAllCategories(treeData);
        const totalProducts = categories.reduce((sum, cat) => {
          var _a, _b;
          return (
            sum +
            (cat.productCount ||
              ((_b =
                (_a = cat._count) === null || _a === void 0
                  ? void 0
                  : _a.products) !== null && _b !== void 0
                ? _b
                : 0))
          );
        }, 0);
        this.setData({
          categories: treeData,
          allCategories: treeData, // 保存原始数据
          totalCategories,
          activeCategories: categories.filter(c => c.status === 'active')
            .length,
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
    });
  },
  // 将扁平数组转换为树形结构
  buildCategoryTree(categories) {
    // 1级分类（没有parentId）
    const topLevel = categories.filter(cat => !cat.parentId);
    // 2级分类（有parentId）
    const secondLevel = categories.filter(cat => cat.parentId);
    // 构建树形结构
    const treeData = topLevel.map(parent => {
      var _a, _b;
      return Object.assign(Object.assign({}, parent), {
        expanded: false,
        productCount:
          parent.productCount ||
          ((_b =
            (_a = parent._count) === null || _a === void 0
              ? void 0
              : _a.products) !== null && _b !== void 0
            ? _b
            : 0),
        children: secondLevel
          .filter(child => child.parentId === parent.id)
          .map(child => {
            var _a, _b;
            return Object.assign(Object.assign({}, child), {
              expanded: false,
              productCount:
                child.productCount ||
                ((_b =
                  (_a = child._count) === null || _a === void 0
                    ? void 0
                    : _a.products) !== null && _b !== void 0
                  ? _b
                  : 0),
            });
          }),
      });
    });
    return treeData;
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
    // 过滤分类（支持树形结构）
    const filteredCategories = this.data.allCategories
      .map(cat => {
        var _a;
        const matchParent =
          cat.name.toLowerCase().includes(keyword) ||
          cat.code.toLowerCase().includes(keyword);
        // 过滤匹配的子分类
        const matchedChildren =
          ((_a = cat.children) === null || _a === void 0
            ? void 0
            : _a.filter(
                child =>
                  child.name.toLowerCase().includes(keyword) ||
                  child.code.toLowerCase().includes(keyword)
              )) || [];
        // 如果父级匹配，保留所有子分类；否则只保留匹配的子分类
        if (matchParent) {
          return Object.assign(Object.assign({}, cat), {
            expanded: cat.children && cat.children.length > 0,
          });
        } else if (matchedChildren.length > 0) {
          return Object.assign(Object.assign({}, cat), {
            children: matchedChildren,
            expanded: true,
          });
        }
        return null;
      })
      .filter(cat => cat !== null);
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
        return Object.assign(Object.assign({}, cat), {
          expanded: !cat.expanded,
        });
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
