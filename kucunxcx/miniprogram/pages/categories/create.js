'use strict';
// pages/categories/create.ts
// 分类创建页
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const auth_service_1 = __importDefault(require('../../services/auth.service'));
const category_service_1 = require('../../services/category.service');
const ui_1 = require('../../utils/ui');
Page({
  data: {
    enableBackdropBlur: (0, ui_1.getEnableBackdropBlur)(),
    name: '',
    description: '',
    parentId: '',
    parentName: '',
    sortOrder: '',
    // 父级分类选项列表（允许选择到二级分类：新建分类最多到三级）
    parentOptions: [],
    submitting: false,
    // 输入框焦点状态
    focusStates: {
      name: false,
      description: false,
      sortOrder: false,
    },
  },
  async onLoad(options) {
    // 未登录时跳转到登录页
    if (!auth_service_1.default.isLoggedIn()) {
      wx.reLaunch({
        url: '/pages/auth/login',
      });
      return;
    }
    // 必须是管理员才可以创建分类
    if (!auth_service_1.default.canViewNumericInventory()) {
      wx.showToast({
        title: '无权创建分类',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    // 加载父级分类选项
    const presetParentId =
      options && typeof options.parentId === 'string' ? options.parentId : '';
    await this.loadParentCategories(presetParentId);
  },
  // 加载父级分类选项（允许选择到二级分类作为父级：新建分类最多到三级）
  async loadParentCategories(presetParentId) {
    try {
      const categories =
        await category_service_1.categoryService.getCategories();
      const byId = new Map();
      const depthCache = new Map();
      categories.forEach(cat => byId.set(cat.id, cat));
      const computeDepth = (category, ancestry = new Set()) => {
        const cached = depthCache.get(category.id);
        if (cached !== undefined) return cached;
        if (!category.parentId) {
          depthCache.set(category.id, 1);
          return 1;
        }
        if (ancestry.has(category.id)) {
          depthCache.set(category.id, 1);
          return 1;
        }
        ancestry.add(category.id);
        const parent = byId.get(category.parentId);
        if (!parent) {
          depthCache.set(category.id, 2);
          ancestry.delete(category.id);
          return 2;
        }
        const depth = computeDepth(parent, ancestry) + 1;
        depthCache.set(category.id, depth);
        ancestry.delete(category.id);
        return depth;
      };
      const buildPath = category => {
        const parts = [];
        let current = category;
        const visited = new Set();
        let safety = 0;
        while (current && safety < 10) {
          parts.push(current.name);
          if (!current.parentId) break;
          if (visited.has(current.id)) break;
          visited.add(current.id);
          const parent = byId.get(current.parentId);
          if (!parent) break;
          current = parent;
          safety += 1;
        }
        return parts.reverse().join(' / ');
      };
      const MAX_DEPTH = 3;
      const withDepth = categories
        .map(category => ({
          ...category,
          depth: computeDepth(category),
        }))
        // 只允许选择深度 < 3 的分类作为父级（顶级 / 二级）
        .filter(category => category.depth < MAX_DEPTH);
      const getRootCategory = category => {
        let current = category;
        const visited = new Set();
        while (current?.parentId) {
          if (visited.has(current.id)) break;
          visited.add(current.id);
          const parent = byId.get(current.parentId);
          if (!parent) break;
          current = parent;
        }
        return current ?? category;
      };
      const parentOptions = withDepth
        .sort((a, b) => {
          const rootA = getRootCategory(a);
          const rootB = getRootCategory(b);
          if (rootA.id !== rootB.id) {
            const rootOrderA =
              typeof rootA.sortOrder === 'number'
                ? rootA.sortOrder
                : Number.MAX_SAFE_INTEGER;
            const rootOrderB =
              typeof rootB.sortOrder === 'number'
                ? rootB.sortOrder
                : Number.MAX_SAFE_INTEGER;
            if (rootOrderA !== rootOrderB) return rootOrderA - rootOrderB;
            return rootA.name.localeCompare(rootB.name, 'zh-Hans-CN');
          }
          if (a.depth !== b.depth) return a.depth - b.depth;
          const orderA =
            typeof a.sortOrder === 'number'
              ? a.sortOrder
              : Number.MAX_SAFE_INTEGER;
          const orderB =
            typeof b.sortOrder === 'number'
              ? b.sortOrder
              : Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name, 'zh-Hans-CN');
        })
        .map(category => {
          const parent = category.parentId
            ? byId.get(category.parentId)
            : undefined;
          const path = buildPath(category);
          const displayName =
            category.depth === 1
              ? `📁 ${category.name}`
              : `↳ ${category.name}${parent ? ` (${parent.name})` : ''}`;
          return {
            id: category.id,
            name: category.name,
            displayName,
            path,
            depth: category.depth === 1 ? 1 : 2,
          };
        });
      const presetId =
        typeof presetParentId === 'string' ? presetParentId.trim() : '';
      const presetOption = presetId
        ? parentOptions.find(option => option.id === presetId)
        : undefined;
      this.setData({
        parentOptions,
        ...(presetOption
          ? {
              parentId: presetOption.id,
              parentName: presetOption.path,
            }
          : {}),
      });
    } catch (error) {
      console.error('加载父级分类失败:', error);
      wx.showToast({
        title: '加载分类失败',
        icon: 'none',
      });
    }
  },
  // 输入事件
  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },
  onDescInput(e) {
    this.setData({ description: e.detail.value });
  },
  onSortOrderInput(e) {
    this.setData({ sortOrder: e.detail.value });
  },
  // 焦点管理
  onInputFocus(e) {
    const field = e.currentTarget.dataset.field;
    if (field) {
      this.setData({
        [`focusStates.${field}`]: true,
      });
    }
  },
  onInputBlur(e) {
    const field = e.currentTarget.dataset.field;
    if (field) {
      this.setData({
        [`focusStates.${field}`]: false,
      });
    }
  },
  // 父级分类选择
  onParentChange(e) {
    const index = Number(e.detail.value);
    const options = this.data.parentOptions || [];
    if (!options.length || index < 0 || index >= options.length) {
      return;
    }
    const selected = options[index];
    this.setData({
      parentId: selected.id,
      parentName: selected.path,
    });
  },
  // 清除父级分类
  onClearParent() {
    this.setData({
      parentId: '',
      parentName: '',
    });
  },
  // 提交创建
  async onSubmit() {
    // 防抖
    if (this.data.submitting) {
      wx.showToast({
        title: '提交中，请稍候',
        icon: 'none',
        duration: 1000,
      });
      return;
    }
    const name = this.data.name.trim();
    // 验证必填项：只需要分类名称
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }
    // 处理排序号
    let sortOrderNum;
    const sortOrderRaw = this.data.sortOrder.trim();
    if (sortOrderRaw) {
      const parsed = Number(sortOrderRaw);
      if (Number.isNaN(parsed) || parsed < 0) {
        wx.showToast({ title: '排序号必须为非负数字', icon: 'none' });
        return;
      }
      sortOrderNum = parsed;
    }
    this.setData({ submitting: true });
    try {
      // 不传 code，由后端自动生成
      const params = {
        name,
        description: this.data.description.trim() || undefined,
        parentId: this.data.parentId || undefined,
        sortOrder: sortOrderNum,
      };
      await category_service_1.categoryService.createCategory(params);
      wx.showToast({
        title: '创建成功',
        icon: 'success',
        duration: 1500,
      });
      // 返回分类列表页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('创建分类失败:', error);
      // 具体错误提示已在 request.ts 中处理
    } finally {
      this.setData({ submitting: false });
    }
  },
});
