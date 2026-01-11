// pages/categories/create.ts
// 分类创建页

import authService from '../../services/auth.service';
import { categoryService, CreateCategoryParams } from '../../services/category.service';

// 父级分类选项类型
interface ParentOption {
  id: string;
  name: string;
}

Page({
  data: {
    name: '',
    description: '',
    parentId: '',
    parentName: '',
    sortOrder: '',
    // 父级分类选项列表（只显示一级分类）
    parentOptions: [] as ParentOption[],
    submitting: false,
    // 输入框焦点状态
    focusStates: {
      name: false,
      description: false,
      sortOrder: false,
    },
  },

  async onLoad() {
    // 未登录时跳转到登录页
    if (!authService.isLoggedIn()) {
      wx.reLaunch({
        url: '/pages/auth/login',
      });
      return;
    }

    // 必须是管理员才可以创建分类
    if (!authService.canViewNumericInventory()) {
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
    await this.loadParentCategories();
  },

  // 加载父级分类选项（只加载一级分类作为父级选项）
  async loadParentCategories() {
    try {
      const categories = await categoryService.getCategories();
      // 过滤出一级分类（没有 parentId 的分类）
      const topLevel = categories.filter(cat => !cat.parentId);
      // 转换为选项格式
      const parentOptions: ParentOption[] = topLevel.map(cat => ({
        id: cat.id,
        name: cat.name,
      }));
      this.setData({ parentOptions });
    } catch (error) {
      console.error('加载父级分类失败:', error);
      wx.showToast({
        title: '加载分类失败',
        icon: 'none',
      });
    }
  },

  // 输入事件
  onNameInput(e: any) {
    this.setData({ name: e.detail.value });
  },

  onDescInput(e: any) {
    this.setData({ description: e.detail.value });
  },

  onSortOrderInput(e: any) {
    this.setData({ sortOrder: e.detail.value });
  },

  // 焦点管理
  onInputFocus(e: any) {
    const field = e.currentTarget.dataset.field;
    if (field) {
      this.setData({
        [`focusStates.${field}`]: true,
      });
    }
  },

  onInputBlur(e: any) {
    const field = e.currentTarget.dataset.field;
    if (field) {
      this.setData({
        [`focusStates.${field}`]: false,
      });
    }
  },

  // 父级分类选择
  onParentChange(e: any) {
    const index = Number(e.detail.value);
    const options = this.data.parentOptions || [];

    if (!options.length || index < 0 || index >= options.length) {
      return;
    }

    const selected = options[index];
    this.setData({
      parentId: selected.id,
      parentName: selected.name,
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
    let sortOrderNum: number | undefined;
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
      const params: CreateCategoryParams = {
        name,
        description: this.data.description.trim() || undefined,
        parentId: this.data.parentId || undefined,
        sortOrder: sortOrderNum,
      };

      await categoryService.createCategory(params);

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
