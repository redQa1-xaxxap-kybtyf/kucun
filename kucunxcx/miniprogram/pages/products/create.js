'use strict';
// products/create.ts
// 产品创建页
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const auth_service_1 = __importDefault(require('../../services/auth.service'));
const category_service_1 = require('../../services/category.service');
const product_service_1 = require('../../services/product.service');
Page({
  data: {
    code: '',
    name: '',
    specification: '',
    description: '',
    thickness: '',
    categoryId: '',
    categoryName: '',
    categories: [],
    submitting: false,
    // 图片相关
    thumbnailUrl: '',
    // backend 返回的上传记录（可选）
    uploadInfo: null,
    mainImages: [],
    effectImages: [],
  },
  async onLoad() {
    // 未登录时跳转到登录页
    if (!auth_service_1.default.isLoggedIn()) {
      wx.reLaunch({
        url: '/pages/auth/login',
      });
      return;
    }
    await this.loadCategories();
  },
  async loadCategories() {
    try {
      const categories =
        await category_service_1.categoryService.getCategories();
      this.setData({ categories });
    } catch (error) {
      console.error('加载分类失败:', error);
      wx.showToast({
        title: '加载分类失败',
        icon: 'none',
      });
    }
  },
  // 输入事件
  onCodeInput(e) {
    this.setData({ code: e.detail.value });
  },
  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },
  onSpecInput(e) {
    this.setData({ specification: e.detail.value });
  },
  onDescInput(e) {
    this.setData({ description: e.detail.value });
  },
  onThicknessInput(e) {
    this.setData({ thickness: e.detail.value });
  },
  // 分类选择
  onCategoryChange(e) {
    const index = Number(e.detail.value);
    const categories = this.data.categories || [];
    if (!categories.length || index < 0 || index >= categories.length) {
      return;
    }
    const category = categories[index];
    this.setData({
      categoryId: category.id,
      categoryName: category.name,
    });
  },
  // 通用图片选择入口
  chooseImageAndUpload(kind) {
    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        if (!res.tempFilePaths || !res.tempFilePaths.length) {
          return;
        }
        const filePath = res.tempFilePaths[0];
        that.uploadImage(filePath, kind);
      },
    });
  },
  // 选择主图
  onChooseThumbnail() {
    this.chooseImageAndUpload('thumbnail');
  },
  // 添加主图（多张）
  onAddMainImage() {
    this.chooseImageAndUpload('main');
  },
  // 添加效果图
  onAddEffectImage() {
    this.chooseImageAndUpload('effect');
  },
  // 预览主图
  onPreviewThumbnail() {
    const url = this.data.thumbnailUrl;
    if (!url) return;
    wx.previewImage({
      current: url,
      urls: [url],
    });
  },
  // 预览主图/效果图
  onPreviewMainImage(e) {
    const idx = e.currentTarget.dataset.index;
    const list = this.data.mainImages || [];
    if (!list.length) return;
    wx.previewImage({
      current: list[idx] || list[0],
      urls: list,
    });
  },
  onPreviewEffectImage(e) {
    const idx = e.currentTarget.dataset.index;
    const list = this.data.effectImages || [];
    if (!list.length) return;
    wx.previewImage({
      current: list[idx] || list[0],
      urls: list,
    });
  },
  // 删除主图/效果图
  onRemoveMainImage(e) {
    const idx = e.currentTarget.dataset.index;
    const list = (this.data.mainImages || []).slice();
    if (idx >= 0 && idx < list.length) {
      list.splice(idx, 1);
      this.setData({ mainImages: list });
    }
  },
  onRemoveEffectImage(e) {
    const idx = e.currentTarget.dataset.index;
    const list = (this.data.effectImages || []).slice();
    if (idx >= 0 && idx < list.length) {
      list.splice(idx, 1);
      this.setData({ effectImages: list });
    }
  },
  // 上传图片到后台 /api/upload
  uploadImage(filePath, kind) {
    const token = wx.getStorageSync('auth_token');
    // 动态 require 避免循环依赖
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require('../../config/api');
    const baseURL = (api.apiConfig && api.apiConfig.baseURL) || '';
    wx.showLoading({ title: '上传中...', mask: true });
    wx.uploadFile({
      url: baseURL + '/upload',
      filePath,
      name: 'file',
      formData: { type: 'product' },
      header: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
      success: res => {
        try {
          const raw = JSON.parse(res.data || '{}');
          if (raw && raw.success && raw.data && raw.data.url) {
            const url = raw.data.url;
            if (kind === 'thumbnail') {
              this.setData({
                thumbnailUrl: url,
                uploadInfo: raw.data,
              });
            } else if (kind === 'main') {
              const list = (this.data.mainImages || []).slice();
              list.push(url);
              this.setData({ mainImages: list });
            } else if (kind === 'effect') {
              const list = (this.data.effectImages || []).slice();
              list.push(url);
              this.setData({ effectImages: list });
            }
          } else {
            const msg = (raw && (raw.error || raw.message)) || '上传失败';
            wx.showToast({ title: msg, icon: 'none' });
          }
        } catch (e) {
          console.error('解析上传响应失败:', e);
          wx.showToast({ title: '上传返回解析失败', icon: 'none' });
        }
      },
      fail: err => {
        console.error('上传图片失败:', err);
        wx.showToast({ title: '上传失败', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
      },
    });
  },
  // 提交创建
  async onSubmit() {
    if (this.data.submitting) return;
    const code = this.data.code.trim();
    const name = this.data.name.trim();
    const specification = this.data.specification.trim();
    const categoryId = this.data.categoryId;
    if (!code) {
      wx.showToast({ title: '请输入产品编码', icon: 'none' });
      return;
    }
    if (!name) {
      wx.showToast({ title: '请输入产品名称', icon: 'none' });
      return;
    }
    if (!specification) {
      wx.showToast({ title: '请输入规格', icon: 'none' });
      return;
    }
    if (!categoryId) {
      wx.showToast({ title: '请选择分类', icon: 'none' });
      return;
    }
    let thicknessNumber;
    const thicknessRaw = this.data.thickness.trim();
    if (thicknessRaw) {
      const parsed = Number(thicknessRaw);
      if (Number.isNaN(parsed) || parsed < 0) {
        wx.showToast({ title: '厚度必须为数字', icon: 'none' });
        return;
      }
      thicknessNumber = parsed;
    }
    this.setData({ submitting: true });
    try {
      const product = await product_service_1.productService.createProduct({
        code,
        name,
        specification,
        description: this.data.description.trim(),
        thickness: thicknessNumber,
        categoryId,
        thumbnailUrl: this.data.thumbnailUrl || undefined,
        mainImages: this.data.mainImages || [],
        effectImages: this.data.effectImages || [],
      });
      wx.showToast({
        title: '创建成功',
        icon: 'success',
        duration: 1500,
      });
      setTimeout(() => {
        if (product && product.id) {
          wx.redirectTo({
            url: `/pages/products/detail?id=${product.id}`,
          });
        } else {
          wx.redirectTo({
            url: '/pages/products/list',
          });
        }
      }, 1500);
    } catch (error) {
      console.error('创建产品失败:', error);
      // 具体错误提示已在 request.ts 中处理，这里只重置状态
    } finally {
      this.setData({ submitting: false });
    }
  },
});
