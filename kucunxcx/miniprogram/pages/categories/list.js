'use strict';
// categories/list.ts
// 分类浏览页
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
    // 是否显示“新增分类/新增下级”入口（仅管理员/销售）
    canManageCategories: false,
  },
  onLoad() {
    // 开启右上角分享菜单（好友 + 朋友圈）
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    });
  },
  // 每次返回分类页时自动刷新一次，确保看到最新的分类结构
  onShow() {
    const canManageCategories =
      auth_service_1.default.canViewNumericInventory();
    if (canManageCategories !== this.data.canManageCategories) {
      this.setData({ canManageCategories });
    }
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
      // 从API获取分类数据（扁平数组）
      const categories = await category_service_1.default.getCategories();
      // 将扁平数组转换为树形结构
      const treeData = this.buildCategoryTree(categories);
      // 计算统计数据
      const totalCategories = this.countAllCategories(treeData);
      const totalProducts = categories.reduce(
        (sum, cat) => sum + (cat.productCount || (cat._count?.products ?? 0)),
        0
      );
      this.setData({
        categories: treeData,
        allCategories: treeData, // 保存原始数据
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
  // 将扁平数组转换为树形结构
  buildCategoryTree(categories) {
    const normalizeCount = cat =>
      cat.productCount || (cat._count?.products ?? 0);
    const sortCategories = (a, b) => {
      const orderA =
        typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
      const orderB =
        typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    };
    const byId = new Map();
    categories.forEach(cat => byId.set(cat.id, cat));
    // parentId -> children 映射（null 表示顶级）
    const childrenByParentId = new Map();
    categories.forEach(cat => {
      const parentKey = cat.parentId ? cat.parentId : null;
      const bucket = childrenByParentId.get(parentKey);
      if (bucket) {
        bucket.push(cat);
      } else {
        childrenByParentId.set(parentKey, [cat]);
      }
    });
    childrenByParentId.forEach(list => list.sort(sortCategories));
    // 顶级：parentId 为空，或父级不存在（兜底处理“孤儿分类”）
    const roots = categories
      .filter(cat => !cat.parentId || !byId.has(cat.parentId))
      .slice()
      .sort(sortCategories);
    if (roots.length === 0) {
      console.warn('未找到顶级分类，将所有分类作为顶级显示');
      return categories
        .slice()
        .sort(sortCategories)
        .map(cat => ({
          ...cat,
          expanded: false,
          level: 1,
          productCount: normalizeCount(cat),
          children: [],
        }));
    }
    const visited = new Set();
    const buildNode = (category, level, ancestry = new Set()) => {
      if (ancestry.has(category.id)) {
        return {
          ...category,
          expanded: false,
          level,
          productCount: normalizeCount(category),
          children: [],
        };
      }
      ancestry.add(category.id);
      visited.add(category.id);
      const rawChildren = childrenByParentId.get(category.id) ?? [];
      const nextLevel = level + 1;
      const children =
        level < 3
          ? rawChildren.map(child =>
              buildNode(child, Math.min(nextLevel, 3), new Set(ancestry))
            )
          : [];
      return {
        ...category,
        expanded: level === 1, // 默认展开一级，二级/三级默认收起
        level,
        productCount: normalizeCount(category),
        children,
      };
    };
    // 先构建从 roots 出发的树（最多 3 级）
    const treeData = roots.map(root => buildNode(root, 1));
    // 兜底：如果仍有未挂上的分类（异常数据），按顶级追加显示
    const orphanCategories = categories
      .filter(cat => !visited.has(cat.id))
      .slice()
      .sort(sortCategories);
    orphanCategories.forEach(orphan => {
      treeData.push(buildNode(orphan, 1));
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
    const expandAll = node => ({
      ...node,
      expanded: (node.children?.length ?? 0) > 0,
      children: node.children?.map(child => expandAll(child)) ?? [],
    });
    const filterTree = nodes =>
      nodes
        .map(node => {
          const matchSelf =
            node.name.toLowerCase().includes(keyword) ||
            node.code.toLowerCase().includes(keyword);
          if (matchSelf) {
            return expandAll(node);
          }
          const filteredChildren = node.children
            ? filterTree(node.children)
            : [];
          if (filteredChildren.length > 0) {
            return {
              ...node,
              expanded: true,
              children: filteredChildren,
            };
          }
          return null;
        })
        .filter(n => n !== null);
    this.setData({ categories: filterTree(this.data.allCategories) });
  },
  onSearchChange(e) {
    this.setData({ searchValue: e.detail });
  },
  // 展开/收起子分类
  toggleExpand(e) {
    const { id } = e.currentTarget.dataset;
    const toggleInTree = nodes =>
      nodes.map(node => {
        if (node.id === id) {
          return { ...node, expanded: !node.expanded };
        }
        if (node.children && node.children.length > 0) {
          return { ...node, children: toggleInTree(node.children) };
        }
        return node;
      });
    this.setData({ categories: toggleInTree(this.data.categories) });
  },
  // 点击分类，跳转到产品列表
  onCategoryTap(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/products/list?categoryId=${id}&categoryName=${name}`,
    });
  },
  // 新建顶级分类
  onAddCategory() {
    if (!auth_service_1.default.isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.navigateTo({ url: '/pages/auth/login' });
      return;
    }
    if (!auth_service_1.default.canViewNumericInventory()) {
      wx.showToast({ title: '无权创建分类', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/categories/create' });
  },
  // 新建下级分类（带 parentId 预设）
  onAddChildCategory(e) {
    const { id, name } = e.currentTarget.dataset;
    if (!id) {
      return;
    }
    if (!auth_service_1.default.isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.navigateTo({ url: '/pages/auth/login' });
      return;
    }
    if (!auth_service_1.default.canViewNumericInventory()) {
      wx.showToast({ title: '无权创建分类', icon: 'none' });
      return;
    }
    const parentName = typeof name === 'string' ? name : '';
    wx.navigateTo({
      url: `/pages/categories/create?parentId=${encodeURIComponent(id)}&parentName=${encodeURIComponent(parentName)}`,
    });
  },
  // 分享
  onShareAppMessage() {
    return {
      title: '产品分类浏览',
      path: '/pages/categories/list',
    };
  },
  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '产品分类浏览',
      query: '',
    };
  },
});
