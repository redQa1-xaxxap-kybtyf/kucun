// categories/list.ts
// 分类浏览页

import categoryService from '../../services/category.service';
import type { Category } from '../../types/category';

type CategoryWithoutChildren = Omit<Category, 'children'>;

interface CategoryWithExpanded extends CategoryWithoutChildren {
  expanded: boolean;
  children?: CategoryWithExpanded[];
}

Page({
  data: {
    searchValue: '',

    // 统计数据
    totalCategories: 0,
    activeCategories: 0,
    totalProducts: 0,

    // 分类列表
    categories: [] as CategoryWithExpanded[],
    allCategories: [] as CategoryWithExpanded[], // 保存原始数据用于搜索
    loading: false,
  },

  onLoad() {
    // 开启右上角分享菜单（好友 + 朋友圈）
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    });

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
  async loadCategories() {
    this.setData({ loading: true });

    try {
      // 从API获取分类数据（扁平数组）
      const categories = await categoryService.getCategories();

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
  buildCategoryTree(categories: Category[]): CategoryWithExpanded[] {
    // 1级分类（没有parentId或parentId为null）
    const topLevel = categories.filter(cat => !cat.parentId);

    // 2级分类（有parentId）
    const secondLevel = categories.filter(cat => cat.parentId);

    // 如果没有1级分类，说明所有分类可能都有parentId，直接平铺显示
    if (topLevel.length === 0) {
      console.warn('未找到1级分类，将所有分类作为1级显示');
      return categories.map(cat => ({
        ...cat,
        expanded: false,
        productCount: cat.productCount || (cat._count?.products ?? 0),
        children: [],
      }));
    }

    // 构建树形结构
    const treeData: CategoryWithExpanded[] = topLevel.map(parent => ({
      ...parent,
      expanded: true,  // 默认展开，让用户能看到2级分类
      productCount: parent.productCount || (parent._count?.products ?? 0),
      children: secondLevel
        .filter(child => child.parentId === parent.id)
        .map(child => ({
          ...child,
          expanded: false,
          productCount: child.productCount || (child._count?.products ?? 0),
          children: [],
        })),
    }));

    return treeData;
  },

  // 递归统计所有分类数量（包含子分类）
  countAllCategories(categories: CategoryWithExpanded[]): number {
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
        const matchParent =
          cat.name.toLowerCase().includes(keyword) ||
          cat.code.toLowerCase().includes(keyword);

        // 过滤匹配的子分类
        const matchedChildren =
          cat.children?.filter(
            child =>
              child.name.toLowerCase().includes(keyword) ||
              child.code.toLowerCase().includes(keyword)
          ) || [];

        // 如果父级匹配，保留所有子分类；否则只保留匹配的子分类
        if (matchParent) {
          return { ...cat, expanded: (cat.children?.length ?? 0) > 0 };
        } else if (matchedChildren.length > 0) {
          return { ...cat, children: matchedChildren, expanded: true };
        }

        return null;
      })
      .filter((cat): cat is CategoryWithExpanded => cat !== null);

    this.setData({ categories: filteredCategories });
  },

  onSearchChange(e: any) {
    this.setData({ searchValue: e.detail });
  },

  // 展开/收起子分类
  toggleExpand(e: any) {
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
  onCategoryTap(e: any) {
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

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '产品分类浏览',
      query: '',
    };
  },
});
