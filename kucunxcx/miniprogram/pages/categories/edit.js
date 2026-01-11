"use strict";
// pages/categories/edit.ts
// 分类编辑页
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_service_1 = __importDefault(require("../../services/auth.service"));
const category_service_1 = require("../../services/category.service");
Page({
    data: {
        id: '',
        name: '',
        code: '',
        description: '',
        parentId: '',
        parentName: '',
        sortOrder: '',
        status: 'active',
        productCount: 0,
        childrenCount: 0,
        hasChildren: false,
        hasProducts: false,
        // 父级分类选项列表（只显示一级分类，排除自己和自己的子分类）
        parentOptions: [],
        loading: true,
        submitting: false,
        showDeleteDialog: false,
        // 输入框焦点状态
        focusStates: {
            name: false,
            description: false,
            sortOrder: false,
        },
        // 原始数据（用于检测变更）
        originalData: null,
    },
    async onLoad(options) {
        const { id } = options;
        // 未登录时跳转到登录页
        if (!auth_service_1.default.isLoggedIn()) {
            wx.reLaunch({
                url: '/pages/auth/login',
            });
            return;
        }
        // 必须是管理员才可以编辑分类
        if (!auth_service_1.default.canViewNumericInventory()) {
            wx.showToast({
                title: '无权编辑分类',
                icon: 'none',
            });
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);
            return;
        }
        if (!id) {
            wx.showToast({
                title: '缺少分类ID',
                icon: 'none',
            });
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);
            return;
        }
        this.setData({ id });
        await this.loadCategoryDetail();
    },
    // 加载分类详情
    async loadCategoryDetail() {
        this.setData({ loading: true });
        try {
            // 并行加载分类详情和父级选项
            const [category, allCategories] = await Promise.all([
                category_service_1.categoryService.getCategoryDetail(this.data.id),
                category_service_1.categoryService.getCategories(),
            ]);
            // 构建父级选项（排除自己和自己的子分类）
            const childIds = (category.children || []).map(c => c.id);
            const topLevel = allCategories.filter(cat => !cat.parentId && cat.id !== this.data.id && !childIds.includes(cat.id));
            const parentOptions = topLevel.map(cat => ({
                id: cat.id,
                name: cat.name,
            }));
            // 查找当前父级名称
            let parentName = '';
            if (category.parentId) {
                const parent = allCategories.find(c => c.id === category.parentId);
                if (parent) {
                    parentName = parent.name;
                }
            }
            const productCount = category.productCount || (category._count?.products ?? 0);
            const childrenCount = category.children?.length || 0;
            this.setData({
                name: category.name,
                code: category.code,
                description: category.description || '',
                parentId: category.parentId || '',
                parentName,
                sortOrder: category.sortOrder ? String(category.sortOrder) : '',
                status: category.status || 'active',
                productCount,
                childrenCount,
                hasChildren: childrenCount > 0,
                hasProducts: productCount > 0,
                parentOptions,
                originalData: category,
                loading: false,
            });
        }
        catch (error) {
            console.error('加载分类详情失败:', error);
            wx.showToast({
                title: '加载失败',
                icon: 'none',
            });
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);
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
            parentName: selected.name,
        });
    },
    // 清除父级分类
    onClearParent() {
        this.setData({
            parentId: '',
            parentName: '',
        });
    },
    // 状态切换
    onStatusChange(e) {
        const status = e.currentTarget.dataset.status;
        this.setData({ status });
    },
    // 提交修改
    async onSubmit() {
        if (this.data.submitting) {
            wx.showToast({
                title: '提交中，请稍候',
                icon: 'none',
                duration: 1000,
            });
            return;
        }
        const name = this.data.name.trim();
        // 验证必填项
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
            // 构建更新参数
            const params = {
                name,
                description: this.data.description.trim() || undefined,
                parentId: this.data.parentId || undefined,
                sortOrder: sortOrderNum,
            };
            // 更新分类基本信息
            await category_service_1.categoryService.updateCategory(this.data.id, params);
            // 如果状态有变化，单独更新状态
            const originalStatus = this.data.originalData?.status || 'active';
            if (this.data.status !== originalStatus) {
                await category_service_1.categoryService.updateCategoryStatus(this.data.id, this.data.status);
            }
            wx.showToast({
                title: '保存成功',
                icon: 'success',
                duration: 1500,
            });
            // 返回列表页
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);
        }
        catch (error) {
            console.error('更新分类失败:', error);
            // 具体错误提示已在 request.ts 中处理
        }
        finally {
            this.setData({ submitting: false });
        }
    },
    // 删除分类
    onDelete() {
        if (this.data.hasChildren) {
            wx.showToast({
                title: '该分类下有子分类，无法删除',
                icon: 'none',
            });
            return;
        }
        if (this.data.hasProducts) {
            wx.showToast({
                title: '该分类下有产品，无法删除',
                icon: 'none',
            });
            return;
        }
        this.setData({ showDeleteDialog: true });
    },
    // 确认删除
    async onConfirmDelete() {
        this.setData({ showDeleteDialog: false, submitting: true });
        try {
            await category_service_1.categoryService.deleteCategory(this.data.id);
            wx.showToast({
                title: '删除成功',
                icon: 'success',
                duration: 1500,
            });
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);
        }
        catch (error) {
            console.error('删除分类失败:', error);
            // 具体错误提示已在 request.ts 中处理
        }
        finally {
            this.setData({ submitting: false });
        }
    },
    // 取消删除
    onCancelDelete() {
        this.setData({ showDeleteDialog: false });
    },
});
